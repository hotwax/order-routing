import { api, logger } from "@common"
import { Ref, ref } from "vue"

interface ProductFacilityConfig {
  allowBrokering?: string | null;
  allowPickup?: string | null;
  atp?: string | number | null;
  qoh?: string | number | null;
  minimumStock?: string | number | null;
  daysToShip?: string | number | null;
  computedLastInventoryCount?: string | number | null;
  lastInventoryCount?: string | number | null;
  inventoryItemId?: string | null;
  maximumStock?: string | number | null;
  reorderQuantity?: string | number | null;
}

interface ProductFacility {
  productId: string;
  facilityId: string;
  inventoryConfig?: ProductFacilityConfig | null;
  inventoryItemId?: string | null;
  lastInventoryCount?: string | number | null;
  computedLastInventoryCount?: string | number | null;
  isChecked?: boolean;
}

export function useProductFacility() {
  // Per-instance state. These refs were previously module-level singletons shared across every
  // caller, so the Inventory detail view (which fetches a single product) overwrote the Inventory
  // list view's results — returning to the list then showed only that one row. Each consumer now
  // gets isolated state, so a single component must take both the ref and the fetcher from the
  // same useProductFacility() call.
  const productFacility: Ref<ProductFacility[]> = ref([] as ProductFacility[])
  const inventoryLogs: Ref<any[]> = ref([])

  async function fetchProductFacility(payload: any): Promise<number> {
    try {
      const resp = await api({
        url: "oms/productFacilities/search",
        method: "GET",
        params: payload
      }) as any

      productFacility.value = resp.data?.products ?? []
      return resp.data?.totalCount ?? 0
    } catch(err) {
      logger.error("Failed to fetch product facility records", err)
      productFacility.value = []
      return 0
    }
  }

  async function updateProductFacility(payload: any) {
    try {
      await api({
        url: "oms/productFacilities",
        method: "POST",
        data: payload
      })
    } catch(err) {
      logger.error("Updated product facility records", err)
    }
  }

  async function fetchInventoryLogs(params: { productId: string, facilityId: string, pageSize: any }) {
    try {
      const resp = await api({
        url: "oms/inventoryItem/detail",
        method: "GET",
        params: {
          ...params,
          orderByField: "effectiveDate desc"
        }
      })

      inventoryLogs.value = resp.data
    } catch(err) {
      logger.error("Failed to fetch product facility inventory logs", err)
    }
  }

  return {
    productFacility,
    fetchInventoryLogs,
    fetchProductFacility,
    inventoryLogs,
    updateProductFacility
  }
}
