import { defineStore } from "pinia";
import { api, commonUtil, logger } from "@common";
import { useAtpProductStore } from "@/store/atpProductStore";
import { DateTime } from "luxon";

export interface FacilityGroupState {
  groups: any[];
  facilitiesByGroup: Record<string, any[]>;
  groupTypes: any[];
  groupProductStores: Record<string, any[]>;
}

// Optional, friendlier labels for type IDs that are well-known across HotWax apps.
// Anything else falls through to its raw ID.
const TYPE_LABELS: Record<string, string> = {
  BROKERING_GROUP: "Brokering",
  CHANNEL_FAC_GROUP: "Inventory channel",
  PICKUP: "Store pickup",
  FULFILLMENT: "Fulfillment",
  AUTO_CANCEL_CONFIG: "Auto cancel",
  SHIPPING_LABEL: "Shipping label"
};

export const useFacilityGroupStore = defineStore("facilityGroup", {
  state: (): FacilityGroupState => ({
    groups: [],
    facilitiesByGroup: {},
    groupTypes: [],
    groupProductStores: {}
  }),
  getters: {
    getGroups: (state) => state.groups,
    getGroupFacilities: (state) => (groupId: string) => state.facilitiesByGroup[groupId] || [],
    getGroupTypes: (state) => state.groupTypes,
    getGroupProductStores: (state) => (groupId: string) => state.groupProductStores[groupId] || []
  },
  actions: {
    async fetchGroups(options: { productStoreId?: string; facilityGroupTypeId?: string } = {}) {
      // Default: system-wide list of facility groups (used by the "use an existing
      // group" picker). Pass productStoreId to scope to groups linked to that store,
      // and/or facilityGroupTypeId to filter by type (e.g. BROKERING_GROUP).
      try {
        const params: any = { pageSize: 200 };
        let url = "/oms/facilityGroups";
        if (options.productStoreId) {
          url = `admin/productStores/${options.productStoreId}/facilityGroups`;
          params.productStoreId = options.productStoreId;
        }
        if (options.facilityGroupTypeId) params.facilityGroupTypeId = options.facilityGroupTypeId;
        const resp = await api({
          url,
          method: "GET",
          params
        }) as any;
        if (!commonUtil.hasError(resp)) {
          this.groups = (resp.data || []) as any[];
        } else {
          throw resp.data;
        }
      } catch (err) {
        logger.error("Failed to fetch facility groups", err);
        this.groups = [];
      }
      // Refresh derived type list from the live group data.
      this.deriveGroupTypes();
      // Fetch members for each group in parallel for counts/preview.
      await Promise.allSettled(this.groups.map((g: any) => this.fetchGroupFacilities(g.facilityGroupId)));
    },
    async fetchGroupFacilities(facilityGroupId: string) {
      try {
        const resp = await api({
          url: "/oms/groupFacilities",
          method: "GET",
          params: { facilityGroupId, pageSize: 500 }
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
    deriveGroupTypes() {
      // Build the type list from whatever types are actually in use on the loaded
      // groups, then merge in any well-known IDs that aren't present yet so users
      // can still create groups of those types.
      const seen = new Map<string, { facilityGroupTypeId: string; description: string }>();
      for (const g of this.groups) {
        const id: string | undefined = g.facilityGroupTypeId;
        if (!id || seen.has(id)) continue;
        seen.set(id, { facilityGroupTypeId: id, description: TYPE_LABELS[id] || id });
      }
      for (const id of Object.keys(TYPE_LABELS)) {
        if (!seen.has(id)) seen.set(id, { facilityGroupTypeId: id, description: TYPE_LABELS[id] });
      }
      this.groupTypes = [...seen.values()].sort((a, b) => a.description.localeCompare(b.description));
    },
    async fetchGroupTypes() {
      // Kept for API compatibility — types are derived from the loaded groups.
      this.deriveGroupTypes();
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
      // Optionally associate to the current product store so the group also shows
      // up in product-store-scoped views (e.g. inventory channels).
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
    async associateWithProductStore(facilityGroupId: string) {
      // Link an already-existing group to the current product store. Backs the
      // "use an existing group" empty-state action; mirrors the association call
      // that createGroup() performs for freshly created groups.
      const product = useAtpProductStore();
      const productStoreId = product.currentProductStore?.productStoreId;
      if (!productStoreId) throw new Error("No product store selected");
      const resp = await api({
        url: `admin/productStores/${productStoreId}/facilityGroups/${facilityGroupId}/association`,
        method: "POST",
        data: { productStoreId, facilityGroupId }
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      return resp.data;
    },
    async updateGroup(payload: any) {
      const resp = await api({
        url: `admin/facilityGroups/${payload.facilityGroupId}`,
        method: "PUT",
        params: payload
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      const idx = this.groups.findIndex((g: any) => g.facilityGroupId === payload.facilityGroupId);
      if (idx >= 0) this.groups[idx] = { ...this.groups[idx], ...payload };
      return resp.data;
    },
    async archiveGroup(group: any) {
      const thruDate = DateTime.now().toMillis();
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;

      const resp = await api({
        url: `admin/productStores/${productStoreId}/facilityGroups/${group.facilityGroupId}/association`,
        method: "POST",
        data: { productStoreId, facilityGroupId: group.facilityGroupId, fromDate: group.fromDate, thruDate }
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      this.groups = this.groups.filter((g: any) => g.facilityGroupId !== group.facilityGroupId);
      delete this.facilitiesByGroup[group.facilityGroupId];
      this.deriveGroupTypes();
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
    async removeFacility(facilityGroupId: string, facility: any) {
      const facilityId = facility.facilityId;
      const resp = await api({
        url: `admin/facilityGroups/${facilityGroupId}/facilities/${facilityId}/association`,
        method: "POST",
        data: { facilityGroupId, facilityId, fromDate: facility.fromDate, thruDate: DateTime.now().toMillis() }
      }) as any;
      if (commonUtil.hasError(resp)) throw resp.data;
      await this.fetchGroupFacilities(facilityGroupId);
    },
    async fetchGroupProductStoreAssociations() {
      const productStore = useAtpProductStore();
      if (!productStore.getProductStores.length) {
        await productStore.fetchUserProductStores();
      }

      const stores = productStore.getProductStores;
      if (!stores.length) return;

      const groupStoresMap: Record<string, any[]> = {};

      await Promise.allSettled(
        stores.map(async (store: any) => {
          try {
            const resp = await api({
              url: `admin/productStores/${store.productStoreId}/facilityGroups`,
              method: "GET",
              params: { pageSize: 100 }
            }) as any;
            if (resp && !commonUtil.hasError(resp) && resp.data) {
              for (const group of resp.data) {
                const groupId = group.facilityGroupId;
                if (groupId) {
                  if (!groupStoresMap[groupId]) {
                    groupStoresMap[groupId] = [];
                  }
                  const storeName = store.storeName || store.productStoreId;
                  if (!groupStoresMap[groupId].includes(storeName)) {
                    groupStoresMap[groupId].push(storeName);
                  }
                }
              }
            }
          } catch (err) {
            logger.error(`Failed to fetch facility groups for store ${store.productStoreId}`, err);
          }
        })
      );

      this.groupProductStores = groupStoresMap;
    }
  },
  persist: false
});
