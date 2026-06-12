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
