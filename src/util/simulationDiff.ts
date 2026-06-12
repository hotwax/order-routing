import { SCALAR_PARAM_KEYS, SimulationConfig, RoutingConfigDelta, SimVariant } from "../types/simulation";

function valueEquals(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

/** Compare the scalar/array parameter fields. Returns only the keys that changed. */
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

// Compare two filter/condition collections (matched by fieldName) and return EVERY change:
// a changed or added filter yields its new value; a filter present in baseline but gone from
// the snapshot yields fieldValue: null — the backend treats a null fieldValue as "clear this
// field" (see stripNullish in runBrokeringGroupSimulation.ts).
function filterChanges(
  baseFilters: any[] | undefined,
  snapFilters: any[] | undefined,
): { fieldName: string; fieldValue: unknown }[] {
  const b = baseFilters ?? [];
  const s = snapFilters ?? [];
  const changes: { fieldName: string; fieldValue: unknown }[] = [];

  // changed or added
  for (const sf of s) {
    const bf = b.find((x) => x.fieldName === sf.fieldName);
    if (!bf || !valueEquals(bf.fieldValue, sf.fieldValue)) {
      changes.push({ fieldName: sf.fieldName, fieldValue: sf.fieldValue });
    }
  }
  // removed (in baseline, absent from snapshot) → clear via null
  for (const bf of b) {
    if (!s.some((sf) => sf.fieldName === bf.fieldName)) {
      changes.push({ fieldName: bf.fieldName, fieldValue: null });
    }
  }
  return changes;
}

/** Diff the routing/rule hierarchy. Routings and rules are matched by id; new rules (no
 *  routingRuleId) become ADD_RULE; rules missing from the snapshot become REMOVE_RULE. */
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
      // per-rule allocation toggle (ORA_SINGLE / ORA_MULTI)
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

/** Merge a productStoreId into every variant's parameterOverrides for the submit body, so the backend
 *  scopes each run to the right store. Applied AFTER isNoOp filtering (it's constant context, not a
 *  change vs baseline). Pure: returns new variants, never mutates input; a blank id is a no-op. */
export function applyProductStoreId(variants: SimVariant[], productStoreId: string): SimVariant[] {
  if (!productStoreId) return variants;
  return variants.map((v) => ({
    ...v,
    parameterOverrides: { ...v.parameterOverrides, productStoreId },
  }));
}
