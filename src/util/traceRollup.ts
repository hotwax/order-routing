// src/util/traceRollup.ts
// Pure: derive drill-down rollups from a routing run's orderTraces.
// Every function tolerates undefined/empty traces (older payloads omit them) and returns an empty result.
import type { OrderTrace } from "../types/variation";

export interface FacilityRollupRow {
  facilityId: string;
  itemCount: number;       // number of assignments routed to this facility
  totalRoutedQty: number;  // sum of routedQty across those assignments
}

/** Count traces by finalReason, e.g. { FULLY_BROKERED: 120, QUEUED: 19 }. */
export function outcomeCounts(traces?: OrderTrace[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of traces ?? []) {
    const reason = t.finalReason || "UNKNOWN";
    counts[reason] = (counts[reason] || 0) + 1;
  }
  return counts;
}

/** Group finalAssignments by facility. Sorted by itemCount desc, ties by facilityId asc. */
export function facilityRollup(traces?: OrderTrace[]): FacilityRollupRow[] {
  const byFacility = new Map<string, FacilityRollupRow>();
  for (const t of traces ?? []) {
    for (const a of t.finalAssignments ?? []) {
      if (!a.facilityId) continue; // null == backordered: excluded from per-facility rollup
      const row = byFacility.get(a.facilityId) || { facilityId: a.facilityId, itemCount: 0, totalRoutedQty: 0 };
      row.itemCount += 1;
      row.totalRoutedQty += a.routedQty ?? 0;
      byFacility.set(a.facilityId, row);
    }
  }
  return [...byFacility.values()].sort((a, b) => b.itemCount - a.itemCount || a.facilityId.localeCompare(b.facilityId, "en"));
}

export interface FacilityCompareRow {
  facilityId: string;
  parentQty: number;     // itemCount in the parent run
  variationQty: number;  // itemCount in the variation run
  delta: number;         // variationQty - parentQty
}

/** Join both sides' facility rollups (itemCount). Sorted by variationQty desc, then parentQty desc, then id. */
export function compareFacilities(parentTraces?: OrderTrace[], variationTraces?: OrderTrace[]): FacilityCompareRow[] {
  const parent = new Map(facilityRollup(parentTraces).map((r) => [r.facilityId, r.itemCount]));
  const variation = new Map(facilityRollup(variationTraces).map((r) => [r.facilityId, r.itemCount]));
  const ids = new Set([...parent.keys(), ...variation.keys()]);
  return [...ids]
    .map((facilityId) => {
      const parentQty = parent.get(facilityId) ?? 0;
      const variationQty = variation.get(facilityId) ?? 0;
      return { facilityId, parentQty, variationQty, delta: variationQty - parentQty };
    })
    .sort((a, b) => b.variationQty - a.variationQty || b.parentQty - a.parentQty || a.facilityId.localeCompare(b.facilityId, "en"));
}

export interface QueuedItem {
  orderId: string;
  orderItemSeqId?: string;
  newlyQueued: boolean;
}

const itemKey = (t: { orderId: string; orderItemSeqId?: string }) => `${t.orderId}|${t.orderItemSeqId ?? ""}`;

/** The variation side's queued order items, flagged newlyQueued when the parent did not queue the same item.
 *  Pass parentTraces=undefined when there is no parent baseline — nothing gets flagged then (an empty array
 *  IS a baseline: everything queued is new). Items match by orderId + orderItemSeqId, so both sides must
 *  come from the same payload shape — an omitted seqId on one side only would read as a different item. */
export function queuedDiff(parentTraces: OrderTrace[] | undefined, variationTraces?: OrderTrace[]): QueuedItem[] {
  const hasParent = parentTraces != null;
  const parentQueued = new Set((parentTraces ?? []).filter((t) => t.finalReason === "QUEUED").map(itemKey));
  return (variationTraces ?? [])
    .filter((t) => t.finalReason === "QUEUED")
    .map((t) => ({ orderId: t.orderId, orderItemSeqId: t.orderItemSeqId, newlyQueued: hasParent && !parentQueued.has(itemKey(t)) }));
}
