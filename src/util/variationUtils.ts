// src/util/variationUtils.ts
// Pure helpers for variation trees and the canvas <-> sim-routing API shape adapter.
// Merges: variationTree.ts, variationConfigAdapter.ts

import type { VariationCondition, VariationTree } from "../types/variation";

// ─── variationTree ────────────────────────────────────────────────────────────

export function isPlaceholder(c: Pick<VariationCondition, "operator" | "fieldValue">): boolean {
  return (c.operator === null || c.operator === undefined || c.operator === "") &&
         (c.fieldValue === null || c.fieldValue === undefined || c.fieldValue === "");
}

export function sortBySequence<T extends { sequenceNum: number }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (a.item.sequenceNum - b.item.sequenceNum) || (a.i - b.i))
    .map(({ item }) => item);
}

export function stripVariationPrefix(variationGroupId: string, orderRoutingId: string): string {
  const prefix = `${variationGroupId}_`;
  return orderRoutingId.startsWith(prefix) ? orderRoutingId.slice(prefix.length) : orderRoutingId;
}

export function buildRoutingNameMap(tree: Pick<VariationTree, "routings">): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of tree.routings || []) { map[r.orderRoutingId] = r.routingName; }
  return map;
}

export function nextSeqId(items: Array<Record<string, any>>, key: string): string {
  const max = (items || []).reduce((m, it) => Math.max(m, parseInt(it[key], 10) || 0), 0);
  return String(max + 1).padStart(2, "0");
}

// ─── variationConfigAdapter ───────────────────────────────────────────────────

const isExclusion = (operator: string | null | undefined) => operator === "not-equals" || operator === "not-in";

function stripExcluded(fieldName: string | null): string | null {
  return typeof fieldName === "string" ? fieldName.replace(/_excluded$/, "") : fieldName;
}

function applyExcluded(fieldName: string | null, operator: string | null): string | null {
  if (typeof fieldName !== "string" || !isExclusion(operator)) return fieldName;
  return fieldName.replace(/_excluded$/, "") + "_excluded";
}

function bySeq<T extends { sequenceNum?: number }>(items: T[] | undefined): T[] {
  return (items ?? []).slice().sort((a, b) => (a.sequenceNum ?? 0) - (b.sequenceNum ?? 0));
}

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

export function toConfigPayload(routings: any[]): any[] {
  return (routings ?? []).map((rt: any) => ({
    routingName: rt.routingName,
    statusId: rt.statusId,
    sequenceNum: rt.sequenceNum ?? 0,
    filters: (rt.orderFilters ?? []).map(conditionOut),
    rules: (rt.rules ?? []).map(ruleOut),
  }));
}

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
