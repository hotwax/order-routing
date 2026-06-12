// src/types/variation.ts
// Shapes for the H2 variation (what-if) feature. Pure TS — no runtime imports, safe under `npx tsx`.

/** A scope filter (on a routing) or an inventory condition (on a rule). operator/fieldValue are null
 *  for an unset placeholder row the engine ignores. */
export interface VariationCondition {
  conditionSeqId: string;
  fieldName: string | null;
  operator: string | null;
  fieldValue: string | null;
  sequenceNum: number;
  conditionTypeEnumId?: string; // ENTCT_FILTER (default) | ENTCT_SORT_BY
}

/** A rule action — what the rule does (ORA_NEXT_RULE, ORA_MV_TO_QUEUE, ORA_AUTO_CANCEL_DAYS, ...). */
export interface VariationAction {
  actionSeqId: string;
  actionTypeEnumId: string;
  actionValue: string | null;
}

export interface VariationRule {
  routingRuleId: string;
  ruleName: string;
  statusId: string; // RULE_ACTIVE | RULE_DRAFT | RULE_ARCHIVED
  sequenceNum: number;
  assignmentEnumId?: string;
  inventoryConditions: VariationCondition[];
  actions: VariationAction[];
}

export interface VariationRouting {
  orderRoutingId: string; // re-keyed, e.g. VM100204_100008
  routingName: string;
  statusId: string; // ROUTING_ACTIVE | ROUTING_DRAFT | ROUTING_ARCHIVED
  sequenceNum: number;
  filters: VariationCondition[];
  rules: VariationRule[];
}

export interface VariationTree {
  variationGroupId: string;
  parentRoutingGroupId: string;
  productStoreId: string;
  variationName: string;
  statusId: string; // VAR_DRAFT ...
  routings: VariationRouting[];
}

export interface VariationListItem {
  variationGroupId: string;
  parentRoutingGroupId: string;
  productStoreId: string;
  variationName: string;
  statusId: string;
  createdDate: number;
  createdByUserId?: string;
}

/** Where an order item ultimately ended up after this routing ran. */
export type FinalReason = "FULLY_BROKERED" | "PARTIALLY_BROKERED" | "QUEUED" | "NO_INVENTORY" | "ERROR";

/** One facility assignment produced by a rule. Mirrors OrderAssignment in the sim-routing serializer. */
export interface OrderAssignment {
  orderId: string;
  orderItemSeqId: string;
  shipGroupSeqId: string;
  facilityId: string;
  routedQty: number;
  itemQty: number;
}

/** One rule's attempt at routing an order. Mirrors RuleAttempt in the sim-routing serializer. */
export interface RuleAttempt {
  routingRuleId: string;
  sequenceNum: number;
  durationMs?: number;
  suggestedFulfillmentLocations?: unknown;
  actionFilters?: unknown;
  outcome: string;
  runNextRule?: boolean;
  errorMessage?: string | null;
}

/** Per-order trace from a group run. Fields are optional-tolerant: older payloads may omit them. */
export interface OrderTrace {
  orderId: string;
  shipGroupSeqId?: string;
  orderItemSeqId?: string;
  finalReason: FinalReason | string;
  finalAssignments?: OrderAssignment[];
  ruleAttempts?: RuleAttempt[];
}

/** Per-routing result from a group run (variation run or parent live-config run). No routingName. */
export interface RoutingRunResult {
  orderRoutingId: string;
  sequenceNum: number;
  eligibleEntryCount: number;
  attemptedItemCount: number;
  brokeredItemCount: number;
  queuedItemCount: number;
  orderTraces?: OrderTrace[];
}

export interface GroupRunResult {
  routingGroupId: string;
  productStoreId: string;
  attemptedItemCount: number;
  brokeredItemCount: number;
  queuedItemCount: number;
  routingResults: RoutingRunResult[];
}

/** One row of the parent-vs-variation comparison table. Either side may be null. */
export interface CompareRow {
  routingName: string;
  parentRoutingId: string | null;     // e.g. 100008
  variationRoutingId: string | null;  // e.g. VM100204_100008
  parent: RoutingRunResult | null;
  variation: RoutingRunResult | null;
}
