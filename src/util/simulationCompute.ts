// src/util/simulationCompute.ts
// Pure simulation computation utilities — no side effects, no network calls.
// Merges: simulationDiff.ts, simulationBatch.ts, progressBuffer.ts, + pure fns from SimulationService.

import { SCALAR_PARAM_KEYS, SimulationConfig, RoutingConfigDelta, SimVariant, OrderEvent, JobStatusResponse, JobOutcome, PastSimulationsFilters } from "../types/simulation";

// ─── simulationDiff ───────────────────────────────────────────────────────────

function valueEquals(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

export function diffParameters(baseline: any, snapshot: any): Partial<SimulationConfig> {
  const out: Partial<SimulationConfig> = {};
  for (const key of SCALAR_PARAM_KEYS) {
    if (!valueEquals(baseline?.[key], snapshot?.[key])) {
      (out as any)[key] = snapshot?.[key];
    }
  }
  return out;
}

function byId<T extends Record<string, any>>(arr: T[] | undefined, idKey: string): Map<string, T> {
  const m = new Map<string, T>();
  (arr ?? []).forEach((item) => { if (item?.[idKey]) m.set(item[idKey], item); });
  return m;
}

function filterChanges(
  baseFilters: any[] | undefined,
  snapFilters: any[] | undefined,
): { fieldName: string; fieldValue: unknown }[] {
  const b = baseFilters ?? [];
  const s = snapFilters ?? [];
  const changes: { fieldName: string; fieldValue: unknown }[] = [];
  for (const sf of s) {
    const bf = b.find((x) => x.fieldName === sf.fieldName);
    if (!bf || !valueEquals(bf.fieldValue, sf.fieldValue)) {
      changes.push({ fieldName: sf.fieldName, fieldValue: sf.fieldValue });
    }
  }
  for (const bf of b) {
    if (!s.some((sf) => sf.fieldName === bf.fieldName)) {
      changes.push({ fieldName: bf.fieldName, fieldValue: null });
    }
  }
  return changes;
}

export function diffRoutings(baseline: any, snapshot: any): RoutingConfigDelta[] {
  const deltas: RoutingConfigDelta[] = [];
  const baseRoutings = byId<any>(baseline?.routings, "orderRoutingId");
  for (const snapRouting of snapshot?.routings ?? []) {
    const baseRouting = baseRoutings.get(snapRouting.orderRoutingId);
    if (baseRouting) {
      if (baseRouting.sequenceNum !== snapRouting.sequenceNum) {
        deltas.push({ op: "SET_ROUTING_SEQUENCE_NUM", orderRoutingId: snapRouting.orderRoutingId, sequenceNum: snapRouting.sequenceNum });
      }
      for (const ch of filterChanges(baseRouting.orderFilters, snapRouting.orderFilters)) {
        deltas.push({ op: "SET_ROUTING_FILTER", orderRoutingId: snapRouting.orderRoutingId, ...ch });
      }
    }
    const baseRules = byId<any>(baseRouting?.rules, "routingRuleId");
    const seenRuleIds = new Set<string>();
    for (const snapRule of snapRouting.rules ?? []) {
      if (!snapRule.routingRuleId) {
        deltas.push({ op: "ADD_RULE", orderRoutingId: snapRouting.orderRoutingId, ruleSeed: { ...snapRule } });
        continue;
      }
      seenRuleIds.add(snapRule.routingRuleId);
      const baseRule = baseRules.get(snapRule.routingRuleId);
      if (!baseRule) continue;
      if (baseRule.sequenceNum !== snapRule.sequenceNum) {
        deltas.push({ op: "SET_RULE_SEQUENCE_NUM", routingRuleId: snapRule.routingRuleId, sequenceNum: snapRule.sequenceNum });
      }
      const baseAction = (baseRule.actions ?? [])[0];
      const snapAction = (snapRule.actions ?? [])[0];
      if (snapAction && (!baseAction || baseAction.actionTypeEnumId !== snapAction.actionTypeEnumId || baseAction.actionValue !== snapAction.actionValue)) {
        deltas.push({ op: "SET_RULE_ACTION", routingRuleId: snapRule.routingRuleId, actionTypeEnumId: snapAction.actionTypeEnumId, actionValue: snapAction.actionValue });
      }
      if (snapRule.assignmentEnumId && baseRule.assignmentEnumId !== snapRule.assignmentEnumId) {
        deltas.push({ op: "SET_RULE_ASSIGNMENT", routingRuleId: snapRule.routingRuleId, assignmentEnumId: snapRule.assignmentEnumId });
      }
      for (const ch of filterChanges(baseRule.inventoryFilters, snapRule.inventoryFilters)) {
        deltas.push({ op: "SET_RULE_INV_COND", routingRuleId: snapRule.routingRuleId, ...ch });
      }
    }
    for (const baseRuleId of baseRules.keys()) {
      if (!seenRuleIds.has(baseRuleId)) {
        deltas.push({ op: "REMOVE_RULE", routingRuleId: baseRuleId });
      }
    }
  }
  return deltas;
}

export function buildVariant(label: string, baseline: any, snapshot: any): SimVariant {
  return {
    label,
    parameterOverrides: diffParameters(baseline, snapshot),
    routingDeltas: diffRoutings(baseline, snapshot),
  };
}

export function isNoOp(variant: SimVariant): boolean {
  return Object.keys(variant.parameterOverrides).length === 0 && variant.routingDeltas.length === 0;
}

export function applyProductStoreId(variants: SimVariant[], productStoreId: string): SimVariant[] {
  if (!productStoreId) return variants;
  return variants.map((v) => ({
    ...v,
    parameterOverrides: { ...v.parameterOverrides, productStoreId },
  }));
}

// ─── simulationBatch ──────────────────────────────────────────────────────────

export function chunkVariants<T>(items: T[], size = 5): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

export function mergeVariationResults(
  results: (any | null)[],
): { baseline: any; variants: any[]; partial: boolean; simulationRan: boolean } {
  let baseline: any = null;
  const variants: any[] = [];
  let partial = false;
  let simulationRan = true;
  for (const r of results) {
    if (!r || !r.variation) { partial = true; continue; }
    if (baseline === null) baseline = r.variation.baseline?.groupRun ?? r.variation.groupRun ?? r.variation.baseline ?? null;
    if (r.variation.partial) partial = true;
    if (r.variation.simulationRan === false) simulationRan = false;
    for (const v of r.variation.variants ?? []) variants.push(v);
  }
  return { baseline, variants, partial, simulationRan };
}

// ─── progressBuffer ───────────────────────────────────────────────────────────

export function mergeEvents(existing: OrderEvent[], incoming: OrderEvent[], cap = 50): OrderEvent[] {
  const all = [...existing, ...incoming];
  return all.length > cap ? all.slice(all.length - cap) : all;
}

// ─── From SimulationService (pure) ───────────────────────────────────────────

export function interpretJobStatus(resp: JobStatusResponse): JobOutcome {
  switch (resp.status) {
    case "running":
      return { done: false };
    case "complete": {
      const result: { groupRun?: any; variation?: any } = {};
      if (resp.groupRun !== undefined) result.groupRun = resp.groupRun;
      if (resp.variation !== undefined) result.variation = resp.variation;
      return { done: true, result };
    }
    case "failed":
      return { done: true, error: resp.error || "Simulation failed." };
    case "not_found":
      return { done: true, error: "Simulation job expired before it completed. Please re-run." };
    default:
      return { done: true, error: `Unknown job status: ${(resp as any).status}` };
  }
}

export function pastSimulationsQuery(f: PastSimulationsFilters): { url: string; params: Record<string, any> } {
  const params: Record<string, any> = { productStoreId: f.productStoreId };
  if (f.routingGroupId) params.routingGroupId = f.routingGroupId;
  if (f.statusId) params.statusId = f.statusId;
  if (f.runType) params.runType = f.runType;
  if (f.fromDate) params.fromDate = f.fromDate;
  if (f.thruDate) params.thruDate = f.thruDate;
  params.orderByField = "-createdDate";
  params.pageIndex = f.pageIndex;
  params.pageSize = f.pageSize;
  return { url: "order-routing/brokeringSimulations", params };
}

export function isFilteredQuery(f: PastSimulationsFilters): boolean {
  return Boolean(f.routingGroupId || f.statusId || f.runType || f.fromDate || f.thruDate);
}
