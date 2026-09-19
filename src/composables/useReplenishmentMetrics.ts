import { api, logger, useSolrSearch } from "@common";
import { reactive } from "vue";
import {
  InventoryDetailRow,
  OrderSummary,
  REPLENISHMENT_TREND_WINDOW_DAYS,
  SalesVelocityBreakdown,
  TrendPoint,
  buildTrendPoints,
  calculatePurchaseOrderIncomingUnits,
  calculateSalesVelocityBreakdown,
  calculateTransferOrderIncomingUnits,
  toNumber,
} from "@/utils/replenishmentMetrics";

export interface IncomingTransfer {
  orderId: string;
  orderName?: string | null;
  sourceFacilityId?: string | null;
  sourceFacilityName?: string | null;
  units: number;
}

export interface RequestedTransfer {
  inventoryTransferId: string;
  sourceFacilityId?: string | null;
  sourceFacilityName?: string | null;
  units: number;
}

export interface ReplenishmentMetrics {
  loading: boolean;
  incomingLoading: boolean;
  incomingUnavailable: boolean;
  incomingTransfers: IncomingTransfer[];
  requestedTransfers: RequestedTransfer[];
  incomingUnits: number;
  salesVelocityBreakdown: SalesVelocityBreakdown;
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

interface ReturnShipmentSummary {
  shipmentId?: string | null;
}

interface ReturnShipmentItem {
  productId?: string | null;
  returnQuantity?: string | number | null;
  quantityAccepted?: string | number | null;
}

interface ReturnShipmentDetail {
  items?: ReturnShipmentItem[];
}

interface InventoryTransferRow {
  inventoryTransferId?: string | null;
  facilityId?: string | null;
  productId?: string | null;
  quantity?: string | number | null;
}

const ZERO_SALES_VELOCITY_BREAKDOWN: SalesVelocityBreakdown = {
  inStoreUnits: 0,
  inStoreShipToHomeUnits: 0,
  onlineUnits: 0,
  totalUnits: 0,
  unitsPerDay: 0,
};
const RETURN_SHIPMENT_PAGE_SIZE = 100;

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
  metrics.incomingTransfers = [];
  metrics.requestedTransfers = [];
  metrics.incomingUnits = 0;
  metrics.salesVelocityBreakdown = { ...ZERO_SALES_VELOCITY_BREAKDOWN };
  metrics.salesVelocityUnitsPerDay = 0;
  metrics.trendPoints = [];
}

export function useReplenishmentMetrics() {
  const metrics = reactive<ReplenishmentMetrics>({
    loading: false,
    incomingLoading: false,
    incomingUnavailable: false,
    incomingTransfers: [],
    requestedTransfers: [],
    incomingUnits: 0,
    salesVelocityBreakdown: { ...ZERO_SALES_VELOCITY_BREAKDOWN },
    salesVelocityUnitsPerDay: 0,
    trendPoints: [],
  });
  const orderDetailCache = new Map<string, any>();
  const facilityNameCache = new Map<string, string | null>();
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
            fl: "orderId,orderName,orderTypeId,salesChannelEnumId,shipmentMethodTypeId",
            defType: "edismax",
          },
          query: "*:*",
          filter: `docType: ORDER AND orderId: (${ids.map(quoteSolrValue).join(" OR ")})`,
        },
      });
      return searchDocuments(response).reduce((summaries, doc) => {
        if(doc.orderId) {
          summaries[doc.orderId] = {
            orderId: doc.orderId,
            orderName: doc.orderName,
            orderTypeId: doc.orderTypeId,
            salesChannelEnumId: doc.salesChannelEnumId,
            shipmentMethodTypeId: doc.shipmentMethodTypeId,
          };
        }
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
          fl: "orderId,orderName,orderTypeId",
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

  async function fetchFacilityName(facilityId?: string | null): Promise<string | null> {
    if(!facilityId) {return null;}
    if(facilityNameCache.has(facilityId)) {return facilityNameCache.get(facilityId) ?? null;}

    try {
      const response = await api({ url: `oms/facilities/${encodeURIComponent(facilityId)}`, method: "GET" });
      const facility = response?.data ?? response;
      const facilityName = String(facility?.facilityName ?? "").trim() || null;
      facilityNameCache.set(facilityId, facilityName);
      return facilityName;
    } catch(error) {
      logger.error("Failed to resolve incoming transfer source facility", error);
      facilityNameCache.set(facilityId, null);
      return null;
    }
  }

  async function fetchExpectedReturnShipmentUnits(productId: string, facilityId: string): Promise<number> {
    const shipments: ReturnShipmentSummary[] = [];
    let pageIndex = 0;
    let expectedCount: number | null = null;

    do {
      const response = await api({
        url: "oms/returnShipments",
        method: "GET",
        params: {
          destinationFacilityId: facilityId,
          statusId: "PURCH_SHIP_CREATED",
          pageIndex,
          pageSize: RETURN_SHIPMENT_PAGE_SIZE,
        },
      });
      const data = response?.data ?? response;
      const page = data?.returnShipments ?? [];
      shipments.push(...page);
      const count = toNumber(data?.count);
      expectedCount = count ?? expectedCount;
      if(page.length < RETURN_SHIPMENT_PAGE_SIZE || expectedCount !== null && shipments.length >= expectedCount) {break;}
      pageIndex += 1;
    } while(true);

    const uniqueShipmentIds = [...new Set(shipments.map((shipment) => shipment.shipmentId).filter((shipmentId): shipmentId is string => Boolean(shipmentId)))];
    const details = await Promise.all(uniqueShipmentIds.map(async (shipmentId) => {
      const response = await api({ url: `oms/returnShipments/${shipmentId}`, method: "GET" });
      return (response?.data ?? response) as ReturnShipmentDetail;
    }));

    return details.reduce((total, detail) => total + (detail.items ?? []).reduce((itemTotal, item) => {
      if(item.productId !== productId) {return itemTotal;}
      const remaining = (toNumber(item.returnQuantity) ?? 0) - (toNumber(item.quantityAccepted) ?? 0);
      return remaining > 0 ? itemTotal + remaining : itemTotal;
    }, 0), 0);
  }

  async function fetchRequestedTransfers(productId: string, facilityId: string): Promise<RequestedTransfer[]> {
    const response = await api({
      url: "oms/inventoryTransfers",
      method: "GET",
      params: {
        productId,
        facilityIdTo: facilityId,
        statusId: "IXF_REQUESTED",
        orderBy: "-createdStamp",
        pageIndex: 0,
        pageSize: 100,
      },
    });
    const rows = response?.data ?? response;
    if(!Array.isArray(rows)) {return [];}

    return rows.flatMap((row: InventoryTransferRow): RequestedTransfer[] => {
      const inventoryTransferId = String(row.inventoryTransferId ?? "").trim();
      const units = toNumber(row.quantity) ?? 0;
      if(!inventoryTransferId || units <= 0) {return [];}
      return [{
        inventoryTransferId,
        sourceFacilityId: row.facilityId,
        units,
      }];
    });
  }

  async function refreshIncomingUnits(productId: string, facilityId: string, refreshId: number) {
    if(refreshId === activeRefreshId) {
      metrics.incomingLoading = true;
      metrics.incomingUnavailable = false;
    }
    try {
      const [candidates, returnShipmentUnits, requestedTransfers] = await Promise.all([
        fetchIncomingCandidates(productId),
        fetchExpectedReturnShipmentUnits(productId, facilityId),
        fetchRequestedTransfers(productId, facilityId),
      ]);
      const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.orderId, candidate])).values()];
      const details = await Promise.all(uniqueCandidates.map(fetchOrderDetail));
      const incomingTransfers = uniqueCandidates.flatMap((order, index): IncomingTransfer[] => {
        if(order.orderTypeId !== "TRANSFER_ORDER") {return [];}
        const detail = details[index];
        const units = calculateTransferOrderIncomingUnits(detail, productId, facilityId);
        if(units <= 0) {return [];}
        return [{
          orderId: order.orderId,
          orderName: order.orderName,
          sourceFacilityId: detail?.order?.facilityId ?? detail?.order?.originFacilityId,
          units,
        }];
      });
      const incomingOrderUnits = uniqueCandidates.reduce((total, order, index) => {
        const detail = details[index];
        if(order.orderTypeId === "PURCHASE_ORDER") {
          return total + calculatePurchaseOrderIncomingUnits(detail, productId, facilityId);
        }
        return total + calculateTransferOrderIncomingUnits(detail, productId, facilityId);
      }, 0);
      const incomingTransfersWithSourceNames = await Promise.all(incomingTransfers.map(async (transfer) => ({
        ...transfer,
        sourceFacilityName: await fetchFacilityName(transfer.sourceFacilityId),
      })));
      const requestedTransfersWithSourceNames = await Promise.all(requestedTransfers.map(async (transfer) => ({
        ...transfer,
        sourceFacilityName: await fetchFacilityName(transfer.sourceFacilityId),
      })));
      if(refreshId === activeRefreshId) {
        metrics.incomingUnits = incomingOrderUnits + returnShipmentUnits + requestedTransfers.reduce((total, transfer) => total + transfer.units, 0);
        metrics.incomingTransfers = incomingTransfersWithSourceNames;
        metrics.requestedTransfers = requestedTransfersWithSourceNames;
      }
    } catch(error) {
      logger.error("Failed to refresh incoming replenishment units", error);
      if(refreshId === activeRefreshId) {
        metrics.incomingUnits = 0;
        metrics.incomingTransfers = [];
        metrics.requestedTransfers = [];
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
    metrics.trendPoints = buildTrendPoints(
      inventoryRows,
      payload.now ?? Date.now(),
      payload.days ?? REPLENISHMENT_TREND_WINDOW_DAYS,
    );
    try {
      const orderSummaries = await fetchOrderSummaries(inventoryRows.map((row) => String(row.orderId ?? "").trim()).filter(Boolean));
      if(refreshId !== activeRefreshId) {return;}
      metrics.salesVelocityBreakdown = calculateSalesVelocityBreakdown(inventoryRows, orderSummaries, payload.now ?? Date.now(), payload.days ?? 30);
      metrics.salesVelocityUnitsPerDay = metrics.salesVelocityBreakdown.unitsPerDay;
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
