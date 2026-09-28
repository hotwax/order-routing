import { api, logger } from "@common"
import { ref } from "vue"

export interface AverageCost {
  averageCost?: number | string
  productAverageCostTypeId?: string
  fromDate?: number | string
}

export interface CycleCountAudit {
  workEffortId?: string
  countedByUserLoginId?: string
  acceptedByUserLoginId?: string
  decisionReasonEnumId?: string
  countedDate?: number | string
  acceptedDate?: number | string
}

export interface ReturnAudit {
  orderId?: string
  orderName?: string
  returnReasonId?: string
  reasonDescription?: string
  reason?: string
  returnTypeId?: string
  returnQuantity?: number | string
  receivedQuantity?: number | string
}

export interface VarianceAudit {
  changeByUserLoginId?: string
  varianceReasonId?: string
  comments?: string
  quantityOnHandVar?: number | string
  availableToPromiseVar?: number | string
}

const WEIGHTED_AVG_COST_TYPE = "WEIGHTED_AVG_COST"
const VARIANCE_DECISION_DOC = "InventoryVarianceDecisionDetail"

export function formatUserName(row: any): string {
  if (!row) return ""
  const group = (row.groupName || "").trim()
  if (group) return group
  return [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ").trim()
}

export function useInventory() {
  // Caches for the audits and costs
  const averageCostCache: Record<string, AverageCost | null> = {}
  const cycleCountCache: Record<string, CycleCountAudit | null> = {}
  const varianceCache: Record<string, VarianceAudit | null> = {}
  // Keyed by returnId: one fetch carries every item on the return, so sibling rows reuse it.
  const returnCache: Record<string, any> = {}

  // User name resolution cache and state
  const names = ref<Record<string, string>>({})

  async function fetchAverageCost(productId: string, facilityId: string): Promise<AverageCost | null> {
    if (!productId || !facilityId) return null
    const key = `${productId}::${facilityId}`
    if (key in averageCostCache) return averageCostCache[key]

    let result: AverageCost | null = null
    try {
      const resp = await api({
        url: "/oms/products/averageCosts",
        method: "GET",
        params: {
          productId,
          facilityId,
          productAverageCostTypeId: WEIGHTED_AVG_COST_TYPE,
          orderByField: "-fromDate",
          pageSize: 1
        }
      }) as any

      const row = Array.isArray(resp?.data) ? resp.data[0] : (resp?.data?.list?.[0] ?? null)
      if (row && (row.averageCost !== undefined && row.averageCost !== null)) {
        result = {
          averageCost: row.averageCost,
          productAverageCostTypeId: row.productAverageCostTypeId,
          fromDate: row.fromDate
        }
      }
    } catch (err) {
      logger.error("Average cost lookup failed", err)
    }

    averageCostCache[key] = result
    return result
  }

  async function fetchCycleCountAudit(physicalInventoryId: string): Promise<CycleCountAudit | null> {
    if (!physicalInventoryId) return null
    if (physicalInventoryId in cycleCountCache) return cycleCountCache[physicalInventoryId]

    let audit: CycleCountAudit | null = null
    try {
      const resp = await api({
        url: "oms/dataDocumentView",
        method: "POST",
        data: {
          dataDocumentId: VARIANCE_DECISION_DOC,
          pageIndex: 0,
          pageSize: 1,
          customParametersMap: { physicalInventoryId }
        }
      }) as any

      const item = resp?.data?.entityValueList?.[0]
        ?? resp?.data?.list?.[0]
        ?? (Array.isArray(resp?.data) ? resp.data[0] : null)

      if (item) {
        audit = {
          workEffortId: item.workEffortId,
          countedByUserLoginId: item.countedByUserLoginId,
          acceptedByUserLoginId: item.decidedByUserLoginId,
          decisionReasonEnumId: item.decisionReasonEnumId,
          acceptedDate: item.decidedDateTime ?? item.lastUpdatedStamp
        }

        if (!audit.acceptedByUserLoginId && audit.workEffortId) {
          try {
            const rev = await api({
              url: `inventory-cycle-count/cycleCounts/workEfforts/${audit.workEffortId}/reviews`,
              method: "GET"
            }) as any
            const review = (Array.isArray(rev?.data) ? rev.data[0] : rev?.data?.reviews?.[0]) ?? null
            if (review) {
              audit.acceptedByUserLoginId = review.reviewedByUserLoginId ?? review.approvedByUserLoginId ?? review.createdByUserLogin
              audit.acceptedDate = audit.acceptedDate ?? review.reviewedDate ?? review.lastUpdatedStamp
            }
          } catch (reviewErr) {
            logger.error("Cycle-count review lookup failed", reviewErr)
          }
        }
      }
    } catch (err) {
      logger.error("Cycle-count audit lookup failed", err)
    }

    cycleCountCache[physicalInventoryId] = audit
    return audit
  }

  async function fetchVarianceAudit(inventoryItemId: string, physicalInventoryId: string): Promise<VarianceAudit | null> {
    if (!inventoryItemId || !physicalInventoryId) return null
    // Key by both ids: one physical-inventory session can hold variances for several inventory
    // items (e.g. sibling variants opened in the same detail view), so caching by
    // physicalInventoryId alone would serve the first item's actor/comments for the rest.
    const cacheKey = `${inventoryItemId}::${physicalInventoryId}`
    if (cacheKey in varianceCache) return varianceCache[cacheKey]

    let result: VarianceAudit | null = null
    try {
      const resp = await api({
        url: `/oms/inventoryItem/${encodeURIComponent(inventoryItemId)}/variances`,
        method: "GET",
        params: { physicalInventoryId, pageSize: 1 }
      }) as any

      const row = Array.isArray(resp?.data) ? resp.data[0] : (resp?.data?.list?.[0] ?? null)
      if (row) {
        result = {
          changeByUserLoginId: row.changeByUserLoginId,
          varianceReasonId: row.varianceReasonId,
          comments: row.comments,
          quantityOnHandVar: row.quantityOnHandVar,
          availableToPromiseVar: row.availableToPromiseVar
        }
      }
    } catch (err) {
      logger.error("Variance audit lookup failed", err)
    }

    varianceCache[cacheKey] = result
    return result
  }

  async function resolveNames(ids: Array<string | undefined>): Promise<void> {
    const missing = [...new Set((ids || []).filter(Boolean).map(String))].filter((id) => !(id in names.value))
    if (!missing.length) return

    const pending = { ...names.value }
    missing.forEach((id) => { pending[id] = "" })
    names.value = pending

    try {
      const resp = await api({
        url: "/oms/users",
        method: "GET",
        params: {
          userLoginId: missing,
          userLoginId_op: "in",
          fieldsToSelect: ["userLoginId", "firstName", "middleName", "lastName", "groupName"],
          pageSize: missing.length
        }
      }) as any

      if (Array.isArray(resp?.data) && resp.data.length) {
        const resolved = { ...names.value }
        resp.data.forEach((row: any) => {
          if (row?.userLoginId) resolved[String(row.userLoginId)] = formatUserName(row)
        })
        names.value = resolved
      }
    } catch (err) {
      logger.error("User name resolution failed", err)
    }
  }

  function displayName(id?: string): string {
    if (!id) return "-"
    return names.value[id] || id
  }

  async function fetchReturnAudit(returnId: string, returnItemSeqId?: string): Promise<ReturnAudit | null> {
    if (!returnId) return null

    // sob/returns/{returnId} is served by the Shopify OMS bridge, not core OMS. Where that connector
    // is not deployed it answers 404/405 (see order-manager's RETURN_DETAIL_UNAVAILABLE), so a miss
    // is an expected deployment difference rather than an error: cache the null and show nothing.
    if (!(returnId in returnCache)) {
      try {
        const resp = await api({ url: `sob/returns/${encodeURIComponent(returnId)}`, method: "GET" }) as any
        returnCache[returnId] = resp?.data ?? null
      } catch (err) {
        logger.error("Return audit lookup failed", err)
        returnCache[returnId] = null
      }
    }

    const payload = returnCache[returnId]
    if (!payload) return null

    const header = payload.returnDetail || {}
    const items = Array.isArray(payload.items) ? payload.items : []
    // Match the line this movement actually received; fall back to the only item when the row
    // carries no sequence, so a single-line return still resolves.
    const item = items.find((row: any) => String(row?.returnItemSeqId) === String(returnItemSeqId))
      ?? (items.length === 1 ? items[0] : null)

    return {
      orderId: item?.orderId || header.orderId,
      orderName: header.orderName || header.externalOrderId,
      returnReasonId: item?.returnReasonId,
      reasonDescription: item?.reasonDescription,
      reason: item?.reason,
      returnTypeId: item?.returnTypeId,
      returnQuantity: item?.returnQuantity,
      receivedQuantity: item?.receivedQuantity
    }
  }

  // Batch resolver for the collapsed list: one fetch per distinct return, in parallel, so a history
  // page paints with order names rather than bare return ids. Capped because sob/returns has no bulk
  // form — beyond the cap those rows simply keep showing their returnId.
  async function fetchReturnSummaries(returnIds: Array<string>, limit = 20): Promise<Record<string, ReturnAudit>> {
    const ids = [...new Set((returnIds || []).filter(Boolean))].slice(0, limit)
    const summaries: Record<string, ReturnAudit> = {}
    if (!ids.length) return summaries

    const results = await Promise.all(ids.map(async (returnId) => [returnId, await fetchReturnAudit(returnId)] as const))
    results.forEach(([returnId, audit]) => {
      if (audit) summaries[returnId] = audit
    })

    return summaries
  }

  return {
    names,
    fetchAverageCost,
    fetchCycleCountAudit,
    fetchReturnAudit,
    fetchReturnSummaries,
    fetchVarianceAudit,
    resolveNames,
    displayName
  }
}
