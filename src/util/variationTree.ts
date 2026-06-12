// src/util/variationTree.ts
// Pure helpers for the variation tree. No runtime imports beyond types — safe under `npx tsx`.
import type { VariationCondition, VariationTree } from "../types/variation";

/** A condition with no operator AND no value is an unset placeholder the engine ignores. */
export function isPlaceholder(c: Pick<VariationCondition, "operator" | "fieldValue">): boolean {
  return (c.operator === null || c.operator === undefined || c.operator === "") &&
         (c.fieldValue === null || c.fieldValue === undefined || c.fieldValue === "");
}

/** Stable ascending sort by `sequenceNum`. Returns a new array. */
export function sortBySequence<T extends { sequenceNum: number }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (a.item.sequenceNum - b.item.sequenceNum) || (a.i - b.i))
    .map(({ item }) => item);
}

/** Recover the parent routing id by removing the "<variationGroupId>_" prefix. No-op if absent. */
export function stripVariationPrefix(variationGroupId: string, orderRoutingId: string): string {
  const prefix = `${variationGroupId}_`;

  return orderRoutingId.startsWith(prefix) ? orderRoutingId.slice(prefix.length) : orderRoutingId;
}

/** Map every routing's orderRoutingId -> routingName for display. */
export function buildRoutingNameMap(tree: Pick<VariationTree, "routings">): Record<string, string> {
  const map: Record<string, string> = {};
  for(const r of tree.routings || []) {map[r.orderRoutingId] = r.routingName;}

  return map;
}

/** Next 2-digit zero-padded seq id (one past the max numeric value of `key`). "01" when empty. */
export function nextSeqId(items: Array<Record<string, any>>, key: string): string {
  const max = (items || []).reduce((m, it) => Math.max(m, parseInt(it[key], 10) || 0), 0);

  return String(max + 1).padStart(2, "0");
}
