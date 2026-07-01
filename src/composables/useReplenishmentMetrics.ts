import { api, logger } from "@common";
import { reactive } from "vue";
import {
  InventoryDetailRow,
  OrderSummary,
  TrendPoint,
  buildTrendPoints,
  calculatePurchaseOrderIncomingUnits,
  calculateSalesVelocity,
  calculateTransferOrderIncomingUnits
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
  orderName?: string;
  orderStatusId?: string;
  orderStatusDesc?: string;
}

function quoteSolrValue(value: string): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function extractSolrDocs(response: any): SolrOrderDoc[] {
  const data = response?.data ?? response ?? {};
  const groupedDocs = data?.grouped?.orderId?.groups?.flatMap((group: any) => group?.doclist?.docs ?? []) ?? [];
  if (groupedDocs.length) return groupedDocs;

  return data?.response?.docs ?? data?.docs ?? [];
}

function toOrderSummaryMap(docs: SolrOrderDoc[]): Record<string, OrderSummary> {
  return docs.reduce((summaries, doc) => {
    if (doc.orderId) {
      summaries[doc.orderId] = {
        orderId: doc.orderId,
        orderTypeId: doc.orderTypeId
      };
    }

    return summaries;
  }, {} as Record<string, OrderSummary>);
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
    trendPoints: []
  });
  const orderDetailCache = new Map<string, Promise<any>>();

  async function fetchOrderSummaries(orderIds: string[]): Promise<Record<string, OrderSummary>> {
    const ids = [...new Set(orderIds.filter(Boolean))];
    if (!ids.length) return {};

    try {
      const response = await api({
        url: "admin/runSolrQuery",
        method: "POST",
        data: {
          json: {
            params: {
              rows: ids.length,
              group: true,
              "group.field": "orderId",
              "group.limit": 1,
              "group.ngroups": true,
              "q.op": "AND",
              start: 0,
              fl: "orderId,orderName,orderTypeId,orderStatusId,orderStatusDesc,orderDate,customerPartyName,facilityId,productId,quantity",
              defType: "edismax"
            },
            query: "*:*",
            filter: `docType: ORDER AND orderId: (${ids.map(quoteSolrValue).join(" OR ")})`
          }
        }
      });

      return toOrderSummaryMap(extractSolrDocs(response));
    } catch (err) {
      logger.error("Failed to fetch replenishment order summaries", err);
      return {};
    }
  }

  async function fetchIncomingCandidates(productId: string, facilityId: string): Promise<SolrOrderDoc[]> {
    const response = await api({
      url: "admin/runSolrQuery",
      method: "POST",
      data: {
        json: {
          params: {
            rows: 100,
            start: 0,
            fl: "orderId,orderName,orderTypeId,orderStatusId,orderStatusDesc,orderDate,productId,facilityId,quantity",
            "q.op": "AND",
            defType: "edismax"
          },
          query: "*:*",
          filter: `docType: ORDER AND productId: ${quoteSolrValue(productId)} AND facilityId: ${quoteSolrValue(facilityId)} AND (orderTypeId: PURCHASE_ORDER OR orderTypeId: TRANSFER_ORDER) AND -orderStatusId: ORDER_CANCELLED AND -orderStatusId: ORDER_COMPLETED`
        }
      }
    });

    return extractSolrDocs(response).filter((doc) => doc.orderId && doc.orderTypeId);
  }

  async function fetchOrderDetail(order: SolrOrderDoc): Promise<any> {
    const cachedOrderDetail = orderDetailCache.get(order.orderId);
    if (cachedOrderDetail) return cachedOrderDetail;

    const url = order.orderTypeId === "TRANSFER_ORDER"
      ? `oms/transferOrders/${order.orderId}`
      : `oms/purchaseOrders/${order.orderId}`;
    const detailPromise = api({ url, method: "GET" })
      .then((response) => response?.data ?? response)
      .catch((err) => {
        orderDetailCache.delete(order.orderId);
        throw err;
      });

    orderDetailCache.set(order.orderId, detailPromise);
    return detailPromise;
  }

  async function refreshIncomingUnits(productId: string, facilityId: string) {
    metrics.incomingLoading = true;
    metrics.incomingUnavailable = false;

    try {
      const incomingCandidates = await fetchIncomingCandidates(productId, facilityId);
      const uniqueCandidates = Array.from(
        new Map(incomingCandidates.map((candidate) => [candidate.orderId, candidate])).values()
      );
      const details = await Promise.all(uniqueCandidates.map((order) => fetchOrderDetail(order)));
      let incomingUnits = 0;

      uniqueCandidates.forEach((order, index) => {
        const detail = details[index];
        if (order.orderTypeId === "PURCHASE_ORDER") {
          incomingUnits += calculatePurchaseOrderIncomingUnits(detail, productId, facilityId);
        } else if (order.orderTypeId === "TRANSFER_ORDER") {
          incomingUnits += calculateTransferOrderIncomingUnits(detail, productId, facilityId);
        }
      });

      metrics.incomingUnits = incomingUnits;
    } catch (err) {
      logger.error("Failed to refresh incoming replenishment units", err);
      metrics.incomingUnits = 0;
      metrics.incomingUnavailable = true;
    } finally {
      metrics.incomingLoading = false;
    }
  }

  async function refreshReplenishmentMetrics(payload: RefreshReplenishmentMetricsPayload) {
    if (!payload.productId || !payload.facilityId) {
      resetMetrics(metrics);
      return;
    }

    const inventoryRows = payload.inventoryRows ?? [];
    metrics.loading = true;

    try {
      metrics.trendPoints = buildTrendPoints(inventoryRows);

      const orderIds = inventoryRows
        .map((row) => String(row.orderId ?? "").trim())
        .filter(Boolean);
      const orderSummaries = await fetchOrderSummaries(orderIds);
      metrics.salesVelocityUnitsPerDay = calculateSalesVelocity(
        inventoryRows,
        orderSummaries,
        payload.now ?? Date.now(),
        payload.days ?? 30
      );

      await refreshIncomingUnits(payload.productId, payload.facilityId);
    } catch (err) {
      logger.error("Failed to refresh replenishment metrics", err);
    } finally {
      metrics.loading = false;
    }
  }

  function resetReplenishmentMetrics() {
    resetMetrics(metrics);
  }

  function clearOrderDetailCache() {
    orderDetailCache.clear();
  }

  return {
    metrics,
    refreshReplenishmentMetrics,
    resetReplenishmentMetrics,
    clearOrderDetailCache
  };
}
