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

function firstFilterChange(
  baseFilters: any[] | undefined,
  snapFilters: any[] | undefined,
): { fieldName: string; fieldValue: unknown } | null {
  const b = baseFilters ?? [];
  const s = snapFilters ?? [];
  for (const sf of s) {
    const bf = b.find((x) => x.fieldName === sf.fieldName);
    if (!bf || !valueEquals(bf.fieldValue, sf.fieldValue)) {
      return { fieldName: sf.fieldName, fieldValue: sf.fieldValue };
    }
  }
  return null;
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
      const filterChange = firstFilterChange(baseRouting.orderFilters, snapRouting.orderFilters);
      if (filterChange) {
        deltas.push({ op: "SET_ROUTING_FILTER", orderRoutingId: snapRouting.orderRoutingId, ...filterChange });
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
      const invChange = firstFilterChange(baseRule.inventoryFilters, snapRule.inventoryFilters);
      if (invChange) {
        deltas.push({ op: "SET_RULE_INV_COND", routingRuleId: snapRule.routingRuleId, ...invChange });
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
