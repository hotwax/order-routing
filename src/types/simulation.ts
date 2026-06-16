// src/types/simulation.ts
// Shared types for the brokering group simulation screen. Pure TS — no runtime imports
// so this module is safe to import from tests run with `npx tsx`.

/** The flat parameter/data override vocabulary accepted inside variants[].parameterOverrides.
 *  Mirrors simulationConfigSchema in circuit/src/mastra/tools/runBrokeringGroupSimulation.ts. */
export interface SimulationConfig {
  /** Product store the simulation runs against. Injected per-variant at submit time (not diffed vs
   *  baseline) so the backend scopes orders/inventory to the right store. */
  productStoreId?: string;
  distance?: number;
  brokeringSafetyStock?: number;
  weekOfSupplyFilterEnabled?: boolean;
  weekOfSupplyThreshold?: number;
  facilityGroupId?: string;
  ignoreFacilityOrderLimit?: boolean;
  facilityOrderLimitOverride?: string;
  splitOrderItemGroup?: boolean;
  assignmentEnumId?: "ORA_SINGLE" | "ORA_MULTI";
  inventorySortByList?: string[];
  modelInventoryConsumption?: boolean;
  minimumStockOverrides?: Record<string, number>;
  inventoryCountOverrides?: Record<string, number>;
  allowBrokeringOverrides?: Record<string, boolean>;
  maximumOrderLimitOverrides?: Record<string, number>;
  facilitiesToSimulateAtLimit?: string[];
  facilitiesToAddToGroup?: string[];
  facilitiesToRemoveFromGroup?: string[];
}

/** The 11 scalar parameter keys we diff on currentGroup. Data-override maps are handled separately. */
export const SCALAR_PARAM_KEYS: (keyof SimulationConfig)[] = [
  "distance",
  "brokeringSafetyStock",
  "weekOfSupplyFilterEnabled",
  "weekOfSupplyThreshold",
  "facilityGroupId",
  "ignoreFacilityOrderLimit",
  "facilityOrderLimitOverride",
  "splitOrderItemGroup",
  "assignmentEnumId",
  "inventorySortByList",
  "modelInventoryConsumption",
];

export type RoutingConfigDelta =
  | { op: "ADD_RULE"; orderRoutingId: string; ruleSeed: Record<string, unknown> }
  | { op: "REMOVE_RULE"; routingRuleId: string }
  | { op: "SET_RULE_ACTION"; routingRuleId: string; actionTypeEnumId: string; actionValue: string }
  | { op: "SET_RULE_INV_COND"; routingRuleId: string; fieldName: string; fieldValue: unknown }
  | { op: "SET_RULE_ASSIGNMENT"; routingRuleId: string; assignmentEnumId: string }
  | { op: "SET_ROUTING_FILTER"; orderRoutingId: string; fieldName: string; fieldValue: unknown }
  | { op: "SET_ROUTING_SEQUENCE_NUM"; orderRoutingId: string; sequenceNum: number }
  | { op: "SET_RULE_SEQUENCE_NUM"; routingRuleId: string; sequenceNum: number };

/** Output of diff(baseline, snapshot). */
export interface VariantPayload {
  parameterOverrides: Partial<SimulationConfig>;
  routingDeltas: RoutingConfigDelta[];
}

/** One backend variant: label + the diff payload. */
export interface SimVariant extends VariantPayload {
  label: string;
}

/** A user-saved variation: a full snapshot plus UI metadata. `group` is a deep clone of currentGroup.
 *  When server-backed (H2 persist-on-save), `serverVid` is the sim-routing variationGroupId and `group`
 *  may be null until lazily fetched. */
export interface Variation {
  id: string;            // client uuid, or the serverVid when server-backed
  label: string;         // user-editable
  group: any;            // full snapshot of the group hierarchy (canvas shape), or null if not yet loaded
  serverVid?: string;    // sim-routing variationGroupId when persisted to H2
}

export type JobStatus = "running" | "complete" | "failed" | "not_found";

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  groupRun?: any;        // parsed Map when no variants were sent
  variation?: any;       // parsed Map when variants were sent
  error?: string;
  progress?: GroupRunProgress;   // present on running/complete/failed; absent on not_found
}

/** A single per-order event from the live progress feed. */
export interface OrderEvent {
  seq: number;
  phase?: string;
  phaseIndex?: number;
  orderId: string;
  shipGroupSeqId?: string;
  orderItemSeqId?: string;
  facilityId: string | null;   // null = unfilled
  finalReason: string;
}

/** The `progress` object returned on each poll while running (and on the terminal flush). */
export interface GroupRunProgress {
  phase: string;
  phaseLabel: string;
  phaseIndex: number;
  phaseCount: number;
  ordersInScope: number;
  ordersProcessed: number;
  brokered: number;
  queued: number;
  events: OrderEvent[];
  nextSeq: number;
}

/** Per-batch live state held in the store (index-aligned with the submit batches). */
export interface BatchProgress {
  batchIndex: number;
  phaseLabel: string;
  phaseIndex: number;
  phaseCount: number;
  ordersInScope: number;
  ordersProcessed: number;
  brokered: number;
  queued: number;
  events: OrderEvent[];   // rolling, capped at 50
}

/** Per-variation run state shown in the progress panel. */
export type RunPhase = "pending" | "submitted" | "running" | "done" | "failed";

export interface VariationRunState {
  variationId: string;
  label: string;
  phase: RunPhase;
  error?: string;
}

// ─── Outcome metrics (frozen contract, identical to the backend spec §3) ──────
// Rides along on every groupRun-shaped object: results.baseline.outcomes and
// results.variants[i].groupRun.outcomes. Every family carries an `available`
// flag; the dashboard renders each panel conditionally on it.

export interface OutcomeAvailability {
  cost: boolean;
  sla: boolean;
  inventory: boolean;
  classification: boolean;
}

export interface OutcomeUnfillable {
  itemCount: number;
  orderCount: number;
  rate: number; // 0..1
}

export interface OutcomeSla {
  available: boolean;
  compliantItemCount: number;
  measuredItemCount: number;
  complianceRate: number; // 0..1
  avgPromisedDays: number;
  avgEstimatedTransitDays: number;
}

export interface OutcomeExpedited {
  groundItems: number;
  airItems: number;
  groundCost: number;
  airCost: number;
}

export interface OutcomeCost {
  available: boolean;
  currency: string;
  totalShippingCost: number;
  avgCostPerItem: number;
  expedited: OutcomeExpedited;
}

export interface OutcomeStoreAtZero {
  facilityId: string;
  facilityName: string;
  productIds: string[];
}

export interface OutcomeInventory {
  available: boolean;
  newSeasonStoresAtZero: number;
  newSeasonStoresAtZeroList: OutcomeStoreAtZero[];
}

export interface OutcomeFulfillmentMix {
  byFacilityType: Record<string, number>;
  clearanceFromStore: number;
  newSeasonFromDC: number;
}

export interface OutcomeClassification {
  available: boolean;
  fulfillmentMix: OutcomeFulfillmentMix | null;
}

export interface SimulationOutcomes {
  available: OutcomeAvailability;
  fillRate: number; // 0..1, goal 1.0
  unfillable: OutcomeUnfillable;
  sla: OutcomeSla;
  cost: OutcomeCost;
  inventory: OutcomeInventory;
  classification: OutcomeClassification;
}

// --- From SimulationService ---

export interface JobOutcome {
  done: boolean;
  result?: { groupRun?: any; variation?: any };
  error?: string;
}

export interface SubmitBatchArgs {
  routingGroupId: string;
  variants: SimVariant[];
  sampleCap?: number;
}

export interface PastSimulationsFilters {
  productStoreId: string;
  routingGroupId?: string;
  statusId?: string;
  runType?: string;
  fromDate?: string;
  thruDate?: string;
  pageIndex: number;
  pageSize: number;
}

// --- From SimulationHistoryCache / SimulationJobStore (shared) ---

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PastSimHeader {
  simulationId: string;
  routingGroupId?: string;
  productStoreId?: string;
  runType?: string;
  statusId?: string;
  attemptedItemCount?: number;
  brokeredItemCount?: number;
  queuedItemCount?: number;
  durationMs?: number;
  sampleSize?: number;
  sampleCap?: number;
  simulationRan?: any;
  partial?: any;
  createdDate?: string | number;
  createdByUser?: string;
}

export interface DetailEntry {
  header: PastSimHeader;
  raw: any;
  cachedAt: number;
}

export interface SimJobRecord {
  jobId: string;
  batchIndex: number;
  batchCount: number;
  variantLabels: string[];
  submittedAt: number;
}
