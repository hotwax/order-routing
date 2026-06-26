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
}

export const usePickupAnalyticsStore = defineStore("pickupAnalytics", {
  state: (): PickupAnalyticsState => ({
    loading: false,
    topProducts: [],
    topFacilities: [],
  }),
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
            daily: this.parseDailyBuckets(bucket.daily?.buckets)
          }));
        }
      } catch (err) {
        logger.error("pickupAnalytics: failed to load top products", err);
      }
    },

    async loadTopFacilities(productStoreId: string) {
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
          const unresolvedIds = buckets
            .filter((b: any) => !b.facility_name?.buckets?.[0]?.val)
            .map((b: any) => b.val);

          const nameMap = unresolvedIds.length
            ? await this.fetchFacilityNames(unresolvedIds, productStoreId)
            : {};

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

    parseDailyBuckets(buckets: any[]): SparklineEntry[] {
      if (!buckets?.length) return [];
      return buckets.map((b: any) => ({
        date: typeof b.val === "string" ? b.val : DateTime.fromMillis(b.val).toISODate() || "",
        count: b.count || 0
      }));
    },

    async fetchFacilityNames(facilityIds: string[], productStoreId: string): Promise<Record<string, string>> {
      const nameMap: Record<string, string> = {};
      try {
        const resp = await api({
          url: `admin/productStores/${productStoreId}/facilities`,
          method: "GET",
          params: { pageSize: 250 }
        }) as any;
        if (!commonUtil.hasError(resp) && resp.data?.length) {
          for (const f of resp.data) {
            if (facilityIds.includes(f.facilityId)) {
              nameMap[f.facilityId] = f.facilityName || f.facilityId;
            }
          }
        }
      } catch (err) {
        logger.error("pickupAnalytics: failed to fetch facility names", err);
      }
      return nameMap;
    },

    async fetchProductInfo(productIds: string[], productStoreId: string): Promise<Record<string, { name: string; imageUrl: string }>> {
      const infoMap: Record<string, { name: string; imageUrl: string }> = {};
      try {
        const resp = await api({
          url: "admin/runSolrQuery",
          method: "POST",
          data: {
            "json": {
              "params": { "rows": String(productIds.length) },
              "query": `productId:(${productIds.join(" OR ")})`,
              "filter": `docType: ORDER AND productStoreId: ${productStoreId}`,
              "fields": "productId,productName,mainImageUrl"
            }
          }
        }) as any;
        const docs = resp.data?.response?.docs || resp.data?.docs || [];
        for (const doc of docs) {
          if (doc.productId && !infoMap[doc.productId]) {
            infoMap[doc.productId] = {
              name: doc.productName || "",
              imageUrl: doc.mainImageUrl || ""
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
