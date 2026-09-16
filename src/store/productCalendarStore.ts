import { defineStore } from "pinia";
import { api, commonUtil, logger } from "@common";

const responseRows = (response: any): any[] => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.docs)) return response.data.docs;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

export const CALENDAR_MAPPING_TYPE = "SHOPIFY_PRODUCT_CALENDAR_DATE";

export const useProductCalendarStore = defineStore("productCalendar", {
  state: () => ({
    rows: [] as any[],
    shops: [] as any[],
    mappings: [] as any[],
    loading: false,
    lastPopulated: null as any
  }),
  actions: {
    async fetchCalendar(productStoreId: string) {
      if (!productStoreId) { this.rows = []; return []; }
      this.loading = true;
      try {
        const response = await api({
          url: "/oms/productStoreProductCalendar",
          method: "GET",
          params: { productStoreId, pageSize: 500, orderByField: "productId" }
        }) as any;
        if (commonUtil.hasError(response)) throw response.data;
        this.rows = responseRows(response);
      } catch (error) {
        logger.error("Failed to fetch ProductStoreProductCalendar", error);
        this.rows = [];
      } finally { this.loading = false; }
      return this.rows;
    },
    async populate(productStoreId: string) {
      const response = await api({
        url: "/oms/productStoreProductCalendar/populate",
        method: "POST",
        data: { productStoreId }
      }) as any;
      if (commonUtil.hasError(response)) throw response.data;
      this.lastPopulated = response.data;
      await this.fetchCalendar(productStoreId);
      return response.data;
    },
    async fetchShops(productStoreId: string) {
      const response = await api({
        url: "/sob/shopify/shops",
        method: "GET",
        params: { productStoreId, pageSize: 200 }
      }) as any;
      if (commonUtil.hasError(response)) throw response.data;
      this.shops = responseRows(response);
      return this.shops;
    },
    async fetchMappings(shopId?: string) {
      const response = await api({
        url: "/sob/shopify/typeMappings",
        method: "GET",
        params: { mappedTypeId: CALENDAR_MAPPING_TYPE, ...(shopId ? { shopId } : {}), pageSize: 500 }
      }) as any;
      if (commonUtil.hasError(response)) throw response.data;
      this.mappings = responseRows(response);
      return this.mappings;
    },
    async saveMapping(mapping: any) {
      const response = await api({
        url: "/sob/shopify/typeMappings",
        method: "POST",
        data: { ...mapping, mappedTypeId: CALENDAR_MAPPING_TYPE }
      }) as any;
      if (commonUtil.hasError(response)) throw response.data;
      await this.fetchMappings();
      return response.data;
    },
    clear() {
      this.rows = [];
      this.shops = [];
      this.mappings = [];
      this.lastPopulated = null;
    }
  }
});
