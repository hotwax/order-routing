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
    if (physicalInventoryId in varianceCache) return varianceCache[physicalInventoryId]

    let result: VarianceAudit | null = null
    try {
      const resp = await api({
        url: "/oms/inventoryItemVariances",
        method: "GET",
        params: { inventoryItemId, physicalInventoryId, pageSize: 1 }
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

    varianceCache[physicalInventoryId] = result
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

  return {
    names,
    fetchAverageCost,
    fetchCycleCountAudit,
    fetchVarianceAudit,
    resolveNames,
    displayName
  }
}
