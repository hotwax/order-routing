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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export function useProductFacility() {
  // Per-instance state. These refs were previously module-level singletons shared across every
  // caller, so the Inventory detail view (which fetches a single product) overwrote the Inventory
  // list view's results — returning to the list then showed only that one row. Each consumer now
  // gets isolated state, so a single component must take both the ref and the fetcher from the
  // same useProductFacility() call.
  const productFacility: Ref<ProductFacility[]> = ref([] as ProductFacility[])
  const inventoryLogs: Ref<any[]> = ref([])
  let productFacilityRequestId = 0
  let inventoryLogsRequestId = 0

  async function fetchProductFacility(payload: any): Promise<number | undefined> {
    const requestId = ++productFacilityRequestId
    try {
      const resp = await api({
        url: "oms/productFacilities/search",
        method: "GET",
        params: payload
      }) as any

      if(requestId !== productFacilityRequestId) {return undefined}
      productFacility.value = resp.data?.products ?? []

      return resp.data?.totalCount ?? 0
    } catch (err) {
      logger.error("Failed to fetch product facility records", getErrorMessage(err))
      if(requestId !== productFacilityRequestId) {return undefined}
      productFacility.value = []

      return 0
    }
  }

  function clearProductFacility() {
    productFacilityRequestId += 1
    productFacility.value = []
  }

  async function updateProductFacility(payload: any) {
    try {
      await api({
        url: "oms/productFacilities",
        method: "POST",
        data: payload
      })
    } catch (err) {
      logger.error("Failed to update product facility records", err);
      throw err;
    }
    }
  }

  async function fetchInventoryLogs(params: { productId: string, facilityId: string, pageSize: any }) {
    const requestId = ++inventoryLogsRequestId
    try {
      const resp = await api({
        url: "oms/inventoryItem/detail",
        method: "GET",
        params: {
          ...params,
          orderByField: "effectiveDate desc"
        }
      })

      if(requestId === inventoryLogsRequestId) {inventoryLogs.value = resp.data}
    } catch (err) {
      logger.error("Failed to fetch product facility inventory logs", getErrorMessage(err))
      if(requestId === inventoryLogsRequestId) {inventoryLogs.value = []}
    }
  }

  function clearInventoryLogs() {
    inventoryLogsRequestId += 1
    inventoryLogs.value = []
  }

  return {
    productFacility,
    clearProductFacility,
    clearInventoryLogs,
    fetchInventoryLogs,
    fetchProductFacility,
    inventoryLogs,
    updateProductFacility
  }
}
