import { defineStore } from "pinia";
import { api, commonUtil, logger } from "@common";
import { useAtpProductStore } from "@/store/atpProductStore";

export interface FacilityGroupState {
  groups: any[];
  facilitiesByGroup: Record<string, any[]>;
  groupTypes: any[];
}

export const useFacilityGroupStore = defineStore("facilityGroup", {
  state: (): FacilityGroupState => ({
    groups: [],
    facilitiesByGroup: {},
    groupTypes: []
  }),
  getters: {
    getGroups: (state) => state.groups,
    getGroupFacilities: (state) => (groupId: string) => state.facilitiesByGroup[groupId] || [],
    getGroupTypes: (state) => state.groupTypes
  },
  actions: {
    async fetchGroups() {
      const product = useAtpProductStore();
      // Lazily fetch product stores if none are loaded yet — the page can be opened
      // directly without going through ATP screens first.
      if (!product.currentProductStore?.productStoreId) {
        try {
          await product.fetchUserProductStores();
          const stores = product.getProductStores;
          if (stores && stores.length) {
            product.setCurrentProductStore(stores[0]);
          }
        } catch (err) {
          logger.error("Failed to fetch product stores for facility groups", err);
        }
      }
      const productStoreId = product.currentProductStore?.productStoreId;
      if (!productStoreId) {
        this.groups = [];
        return;
      }
      try {
        const resp = await api({
          url: `admin/productStores/${productStoreId}/facilityGroups`,
          method: "GET",
          params: { productStoreId, pageSize: 200 }
        }) as any;
        if (!commonUtil.hasError(resp)) {
          this.groups = resp.data || [];
        } else {
          throw resp.data;
        }
      } catch (err) {
        logger.error("Failed to fetch facility groups", err);
        this.groups = [];
      }
      // Fetch facility counts in parallel for each group
      await Promise.allSettled(this.groups.map((g: any) => this.fetchGroupFacilities(g.facilityGroupId)));
    },
    async fetchGroupFacilities(facilityGroupId: string) {
      try {
        const resp = await api({
          url: `admin/facilityGroups/${facilityGroupId}/facilities`,
          method: "GET",
          params: { facilityGroupId, pageSize: 200 }
        }) as any;
        if (!commonUtil.hasError(resp)) {
          const data = (resp.data || []).filter((f: any) =>
            f.facilityTypeId !== "VIRTUAL_FACILITY" &&
            f.parentFacilityTypeId !== "VIRTUAL_FACILITY" &&
            f.facilityTypeId !== "CONFIGURATION"
          );
          this.facilitiesByGroup[facilityGroupId] = data;
        }
      } catch (err) {
        logger.error("Failed to fetch group facilities", err);
      }
    },
    async fetchGroupTypes() {
      // Moqui does not expose a generic facility-group-types list endpoint, so we
      // ship the well-known types used by the app and merge in any custom types
      // discovered on already-fetched groups.
      const known = [
        { facilityGroupTypeId: "FACILITY_GROUP", description: "Generic" },
        { facilityGroupTypeId: "CHANNEL_FAC_GROUP", description: "Inventory channel" },
        { facilityGroupTypeId: "PICKUP", description: "Store pickup" },
        { facilityGroupTypeId: "SHIPPING", description: "Shipping" },
        { facilityGroupTypeId: "WAREHOUSE", description: "Warehouse" }
      ];
      const seen = new Set(known.map((t) => t.facilityGroupTypeId));
      const fromGroups = this.groups
        .map((g: any) => g.facilityGroupTypeId)
        .filter((id: string | undefined): id is string => !!id && !seen.has(id))
        .map((id: string) => ({ facilityGroupTypeId: id, description: id }));
      this.groupTypes = [...known, ...fromGroups];
    },
    async createGroup(payload: any) {
      const product = useAtpProductStore();
      const productStoreId = product.currentProductStore?.productStoreId;
      const resp = await api({
        url: "admin/facilityGroups",
        method: "POST",
        data: payload
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      // Associate to current product store so it appears in subsequent fetches
      if (productStoreId && resp?.data?.facilityGroupId) {
        try {
          await api({
            url: `admin/productStores/${productStoreId}/facilityGroups/${resp.data.facilityGroupId}/association`,
            method: "POST",
            data: { productStoreId, facilityGroupId: resp.data.facilityGroupId }
          });
        } catch (err) {
          logger.error("Failed to associate new group with product store", err);
        }
      }
      return resp.data;
    },
    async updateGroup(payload: any) {
      const resp = await api({
        url: `admin/facilityGroups/${payload.facilityGroupId}`,
        method: "PUT",
        params: payload
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      // Patch local copy
      const idx = this.groups.findIndex((g: any) => g.facilityGroupId === payload.facilityGroupId);
      if (idx >= 0) this.groups[idx] = { ...this.groups[idx], ...payload };
      return resp.data;
    },
    async archiveGroup(facilityGroupId: string) {
      // The OMS treats thruDate < now as archived. Set it to now.
      const thruDate = Date.now();
      const resp = await api({
        url: `admin/facilityGroups/${facilityGroupId}`,
        method: "PUT",
        params: { facilityGroupId, thruDate }
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      this.groups = this.groups.filter((g: any) => g.facilityGroupId !== facilityGroupId);
      delete this.facilitiesByGroup[facilityGroupId];
    },
    async addFacility(facilityGroupId: string, facilityId: string) {
      const resp = await api({
        url: `admin/facilityGroups/${facilityGroupId}/facilities/${facilityId}/association`,
        method: "POST",
        data: { facilityGroupId, facilityId }
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      await this.fetchGroupFacilities(facilityGroupId);
    },
    async removeFacility(facilityGroupId: string, facilityId: string) {
      // The same association endpoint with a thruDate < now de-associates
      const resp = await api({
        url: `admin/facilityGroups/${facilityGroupId}/facilities/${facilityId}/association`,
        method: "POST",
        data: { facilityGroupId, facilityId, thruDate: Date.now() }
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      await this.fetchGroupFacilities(facilityGroupId);
    }
  },
  persist: false
});
