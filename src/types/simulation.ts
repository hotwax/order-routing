// src/types/simulation.ts
// Shared types for the brokering group simulation screen. Pure TS — no runtime imports
// so this module is safe to import from tests run with `npx tsx`.

/** The flat parameter/data override vocabulary accepted inside variants[].parameterOverrides.
 *  Mirrors simulationConfigSchema in circuit/src/mastra/tools/runBrokeringGroupSimulation.ts. */
export interface SimulationConfig {
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

/** A user-saved variation: a full snapshot plus UI metadata. `group` is a deep clone of currentGroup. */
export interface Variation {
  id: string;            // client uuid
  label: string;         // user-editable
  group: any;            // full snapshot of the group hierarchy
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
