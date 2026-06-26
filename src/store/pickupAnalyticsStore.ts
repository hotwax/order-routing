import { defineStore } from "pinia";
import { api, commonUtil, logger } from "@common";
import { DateTime } from "luxon";
import { useAtpProductStore } from "@/store/atpProductStore";

export interface SparklineEntry {
  date: string;
  count: number;
}

export interface PickupProductStat {
  productId: string;
  productName: string;
  imageUrl: string;
  orderCount: number;
  daily: SparklineEntry[];
  goodIdentifications?: string[];
  internalName?: string;
}

export interface PickupFacilityStat {
  facilityId: string;
  facilityName: string;
  orderCount: number;
  daily: SparklineEntry[];
}

interface PickupAnalyticsState {
  loading: boolean;
  topProducts: PickupProductStat[];
  topFacilities: PickupFacilityStat[];
  facilityOrderCounts: Record<string, number>;
  facilityCountsLoading: boolean;
}

export const usePickupAnalyticsStore = defineStore("pickupAnalytics", {
  state: (): PickupAnalyticsState => ({
    loading: false,
    topProducts: [],
    topFacilities: [],
    facilityOrderCounts: {},
    facilityCountsLoading: false,
  }),
  getters: {
    getFacilityOrderCount: (state) => (facilityId: string) => state.facilityOrderCounts[facilityId] || 0,
  },
  actions: {
    async loadAnalytics() {
      const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
      if (!productStoreId) return;

      this.loading = true;
      await Promise.allSettled([
        this.loadTopProducts(productStoreId),
        this.loadTopFacilities(productStoreId)
      ]);
      this.loading = false;
    },

    buildDateRange() {
      const now = DateTime.now();
      const start = now.minus({ days: 29 }).startOf("day").toUTC().toISO({ suppressMilliseconds: true });
      const end = now.plus({ days: 1 }).startOf("day").toUTC().toISO({ suppressMilliseconds: true });
      return { start, end };
    },

    async loadTopProducts(productStoreId: string) {
      try {
        const { start, end } = this.buildDateRange();

        const resp = await api({
          url: "admin/runSolrQuery",
          method: "POST",
          data: {
            "json": {
              "params": { "rows": "0" },
              "query": "*:*",
              "filter": `docType: ORDER AND orderTypeId: SALES_ORDER AND shipmentMethodTypeId: STOREPICKUP AND productStoreId: ${productStoreId} AND orderDate: [${start} TO ${end}]`,
              "facet": {
                "top_products": {
                  "type": "terms",
                  "field": "productId",
                  "limit": 10,
                  "facet": {
                    "product_name": {
                      "type": "terms",
                      "field": "productName",
                      "limit": 1
                    },
                    "daily": {
                      "type": "range",
                      "field": "orderDate",
                      "start": start,
                      "end": end,
                      "gap": "+1DAY"
                    }
                  }
                }
              }
            }
          }
        }) as any;

        const facets = resp.data?.facets || resp.data?.response?.facets;
        if (!commonUtil.hasError(resp) && facets?.top_products?.buckets) {
          const buckets = facets.top_products.buckets;
          const allIds = buckets.map((b: any) => b.val);
          const productInfo = allIds.length
            ? await this.fetchProductInfo(allIds, productStoreId)
            : {};

          this.topProducts = buckets.map((bucket: any) => ({
            productId: bucket.val,
            productName: bucket.product_name?.buckets?.[0]?.val || productInfo[bucket.val]?.name || bucket.val,
            imageUrl: productInfo[bucket.val]?.imageUrl || "",
            orderCount: bucket.count,
            daily: this.parseDailyBuckets(bucket.daily?.buckets),
            goodIdentifications: productInfo[bucket.val]?.goodIdentifications || [],
            internalName: productInfo[bucket.val]?.internalName || ""
          }));
        }
      } catch (err) {
        logger.error("pickupAnalytics: failed to load top products", err);
      }
    },

    async loadTopFacilities(productStoreId: string) {
      try {
        const { start, end } = this.buildDateRange();

        // Pickup analytics should only reflect physical facilities, never virtual ones,
        // so scope the facet to the store's physical facilities.
        const facilities = await this.fetchPhysicalFacilities(productStoreId);
        if (!facilities.length) {
          this.topFacilities = [];
          return;
        }

        const nameMap: Record<string, string> = {};
        for (const f of facilities) nameMap[f.facilityId] = f.facilityName || f.facilityId;
        const facilityIds = facilities.map((f: any) => f.facilityId);

        const resp = await api({
          url: "admin/runSolrQuery",
          method: "POST",
          data: {
            "json": {
              "params": { "rows": "0" },
              "query": "*:*",
              "filter": `docType: ORDER AND orderTypeId: SALES_ORDER AND shipmentMethodTypeId: STOREPICKUP AND productStoreId: ${productStoreId} AND orderDate: [${start} TO ${end}] AND facilityId:(${facilityIds.join(" OR ")})`,
              "facet": {
                "top_facilities": {
                  "type": "terms",
                  "field": "facilityId",
                  "limit": 10,
                  "facet": {
                    "facility_name": {
                      "type": "terms",
                      "field": "facilityName",
                      "limit": 1
                    },
                    "daily": {
                      "type": "range",
                      "field": "orderDate",
                      "start": start,
                      "end": end,
                      "gap": "+1DAY"
                    }
                  }
                }
              }
            }
          }
        }) as any;

        const facets = resp.data?.facets || resp.data?.response?.facets;
        if (!commonUtil.hasError(resp) && facets?.top_facilities?.buckets) {
          const buckets = facets.top_facilities.buckets;

          this.topFacilities = buckets.map((bucket: any) => ({
            facilityId: bucket.val,
            facilityName: bucket.facility_name?.buckets?.[0]?.val || nameMap[bucket.val] || bucket.val,
            orderCount: bucket.count,
            daily: this.parseDailyBuckets(bucket.daily?.buckets)
          }));
        }
      } catch (err) {
        logger.error("pickupAnalytics: failed to load top facilities", err);
      }
    },

    // Pickup order counts per facility over the last 30 days. Uses the exact same
    // filter and count metric as loadTopFacilities so the per-card numbers match the
    // "Top pickup facilities" widget; only the facet limit differs (all vs top 10).
    async loadFacilityOrderCounts(productStoreId?: string) {
      const storeId = productStoreId || useAtpProductStore().currentProductStore?.productStoreId;
      if (!storeId) return;

      this.facilityCountsLoading = true;
      try {
        const { start, end } = this.buildDateRange();
        const resp = await api({
          url: "admin/runSolrQuery",
          method: "POST",
          data: {
            "json": {
              "params": { "rows": "0" },
              "query": "*:*",
              "filter": `docType: ORDER AND orderTypeId: SALES_ORDER AND shipmentMethodTypeId: STOREPICKUP AND productStoreId: ${storeId} AND orderDate: [${start} TO ${end}]`,
              "facet": {
                "facilities": {
                  "type": "terms",
                  "field": "facilityId",
                  "limit": 1000
                }
              }
            }
          }
        }) as any;

        const facets = resp.data?.facets || resp.data?.response?.facets;
        const counts: Record<string, number> = {};
        if (!commonUtil.hasError(resp) && facets?.facilities?.buckets) {
          for (const bucket of facets.facilities.buckets) {
            counts[bucket.val] = bucket.count;
          }
        }
        this.facilityOrderCounts = counts;
      } catch (err) {
        logger.error("pickupAnalytics: failed to load facility order counts", err);
      }
      this.facilityCountsLoading = false;
    },

    parseDailyBuckets(buckets: any[]): SparklineEntry[] {
      if (!buckets?.length) return [];
      return buckets.map((b: any) => ({
        date: typeof b.val === "string" ? b.val : DateTime.fromMillis(b.val).toISODate() || "",
        count: b.count || 0
      }));
    },

    async fetchPhysicalFacilities(productStoreId: string): Promise<any[]> {
      try {
        const resp = await api({
          url: `admin/productStores/${productStoreId}/facilities`,
          method: "GET",
          params: {
            productStoreId,
            parentFacilityTypeId: "VIRTUAL_FACILITY",
            parentFacilityTypeId_not: "Y",
            facilityTypeId: "VIRTUAL_FACILITY",
            facilityTypeId_not: "Y",
            pageSize: 250
          }
        }) as any;
        if (!commonUtil.hasError(resp) && resp.data?.length) {
          return resp.data;
        }
      } catch (err) {
        logger.error("pickupAnalytics: failed to fetch facilities", err);
      }
      return [];
    },

    async fetchProductInfo(productIds: string[], productStoreId: string): Promise<Record<string, { name: string; imageUrl: string; goodIdentifications: string[]; internalName: string }>> {
      const infoMap: Record<string, { name: string; imageUrl: string; goodIdentifications: string[]; internalName: string }> = {};
      try {
        const resp = await api({
          url: "admin/runSolrQuery",
          method: "POST",
          data: {
            "json": {
              "params": { "rows": String(productIds.length) },
              "query": `productId:(${productIds.join(" OR ")})`,
              "filter": `docType: PRODUCT`,
              "fields": "productId,productName,mainImageUrl,goodIdentifications,internalName"
            }
          }
        }) as any;
        const docs = resp.data?.response?.docs || resp.data?.docs || [];
        for (const doc of docs) {
          if (doc.productId && !infoMap[doc.productId]) {
            infoMap[doc.productId] = {
              name: doc.productName || "",
              imageUrl: doc.mainImageUrl || "",
              goodIdentifications: doc.goodIdentifications || [],
              internalName: doc.internalName || ""
            };
          }
        }
      } catch (err) {
        logger.error("pickupAnalytics: failed to fetch product info", err);
      }
      return infoMap;
    }
  }
});
