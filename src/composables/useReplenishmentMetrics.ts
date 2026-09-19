import { api, logger, useSolrSearch } from "@common";
import { reactive } from "vue";
import {
  InventoryDetailRow,
  OrderSummary,
  TrendPoint,
  buildTrendPoints,
  calculatePurchaseOrderIncomingUnits,
  calculateSalesVelocity,
  calculateTransferOrderIncomingUnits,
} from "@/utils/replenishmentMetrics";

export interface ReplenishmentMetrics {
  loading: boolean;
  incomingLoading: boolean;
  incomingUnavailable: boolean;
  incomingUnits: number;
  salesVelocityUnitsPerDay: number;
  trendPoints: TrendPoint[];
}

export interface RefreshReplenishmentMetricsPayload {
  productId: string;
  facilityId: string;
  inventoryRows?: InventoryDetailRow[];
  now?: string | number;
  days?: number;
}

interface SolrOrderDoc extends OrderSummary {
  orderId: string;
}

function quoteSolrValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function searchDocuments(response: any): SolrOrderDoc[] {
  const result = response?.data;
  const groups = result?.grouped?.orderId?.groups;
  if(groups) {return groups.flatMap((group: any) => group.doclist.docs);}

  return result?.response?.docs ?? [];
}

function resetMetrics(metrics: ReplenishmentMetrics) {
  metrics.loading = false;
  metrics.incomingLoading = false;
  metrics.incomingUnavailable = false;
  metrics.incomingUnits = 0;
  metrics.salesVelocityUnitsPerDay = 0;
  metrics.trendPoints = [];
}

export function useReplenishmentMetrics() {
  const metrics = reactive<ReplenishmentMetrics>({
    loading: false,
    incomingLoading: false,
    incomingUnavailable: false,
    incomingUnits: 0,
    salesVelocityUnitsPerDay: 0,
    trendPoints: [],
  });
  const orderDetailCache = new Map<string, any>();
  let activeRefreshId = 0;

  async function fetchOrderSummaries(orderIds: string[]): Promise<Record<string, OrderSummary>> {
    const ids = [...new Set(orderIds.filter(Boolean))];
    if(!ids.length) {return {};}

    try {
      const response = await useSolrSearch().runSolrQuery({
        json: {
          params: {
            rows: ids.length,
            group: true,
            "group.field": "orderId",
            "group.limit": 1,
            "group.ngroups": true,
            "q.op": "AND",
            start: 0,
            fl: "orderId,orderTypeId",
            defType: "edismax",
          },
          query: "*:*",
          filter: `docType: ORDER AND orderId: (${ids.map(quoteSolrValue).join(" OR ")})`,
        },
      });
      return searchDocuments(response).reduce((summaries, doc) => {
        if(doc.orderId) {summaries[doc.orderId] = { orderId: doc.orderId, orderTypeId: doc.orderTypeId };}
        return summaries;
      }, {} as Record<string, OrderSummary>);
    } catch(error) {
      logger.error("Failed to fetch replenishment order summaries", error);
      return {};
    }
  }

  async function fetchIncomingCandidates(productId: string): Promise<SolrOrderDoc[]> {
    const response = await useSolrSearch().runSolrQuery({
      json: {
        params: {
          rows: 100,
          start: 0,
          fl: "orderId,orderTypeId",
          "q.op": "AND",
          defType: "edismax",
        },
        query: "*:*",
        filter: `docType: ORDER AND productId: ${quoteSolrValue(productId)} AND (orderTypeId: PURCHASE_ORDER OR orderTypeId: TRANSFER_ORDER) AND -orderStatusId: ORDER_CANCELLED AND -orderStatusId: ORDER_COMPLETED`,
      },
    });
    return searchDocuments(response).filter((order) => order.orderId && (order.orderTypeId === "PURCHASE_ORDER" || order.orderTypeId === "TRANSFER_ORDER"));
  }

  async function fetchOrderDetail(order: SolrOrderDoc): Promise<any> {
    if(orderDetailCache.has(order.orderId)) {return orderDetailCache.get(order.orderId);}

    const url = order.orderTypeId === "TRANSFER_ORDER"
      ? `oms/transferOrders/${order.orderId}`
      : `oms/purchaseOrders/${order.orderId}`;
    const response = await api({ url, method: "GET" });
    const detail = response?.data ?? response;
    orderDetailCache.set(order.orderId, detail);
    return detail;
  }

  async function refreshIncomingUnits(productId: string, facilityId: string, refreshId: number) {
    if(refreshId === activeRefreshId) {
      metrics.incomingLoading = true;
      metrics.incomingUnavailable = false;
    }
    try {
      const candidates = await fetchIncomingCandidates(productId);
      const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.orderId, candidate])).values()];
      const details = await Promise.all(uniqueCandidates.map(fetchOrderDetail));
      const incomingUnits = uniqueCandidates.reduce((total, order, index) => {
        const detail = details[index];
        if(order.orderTypeId === "PURCHASE_ORDER") {
          return total + calculatePurchaseOrderIncomingUnits(detail, productId, facilityId);
        }
        return total + calculateTransferOrderIncomingUnits(detail, productId, facilityId);
      }, 0);
      if(refreshId === activeRefreshId) {metrics.incomingUnits = incomingUnits;}
    } catch(error) {
      logger.error("Failed to refresh incoming replenishment units", error);
      if(refreshId === activeRefreshId) {
        metrics.incomingUnits = 0;
        metrics.incomingUnavailable = true;
      }
    } finally {
      if(refreshId === activeRefreshId) {metrics.incomingLoading = false;}
    }
  }

  async function refreshReplenishmentMetrics(payload: RefreshReplenishmentMetricsPayload) {
    const refreshId = ++activeRefreshId;
    if(!payload.productId || !payload.facilityId) {
      resetMetrics(metrics);
      return;
    }

    const inventoryRows = payload.inventoryRows ?? [];
    metrics.loading = true;
    metrics.trendPoints = buildTrendPoints(inventoryRows);
    try {
      const orderSummaries = await fetchOrderSummaries(inventoryRows.map((row) => String(row.orderId ?? "").trim()).filter(Boolean));
      if(refreshId !== activeRefreshId) {return;}
      metrics.salesVelocityUnitsPerDay = calculateSalesVelocity(inventoryRows, orderSummaries, payload.now ?? Date.now(), payload.days ?? 30);
      await refreshIncomingUnits(payload.productId, payload.facilityId, refreshId);
    } catch(error) {
      if(refreshId === activeRefreshId) {logger.error("Failed to refresh replenishment metrics", error);}
    } finally {
      if(refreshId === activeRefreshId) {metrics.loading = false;}
    }
  }

  function resetReplenishmentMetrics() {
    activeRefreshId += 1;
    resetMetrics(metrics);
  }

  return { metrics, refreshReplenishmentMetrics, resetReplenishmentMetrics };
}
