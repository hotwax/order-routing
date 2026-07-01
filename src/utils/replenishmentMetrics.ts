export interface InventoryDetailRow {
  effectiveDate?: string | number | null;
  availableToPromiseTotal?: string | number | null;
  availableToPromiseDiff?: string | number | null;
  lastAvailableToPromise?: string | number | null;
  quantityOnHandTotal?: string | number | null;
  quantityOnHandDiff?: string | number | null;
  lastQuantityOnHand?: string | number | null;
  orderId?: string | null;
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
  facilityId?: string | null;
  shipGroupSeqId?: string | null;
}

interface IncomingShipGroup {
  shipGroupSeqId?: string | null;
  orderFacilityId?: string | null;
  facilityId?: string | null;
}

const PURCHASE_ITEM_EXCLUDED_STATUSES = new Set([
  "ITEM_CANCELLED",
  "ITEM_COMPLETED",
  "ITEM_REJECTED"
]);

const TRANSFER_ITEM_INCLUDED_STATUSES = new Set([
  "ITEM_CREATED",
  "ITEM_APPROVED",
  "ITEM_PENDING_RECEIPT"
]);

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function addNumbers(left: unknown, right: unknown): number | null {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);

  if (leftNumber === null || rightNumber === null) return null;
  return leftNumber + rightNumber;
}

function toTimestamp(value: InventoryDetailRow["effectiveDate"]): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const timestamp = Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildTrendPoints(rows: InventoryDetailRow[] = []): TrendPoint[] {
  return rows
    .map((row) => {
      const timestamp = toTimestamp(row.effectiveDate);
      const atp = toNumber(row.availableToPromiseTotal) ?? addNumbers(row.lastAvailableToPromise, row.availableToPromiseDiff);

      if (timestamp === null || atp === null) return null;
      return { timestamp, atp };
    })
    .filter((point): point is TrendPoint => point !== null)
    .sort((left, right) => left.timestamp - right.timestamp);
}

function buildOrderSummaryMap(orderSummaries: Record<string, OrderSummary | undefined> | OrderSummary[]): Record<string, OrderSummary | undefined> {
  if (Array.isArray(orderSummaries)) {
    return orderSummaries.reduce((summaryMap, summary) => {
      if (summary.orderId) summaryMap[summary.orderId] = summary;
      return summaryMap;
    }, {} as Record<string, OrderSummary>);
  }

  return orderSummaries;
}

export function calculateSalesVelocity(
  rows: InventoryDetailRow[] = [],
  orderSummaries: Record<string, OrderSummary | undefined> | OrderSummary[] = {},
  now: string | number = Date.now(),
  days = 30
): number {
  if (days <= 0) return 0;

  const nowTimestamp = typeof now === "number" ? now : Date.parse(now);
  if (!Number.isFinite(nowTimestamp)) return 0;

  const summaryMap = buildOrderSummaryMap(orderSummaries);
  const windowStart = nowTimestamp - (days * 24 * 60 * 60 * 1000);
  const totalUnits = rows.reduce((sum, row) => {
    const timestamp = toTimestamp(row.effectiveDate);
    if (timestamp === null || timestamp < windowStart || timestamp > nowTimestamp) return sum;

    const availableToPromiseDiff = toNumber(row.availableToPromiseDiff);
    if (availableToPromiseDiff === null || availableToPromiseDiff >= 0) return sum;

    const orderId = String(row.orderId ?? "").trim();
    if (!orderId) return sum;

    const orderSummary = summaryMap[orderId];
    if (orderSummary?.orderTypeId !== "SALES_ORDER") return sum;

    return sum + Math.abs(availableToPromiseDiff);
  }, 0);

  return totalUnits / days;
}

export function formatUnitsPerDay(value: unknown): string {
  const unitValue = toNumber(value) ?? 0;
  if (unitValue === 0) return "0";

  return Number.isInteger(unitValue) ? String(unitValue) : unitValue.toFixed(1);
}

function toArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function getOrderPayload(orderDetail: any): any {
  return orderDetail?.order ?? orderDetail?.purchaseOrder ?? orderDetail?.transferOrder ?? orderDetail ?? {};
}

function getOrderItems(orderDetail: any): IncomingOrderItem[] {
  const order = getOrderPayload(orderDetail);
  const rootCandidates = [
    orderDetail?.items,
    orderDetail?.orderItems,
    orderDetail?.orderItem
  ];
  const nestedCandidates = order === orderDetail ? [] : [
    order?.items,
    order?.orderItems,
    order?.orderItem
  ];

  for (const candidate of [...rootCandidates, ...nestedCandidates]) {
    const items = toArray(candidate);
    if (items.length) return items;
  }

  return [];
}

function getShipGroups(orderDetail: any): IncomingShipGroup[] {
  const order = getOrderPayload(orderDetail);
  const rootCandidates = [
    orderDetail?.shipGroups,
    orderDetail?.shipGroup
  ];
  const nestedCandidates = order === orderDetail ? [] : [
    order?.shipGroups,
    order?.shipGroup
  ];

  for (const candidate of [...rootCandidates, ...nestedCandidates]) {
    const shipGroups = toArray(candidate);
    if (shipGroups.length) return shipGroups;
  }

  return [];
}

function findShipGroup(orderDetail: any, item: IncomingOrderItem): IncomingShipGroup | undefined {
  const shipGroups = getShipGroups(orderDetail);
  if (!item.shipGroupSeqId) return shipGroups[0];

  return shipGroups.find((shipGroup) => shipGroup.shipGroupSeqId === item.shipGroupSeqId);
}

export function calculatePurchaseOrderIncomingUnits(orderDetail: any, productId: string, facilityId: string): number {
  const order = getOrderPayload(orderDetail);
  if (order.originFacilityId !== facilityId) return 0;

  return getOrderItems(orderDetail).reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (item.statusId && PURCHASE_ITEM_EXCLUDED_STATUSES.has(item.statusId)) return sum;

    const quantity = toNumber(item.availableToPromise) ?? toNumber(item.quantity) ?? 0;
    return quantity > 0 ? sum + quantity : sum;
  }, 0);
}

export function calculateTransferOrderIncomingUnits(orderDetail: any, productId: string, facilityId: string): number {
  return getOrderItems(orderDetail).reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (!item.statusId || !TRANSFER_ITEM_INCLUDED_STATUSES.has(item.statusId)) return sum;

    const shipGroup = findShipGroup(orderDetail, item);
    const destinationFacilityId = item.orderFacilityId ?? shipGroup?.orderFacilityId ?? shipGroup?.facilityId;
    if (destinationFacilityId !== facilityId) return sum;

    const quantity = toNumber(item.quantity) ?? 0;
    const receivedQuantity = toNumber(item.totalReceivedQuantity) ?? 0;
    const remainingQuantity = quantity - receivedQuantity;

    return remainingQuantity > 0 ? sum + remainingQuantity : sum;
  }, 0);
}

export function calculateIncomingUnitsFromOrderDetails(
  purchaseOrderDetails: any[] = [],
  transferOrderDetails: any[] = [],
  productId: string,
  facilityId: string
): number {
  const purchaseUnits = purchaseOrderDetails.reduce(
    (sum, orderDetail) => sum + calculatePurchaseOrderIncomingUnits(orderDetail, productId, facilityId),
    0
  );
  const transferUnits = transferOrderDetails.reduce(
    (sum, orderDetail) => sum + calculateTransferOrderIncomingUnits(orderDetail, productId, facilityId),
    0
  );

  return purchaseUnits + transferUnits;
}
