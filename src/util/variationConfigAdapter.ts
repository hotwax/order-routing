// src/util/variationConfigAdapter.ts
// Pure bidirectional adapter between the canvas's OMS-normalized routing tree (orderFilters /
// inventoryFilters, with exclusion filters carrying a `_excluded` fieldName suffix) and the
// sim-routing variation `/config` shape (filters / inventoryConditions / actions). No runtime imports
// beyond types — safe under `npx tsx`.

const isExclusion = (operator: string | null | undefined) => operator === "not-equals" || operator === "not-in";

/** Strip the canvas's `_excluded` suffix so the payload carries the bare field name (the operator
 *  already encodes the exclusion). Mirrors the inbound rewrite in reverse. */
function stripExcluded(fieldName: string | null): string | null {
  return typeof fieldName === "string" ? fieldName.replace(/_excluded$/, "") : fieldName;
}

/** Re-apply the canvas's `_excluded` suffix for exclusion operators (mirrors
 *  normalizeRoutingGroupHierarchy in RoutingGroupService). */
function applyExcluded(fieldName: string | null, operator: string | null): string | null {
  if (typeof fieldName !== "string" || !isExclusion(operator)) return fieldName;
  return fieldName.replace(/_excluded$/, "") + "_excluded";
}

function bySeq<T extends { sequenceNum?: number }>(items: T[] | undefined): T[] {
  return (items ?? []).slice().sort((a, b) => (a.sequenceNum ?? 0) - (b.sequenceNum ?? 0));
}

// ---- Outbound: canvas tree -> PUT /config payload -----------------------------------------------

function conditionOut(c: any) {
  return {
    conditionTypeEnumId: c.conditionTypeEnumId ?? "ENTCT_FILTER",
    fieldName: stripExcluded(c.fieldName ?? null),
    operator: c.operator ?? null,
    fieldValue: c.fieldValue ?? null,
    sequenceNum: c.sequenceNum ?? 0,
  };
}

function ruleOut(r: any) {
  return {
    ruleName: r.ruleName,
    statusId: r.statusId,
    sequenceNum: r.sequenceNum ?? 0,
    assignmentEnumId: r.assignmentEnumId,
    inventoryConditions: (r.inventoryFilters ?? []).map(conditionOut),
    actions: (r.actions ?? []).map((a: any) => ({ actionTypeEnumId: a.actionTypeEnumId, actionValue: a.actionValue ?? null })),
  };
}

/** Map the canvas `working.routings` tree to the `{ routings: [...] }` body for PUT /config.
 *  Node ids are intentionally dropped — the backend ignores them and assigns fresh ones. */
export function toConfigPayload(routings: any[]): { routings: any[] } {
  return {
    routings: (routings ?? []).map((rt: any) => ({
      routingName: rt.routingName,
      statusId: rt.statusId,
      sequenceNum: rt.sequenceNum ?? 0,
      filters: (rt.orderFilters ?? []).map(conditionOut),
      rules: (rt.rules ?? []).map(ruleOut),
    })),
  };
}

// ---- Inbound: variation tree (GET / config response) -> canvas shape ----------------------------

function conditionIn(c: any) {
  return {
    conditionSeqId: c.conditionSeqId,
    conditionTypeEnumId: c.conditionTypeEnumId ?? "ENTCT_FILTER",
    fieldName: applyExcluded(c.fieldName ?? null, c.operator ?? null),
    operator: c.operator ?? null,
    fieldValue: c.fieldValue ?? null,
    sequenceNum: c.sequenceNum ?? 0,
  };
}

function ruleIn(r: any) {
  return {
    routingRuleId: r.routingRuleId,
    ruleName: r.ruleName,
    statusId: r.statusId,
    sequenceNum: r.sequenceNum ?? 0,
    assignmentEnumId: r.assignmentEnumId,
    inventoryFilters: bySeq((r.inventoryConditions ?? []).map(conditionIn)),
    actions: (r.actions ?? []).map((a: any) => ({
      actionSeqId: a.actionSeqId, actionTypeEnumId: a.actionTypeEnumId, actionValue: a.actionValue ?? null,
    })),
  };
}

/** Map a variation's `routings` tree (from GET /variations or the /config response) into the
 *  canvas's `working`-tree shape: filters -> orderFilters, inventoryConditions -> inventoryFilters,
 *  with `_excluded` rewrite and sequence sorting. Mirrors normalizeRoutingGroupHierarchy. */
export function fromVariationRoutings(routings: any[]): any[] {
  return bySeq((routings ?? []).map((rt: any) => ({
    orderRoutingId: rt.orderRoutingId,
    routingName: rt.routingName,
    statusId: rt.statusId,
    sequenceNum: rt.sequenceNum ?? 0,
    orderFilters: bySeq((rt.filters ?? []).map(conditionIn)),
    rules: bySeq((rt.rules ?? []).map(ruleIn)),
  })));
}
