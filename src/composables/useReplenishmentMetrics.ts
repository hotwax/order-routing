import { api, logger } from "@common";
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

function solrDocs(response: any): SolrOrderDoc[] {
  const data = response?.data?.response ?? {};
  const grouped = data.grouped?.orderId?.groups?.flatMap((group: any) => group?.doclist?.docs ?? []) ?? [];
  return grouped.length ? grouped : data.response?.docs ?? data.docs ?? [];
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

  async function fetchOrderSummaries(orderIds: string[]): Promise<Record<string, OrderSummary>> {
    const ids = [...new Set(orderIds.filter(Boolean))];
    if(!ids.length) {return {};}

    try {
      const response = await api({
        url: "admin/search/query",
        method: "POST",
        data: {
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
      return solrDocs(response).reduce((summaries, doc) => {
        if(doc.orderId) {summaries[doc.orderId] = { orderId: doc.orderId, orderTypeId: doc.orderTypeId };}
        return summaries;
      }, {} as Record<string, OrderSummary>);
    } catch(error) {
      logger.error("Failed to fetch replenishment order summaries", error);
      return {};
    }
  }

  async function fetchIncomingCandidates(productId: string): Promise<SolrOrderDoc[]> {
    const response = await api({
      url: "admin/search/query",
      method: "POST",
      data: {
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
    return solrDocs(response).filter((order) => order.orderId && (order.orderTypeId === "PURCHASE_ORDER" || order.orderTypeId === "TRANSFER_ORDER"));
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

  async function refreshIncomingUnits(productId: string, facilityId: string) {
    metrics.incomingLoading = true;
    metrics.incomingUnavailable = false;
    try {
      const candidates = await fetchIncomingCandidates(productId);
      const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.orderId, candidate])).values()];
      const details = await Promise.all(uniqueCandidates.map(fetchOrderDetail));
      metrics.incomingUnits = uniqueCandidates.reduce((total, order, index) => {
        const detail = details[index];
        if(order.orderTypeId === "PURCHASE_ORDER") {
          return total + calculatePurchaseOrderIncomingUnits(detail, productId, facilityId);
        }
        return total + calculateTransferOrderIncomingUnits(detail, productId, facilityId);
      }, 0);
    } catch(error) {
      logger.error("Failed to refresh incoming replenishment units", error);
      metrics.incomingUnits = 0;
      metrics.incomingUnavailable = true;
    } finally {
      metrics.incomingLoading = false;
    }
  }

  async function refreshReplenishmentMetrics(payload: RefreshReplenishmentMetricsPayload) {
    if(!payload.productId || !payload.facilityId) {
      resetMetrics(metrics);
      return;
    }

    const inventoryRows = payload.inventoryRows ?? [];
    metrics.loading = true;
    metrics.trendPoints = buildTrendPoints(inventoryRows);
    try {
      const orderSummaries = await fetchOrderSummaries(inventoryRows.map((row) => String(row.orderId ?? "").trim()).filter(Boolean));
      metrics.salesVelocityUnitsPerDay = calculateSalesVelocity(inventoryRows, orderSummaries, payload.now ?? Date.now(), payload.days ?? 30);
      await refreshIncomingUnits(payload.productId, payload.facilityId);
    } catch(error) {
      logger.error("Failed to refresh replenishment metrics", error);
    } finally {
      metrics.loading = false;
    }
  }

  function resetReplenishmentMetrics() {
    resetMetrics(metrics);
  }

  return { metrics, refreshReplenishmentMetrics, resetReplenishmentMetrics };
}
