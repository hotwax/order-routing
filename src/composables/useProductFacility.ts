import { api, logger } from "@common"
import { Ref, ref } from "vue"

interface ProductFacility {
  productId: string;
  facilityId: string;
  allowBrokering: string;
  allowPickup: string;
  minimumStock: string;
  computedLastInventoryCount: string;
  lastInventoryCount: string;
  maximumStock: string;
  inventoryItemId: string;
  isChecked: boolean;
  inventoryConfig?: {
    atp?: string | number | null;
    qoh?: string | number | null;
    minimumStock?: string | number | null;
    allowPickup?: string | null;
    allowBrokering?: string | null;
  };
  onlineAtp: string;
  // Aliases contributed by ProductFacilityInventoryItemView's optional InventoryItem join. Absent on
  // rows from the plain ProductFacility entity (channel scope), hence optional.
  availableToPromise?: number;
  quantityOnHand?: number;
  computedInventoryCount?: number;
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

  /**
   * ProductFacility-first listing: pages and sorts over the rows a facility actually has.
   *
   * The older fetchProductFacility() below calls oms/productFacilities/search, which pages a Solr
   * *product* result set and left-joins ProductFacility onto it — so its total is a product count
   * that does not vary by facility, and pages contain products the facility does not stock. These
   * endpoints query the entity instead, so the total is the facility's real row count.
   *
   * withInventory selects the view (adds availableToPromise / quantityOnHand / computedInventoryCount
   * from the optional InventoryItem join). Channel scope passes false: it shows online ATP sourced
   * separately and never needs the join.
   */
  async function fetchProductFacilityRows(params: any, { withInventory = true } = {}): Promise<{ rows: any[]; total: number } | undefined> {
    const requestId = ++productFacilityRequestId
    const path = withInventory ? "oms/productFacilities/inventory" : "oms/productFacilities"
    try {
      const resp = await api({ url: path, method: "GET", params }) as any

      if(requestId !== productFacilityRequestId) {return undefined}
      const rows = Array.isArray(resp.data) ? resp.data : []
      productFacility.value = rows

      return { rows, total: await resolveTotal(resp, path, params, rows.length) }
    } catch (err) {
      logger.error("Failed to fetch product facility rows", getErrorMessage(err))
      if(requestId !== productFacilityRequestId) {return undefined}
      productFacility.value = []

      return { rows: [], total: 0 }
    }
  }

  /**
   * The entity-list total arrives as the X-Total-Count header. A browser can only read that header
   * cross-origin when the server lists it in Access-Control-Expose-Headers, so fall back to the
   * sibling /count resource (which returns the total in the body) when it is not readable.
   */
  async function resolveTotal(resp: any, path: string, params: any, rowCount: number): Promise<number> {
    const header = resp?.headers?.["x-total-count"] ?? resp?.headers?.get?.("x-total-count")
    const parsed = Number(header)
    if(Number.isFinite(parsed) && header !== null && header !== undefined && header !== "") {return parsed}

    try {
      const countResp = await api({ url: `${path}/count`, method: "GET", params }) as any
      const count = Number(countResp?.data?.count)

      return Number.isFinite(count) ? count : rowCount
    } catch (err) {
      logger.error("Failed to fetch product facility count", getErrorMessage(err))

      return rowCount
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
      logger.error("Updated product facility records", getErrorMessage(err))
    }
  }

  // productId/facilityId are path segments, not query params. The backend dropped the unscoped
  // GET oms/inventoryItem/detail resource so InventoryItemDetail can never be scanned unfiltered;
  // both segments now scope the query server-side. The rows come from the InventoryItemDetailAndOrder
  // view, a strict superset of the old one (adds orderTypeId/orderName/orderDate/orderStatusId), so
  // every existing consumer of these rows is unaffected.
  async function fetchInventoryLogs(params: { productId: string, facilityId: string, pageSize: any }) {
    const requestId = ++inventoryLogsRequestId
    const { productId, facilityId, ...query } = params
    try {
      const resp = await api({
        url: `oms/products/${encodeURIComponent(productId)}/facilities/${encodeURIComponent(facilityId)}/inventoryDetail`,
        method: "GET",
        params: {
          ...query,
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
    fetchProductFacilityRows,
    inventoryLogs,
    updateProductFacility
  }
}
