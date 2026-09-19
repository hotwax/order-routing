export interface InventoryDetailRow {
  createdStamp?: string | number | null;
  effectiveDate?: string | number | null;
  availableToPromiseTotal?: string | number | null;
  availableToPromiseDiff?: string | number | null;
  lastAvailableToPromise?: string | number | null;
  orderId?: string | number | null;
}

export interface OrderSummary {
  orderId: string;
  orderTypeId?: string | null;
}

export interface TrendPoint {
  timestamp: number;
  atp: number;
}

interface IncomingOrderItem {
  productId?: string | null;
  quantity?: string | number | null;
  availableToPromise?: string | number | null;
  totalReceivedQuantity?: string | number | null;
  statusId?: string | null;
  orderFacilityId?: string | null;
  shipGroupSeqId?: string | null;
}

interface IncomingShipGroup {
  shipGroupSeqId?: string | null;
  orderFacilityId?: string | null;
}

interface IncomingOrder {
  originFacilityId?: string | null;
  items?: IncomingOrderItem[];
  shipGroups?: IncomingShipGroup[];
}

interface IncomingOrderDetail {
  order?: IncomingOrder;
}

const PURCHASE_ITEM_EXCLUDED_STATUSES = new Set([
  "ITEM_CANCELLED",
  "ITEM_COMPLETED",
  "ITEM_REJECTED",
]);

const TRANSFER_ITEM_INCLUDED_STATUSES = new Set([
  "ITEM_CREATED",
  "ITEM_APPROVED",
  "ITEM_PENDING_RECEIPT",
]);

export function toNumber(value: unknown): number | null {
  if(value === null || value === undefined) {return null;}
  if(typeof value === "string" && value.trim() === "") {return null;}

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function historyTimestamp(row: InventoryDetailRow): number | null {
  const value = row.createdStamp ?? row.effectiveDate;
  if(value === null || value === undefined || value === "") {return null;}
  if(typeof value === "number") {return Number.isFinite(value) ? value : null;}

  const numericValue = Number(value);
  if(Number.isFinite(numericValue) && value.trim() !== "") {return numericValue;}

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function atpAfterMovement(row: InventoryDetailRow): number | null {
  const explicitTotal = toNumber(row.availableToPromiseTotal);
  if(explicitTotal !== null) {return explicitTotal;}

  const previousTotal = toNumber(row.lastAvailableToPromise);
  const diff = toNumber(row.availableToPromiseDiff);
  return previousTotal === null || diff === null ? null : previousTotal + diff;
}

export function buildTrendPoints(rows: InventoryDetailRow[] = []): TrendPoint[] {
  return rows
    .map((row) => {
      const timestamp = historyTimestamp(row);
      const atp = atpAfterMovement(row);
      return timestamp === null || atp === null ? null : { timestamp, atp };
    })
    .filter((point): point is TrendPoint => point !== null)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function orderSummaryMap(orderSummaries: Record<string, OrderSummary | undefined> | OrderSummary[]): Record<string, OrderSummary | undefined> {
  if(!Array.isArray(orderSummaries)) {return orderSummaries;}

  return orderSummaries.reduce((summaries, summary) => {
    summaries[summary.orderId] = summary;
    return summaries;
  }, {} as Record<string, OrderSummary>);
}

export function calculateSalesVelocity(
  rows: InventoryDetailRow[] = [],
  orderSummaries: Record<string, OrderSummary | undefined> | OrderSummary[] = {},
  now: string | number = Date.now(),
  days = 30,
): number {
  const nowTimestamp = typeof now === "number" ? now : Date.parse(now);
  if(days <= 0 || !Number.isFinite(nowTimestamp)) {return 0;}

  const windowStart = nowTimestamp - days * 24 * 60 * 60 * 1000;
  const summaries = orderSummaryMap(orderSummaries);
  const unitsSold = rows.reduce((total, row) => {
    const timestamp = historyTimestamp(row);
    const atpDiff = toNumber(row.availableToPromiseDiff);
    const orderId = String(row.orderId ?? "").trim();
    if(timestamp === null || timestamp < windowStart || timestamp > nowTimestamp || atpDiff === null || atpDiff >= 0 || !orderId) {
      return total;
    }
    if(summaries[orderId]?.orderTypeId !== "SALES_ORDER") {return total;}
    return total + Math.abs(atpDiff);
  }, 0);

  return unitsSold / days;
}

function destinationForItem(order: IncomingOrder, item: IncomingOrderItem): string | null | undefined {
  const group = item.shipGroupSeqId
    ? order.shipGroups?.find((candidate) => candidate.shipGroupSeqId === item.shipGroupSeqId)
    : order.shipGroups?.[0];
  return item.orderFacilityId ?? group?.orderFacilityId;
}

export function calculatePurchaseOrderIncomingUnits(orderDetail: IncomingOrderDetail, productId: string, facilityId: string): number {
  const order = orderDetail.order;
  if(!order) {return 0;}
  if(order.originFacilityId !== facilityId) {return 0;}

  return (order.items ?? []).reduce((total, item) => {
    if(item.productId !== productId || (item.statusId && PURCHASE_ITEM_EXCLUDED_STATUSES.has(item.statusId))) {return total;}
    return total + (toNumber(item.availableToPromise) ?? toNumber(item.quantity) ?? 0);
  }, 0);
}

export function calculateTransferOrderIncomingUnits(orderDetail: IncomingOrderDetail, productId: string, facilityId: string): number {
  const order = orderDetail.order;
  if(!order) {return 0;}

  return (order.items ?? []).reduce((total, item) => {
    if(item.productId !== productId || !item.statusId || !TRANSFER_ITEM_INCLUDED_STATUSES.has(item.statusId)) {return total;}
    if(destinationForItem(order, item) !== facilityId) {return total;}

    const remaining = (toNumber(item.quantity) ?? 0) - (toNumber(item.totalReceivedQuantity) ?? 0);
    return remaining > 0 ? total + remaining : total;
  }, 0);
}
