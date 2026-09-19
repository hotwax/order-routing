import { api, logger } from "@common"
import { Ref, ref } from "vue"

interface ProductFacility {
  productId: string;
  facilityId: string;
  productName?: string;
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

/**
 * Keep the legacy nested config fields available while consumers move to the direct inventory view.
 * ProductFacilityInventoryItemView exposes inventory values as flat aliases, whereas the older
 * search response nested them under inventoryConfig.
 */
export function normalizeProductFacilityRow(row: any) {
  const config = row?.inventoryConfig ?? {};
  const atp = config.atp ?? row?.availableToPromise ?? row?.computedInventoryCount ?? row?.computedLastInventoryCount;
  const qoh = config.qoh ?? row?.quantityOnHand ?? row?.lastInventoryCount;
  const minimumStock = config.minimumStock ?? row?.minimumStock;
  const allowPickup = row?.allowPickup ?? config.allowPickup;
  const allowBrokering = row?.allowBrokering ?? config.allowBrokering;
  const computedLastInventoryCount = row?.computedLastInventoryCount ?? config.computedLastInventoryCount ?? row?.computedInventoryCount ?? row?.availableToPromise;
  const lastInventoryCount = row?.lastInventoryCount ?? config.lastInventoryCount ?? row?.quantityOnHand;

  return {
    ...row,
    computedLastInventoryCount,
    lastInventoryCount,
    allowPickup,
    allowBrokering,
    inventoryConfig: {
      ...config,
      atp,
      qoh,
      minimumStock,
      allowPickup,
      allowBrokering,
      computedLastInventoryCount,
      lastInventoryCount,
    },
  };
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
        url: "oms/productFacilities/inventory",
        method: "GET",
        params: payload
      }) as any

      if(requestId !== productFacilityRequestId) {return undefined}
      const rows = Array.isArray(resp.data) ? resp.data : resp.data?.products ?? [];
      productFacility.value = rows.map(normalizeProductFacilityRow)

      return resp.data?.totalCount ?? rows.length
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
   * The list fetcher queries the entity instead of the legacy Solr-backed product search, so the
   * total is the facility's real row count and pages contain only configured ProductFacility rows.
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
      if(!Array.isArray(resp.data)) {throw new Error("Invalid inventory response")}
      const rows = resp.data
      const total = await resolveTotal(resp, path, params)
      if(requestId !== productFacilityRequestId) {return undefined}
      productFacility.value = rows

      return { rows, total }
    } catch (err) {
      logger.error("Failed to fetch product facility rows", getErrorMessage(err))
      if(requestId !== productFacilityRequestId) {return undefined}
      productFacility.value = []

      throw err
    }
  }

  /**
   * The entity-list total arrives as the X-Total-Count header. A browser can only read that header
   * cross-origin when the server lists it in Access-Control-Expose-Headers, so fall back to the
   * sibling /count resource (which returns the total in the body) when it is not readable.
   */
  async function resolveTotal(resp: any, path: string, params: any): Promise<number> {
    const header = resp?.headers?.["x-total-count"] ?? resp?.headers?.get?.("x-total-count")
    const parsed = Number(header)
    if(Number.isInteger(parsed) && parsed >= 0 && header !== null && header !== undefined && header !== "") {return parsed}
    const countResp = await api({ url: `${path}/count`, method: "GET", params }) as any
    const count = countResp?.data?.count
    if(count === null || count === undefined || count === "" || !Number.isInteger(Number(count)) || Number(count) < 0) {
      throw new Error("Invalid inventory count response")
    }
    return Number(count)
  }

  // Filtered inventory pages cannot prove that a ProductFacility configuration is absent.
  // One facility has at most one row per product, so each ID batch fits in one entity page.
  async function fetchConfiguredProductIds(facilityId: string, productIds: string[]): Promise<Set<string>> {
    const ids = [...new Set(productIds)]
    const configured = new Set<string>()
    for(let index = 0; index < ids.length; index += 50) {
      const batch = ids.slice(index, index + 50)
      const resp = await api({
        url: "oms/productFacilities", method: "GET",
        params: { facilityId, productId: batch.join(","), productId_op: "in", pageSize: batch.length, pageIndex: 0 }
      }) as any
      if(!Array.isArray(resp.data)) {throw new Error("Invalid configuration response")}
      resp.data.forEach((row: any) => configured.add(row.productId))
    }
    return configured
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
          orderByField: "createdStamp desc"
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
    fetchConfiguredProductIds,
    inventoryLogs,
    updateProductFacility
  }
}
