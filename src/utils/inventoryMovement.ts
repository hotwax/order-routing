import {
  cartOutline,
  swapHorizontalOutline,
  fileTrayFullOutline,
  returnDownBackOutline,
  clipboardOutline,
  repeatOutline,
  downloadOutline,
  createOutline,
  pencilOutline,
  cubeOutline
} from "ionicons/icons";
import { buildAppUrl } from "@common";

/**
 * Decodes a raw InventoryItemDetail row (from oms/inventoryItem/detail) into a classified
 * "movement" that explains WHICH record impacted inventory — a sales order reservation/shipment,
 * a transfer order, a purchase receipt, a return, a cycle-count variance, an item rollover, the
 * initial receipt, or a manual adjustment.
 *
 * The raw row only carries reference ids (orderId, physicalInventoryId, returnId, …) plus the
 * ATP/QOH/accounting deltas. Order *type* (sales vs transfer vs purchase) is not on the row, so the
 * caller resolves orderId → OrderSummary first (see orderRoutingStore.fetchOrderSummaries) and
 * passes the map in as context. reasonEnumId descriptions come from the IID_REASON enum set.
 */

export type MovementTypeKey =
  | "SALES_ORDER"
  | "TRANSFER"
  | "PURCHASE"
  | "RETURN"
  | "CYCLE_COUNT"
  | "MANUAL_VARIANCE"
  | "ROLLOVER"
  | "RECEIPT"
  | "ADJUSTMENT";

export interface OrderSummary {
  orderId: string;
  orderName?: string;
  orderTypeId?: string;
  orderStatusId?: string;
  orderStatusDesc?: string;
  orderDate?: string | number;
  customerPartyName?: string;
}

export interface MovementContext {
  orderSummaries?: Record<string, OrderSummary>;
  reasonDescById?: Record<string, string>;
}

export interface ClassifiedMovement {
  raw: any;
  typeKey: MovementTypeKey;
  label: string;          // translation key for the movement type chip
  icon: string;
  color: string;          // Ionic color name
  referenceLabel: string; // human reference shown in the collapsed header (order name, reason, …)
  order?: OrderSummary;
  reasonDesc?: string;
  link: string | null;    // deep link into the owning app, or null when unavailable
  linkLabel: string;      // translation key for the link button
  searchText: string;     // lowercased haystack used by the order-name/id search box
}

interface TypePresentation {
  label: string;
  icon: string;
  color: string;
  linkLabel: string;
}

// Type chip presentation. `label`/`linkLabel` are translation keys resolved in the component.
const TYPE_PRESENTATION: Record<MovementTypeKey, TypePresentation> = {
  SALES_ORDER: { label: "Sales order", icon: cartOutline, color: "primary", linkLabel: "Open in Order Manager" },
  TRANSFER:    { label: "Transfer order", icon: swapHorizontalOutline, color: "tertiary", linkLabel: "Open in Transfers" },
  PURCHASE:    { label: "Purchase order", icon: fileTrayFullOutline, color: "secondary", linkLabel: "Open in PreOrder" },
  RETURN:      { label: "Return", icon: returnDownBackOutline, color: "warning", linkLabel: "Open in Order Manager" },
  CYCLE_COUNT: { label: "Cycle count", icon: clipboardOutline, color: "medium", linkLabel: "Open in Cycle Count" },
  MANUAL_VARIANCE: { label: "Manual variance", icon: pencilOutline, color: "warning", linkLabel: "" },
  ROLLOVER:    { label: "Rollover", icon: repeatOutline, color: "medium", linkLabel: "" },
  RECEIPT:     { label: "Receipt", icon: downloadOutline, color: "success", linkLabel: "" },
  ADJUSTMENT:  { label: "Adjustment", icon: createOutline, color: "medium", linkLabel: "" }
};

function classifyType(row: any, order?: OrderSummary): MovementTypeKey {
  if (row.physicalInventoryId) {
    // A cycle count applies a variance through a count session (WorkEffort); a manual variance is a
    // person directly logging one. Split them so each row shows the right audit (counted + accepted
    // vs logged-by + reason) and gets its own filter chip. The count-session signal is a workEffortId
    // or the CYCLE_COUNT reason; everything else with a physicalInventoryId is a manual variance.
    if (row.workEffortId || row.reasonEnumId === "CYCLE_COUNT") return "CYCLE_COUNT";
    return "MANUAL_VARIANCE";
  }
  if (row.reasonEnumId === "INV_ROLLOVER") return "ROLLOVER";
  if (row.returnId) return "RETURN";
  if (row.orderId) {
    const type = order?.orderTypeId;
    if (type === "TRANSFER_ORDER") return "TRANSFER";
    if (type === "PURCHASE_ORDER") return "PURCHASE";
    return "SALES_ORDER"; // default for orders, including unresolved/unknown types
  }
  if (row.shipmentId) return "RECEIPT";
  // The row whose detail seq id equals the inventory item id (and carries no other reference) is
  // the original receipt that created the inventory item.
  if (row.inventoryItemDetailSeqId && row.inventoryItemDetailSeqId === row.inventoryItemId) return "RECEIPT";
  return "ADJUSTMENT";
}

// Deep-link a movement into the app that owns its source record, via the Fast Travel registry
// (buildAppUrl returns null when that app has no URL configured for the deployment). Path templates
// follow the standard HotWax app routes; adjust here if an instance differs.
function buildLink(typeKey: MovementTypeKey, row: any): string | null {
  switch (typeKey) {
    case "SALES_ORDER":
      return row.orderId ? buildAppUrl("order-manager", `/orders/${row.orderId}`) : null;
    case "RETURN":
      return row.returnId ? buildAppUrl("order-manager", `/returns/${row.returnId}`) : null;
    case "PURCHASE":
      return row.orderId ? buildAppUrl("preorder", `/purchase-order/${row.orderId}`) : null;
    case "TRANSFER":
      return row.orderId ? buildAppUrl("transfers", `/transfer-order-details/${row.orderId}`) : null;
    case "CYCLE_COUNT":
      return row.physicalInventoryId ? buildAppUrl("cycle-count", `/count/${row.physicalInventoryId}`) : null;
    default:
      return null;
  }
}

function buildReferenceLabel(typeKey: MovementTypeKey, row: any, order?: OrderSummary, reasonDesc?: string): string {
  switch (typeKey) {
    case "SALES_ORDER":
    case "TRANSFER":
    case "PURCHASE":
      return order?.orderName || row.orderId || "-";
    case "RETURN":
      return row.returnId || "-";
    case "CYCLE_COUNT":
      return reasonDesc || row.reasonEnumId || "Cycle count";
    case "MANUAL_VARIANCE":
      return reasonDesc || row.reasonEnumId || "Manual variance";
    case "ROLLOVER":
      return row.description || reasonDesc || "Rollover";
    case "RECEIPT":
      return row.description || reasonDesc || "Receipt";
    default:
      return row.description || reasonDesc || "Adjustment";
  }
}

export function classifyMovement(row: any, ctx: MovementContext = {}): ClassifiedMovement {
  const order = row.orderId ? ctx.orderSummaries?.[row.orderId] : undefined;
  const reasonDesc = row.reasonEnumId ? ctx.reasonDescById?.[row.reasonEnumId] : undefined;
  const typeKey = classifyType(row, order);
  const presentation = TYPE_PRESENTATION[typeKey];
  const referenceLabel = buildReferenceLabel(typeKey, row, order, reasonDesc);

  const searchText = [row.orderId, order?.orderName, row.returnId, row.physicalInventoryId, referenceLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    raw: row,
    typeKey,
    label: presentation.label,
    icon: presentation.icon,
    color: presentation.color,
    referenceLabel,
    order,
    reasonDesc,
    link: buildLink(typeKey, row),
    linkLabel: presentation.linkLabel,
    searchText
  };
}

// Stable order for the type-filter chips, used by the component to build "present types" options.
export const MOVEMENT_TYPE_ORDER: MovementTypeKey[] = [
  "SALES_ORDER",
  "TRANSFER",
  "PURCHASE",
  "RETURN",
  "CYCLE_COUNT",
  "MANUAL_VARIANCE",
  "ROLLOVER",
  "RECEIPT",
  "ADJUSTMENT"
];

export function movementTypeLabel(typeKey: MovementTypeKey): string {
  return TYPE_PRESENTATION[typeKey].label;
}

export function movementTypeIcon(typeKey: MovementTypeKey): string {
  return TYPE_PRESENTATION[typeKey].icon;
}

export function movementTypeColor(typeKey: MovementTypeKey): string {
  return TYPE_PRESENTATION[typeKey].color;
}

export { cubeOutline };
