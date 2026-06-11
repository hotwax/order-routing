// src/util/routingResultJoin.ts
// Pure: join a variation run and the parent live-config run into per-routing compare rows.
// Run results carry orderRoutingId + counts but NO routingName, so we join by id suffix:
// variation "VM100204_100008" -> strip "VM100204_" -> "100008" == parent id. Names come from the trees.
import type { CompareRow, RoutingRunResult } from "../types/variation";
import { stripVariationPrefix } from "./variationTree";

export interface JoinArgs {
  variationGroupId: string;
  parentResults: RoutingRunResult[];
  variationResults: RoutingRunResult[];
  routingNameById: Record<string, string>; // both parent and variation ids -> name
}

export function joinRoutingResults(args: JoinArgs): CompareRow[] {
  const { variationGroupId, parentResults, variationResults, routingNameById } = args;
  const parentById = new Map(parentResults.map((p) => [p.orderRoutingId, p]));
  const seenParent = new Set<string>();
  const rows: CompareRow[] = [];

  // Variation rows first (they're the focus), matched to their parent by stripped id.
  for (const v of variationResults) {
    const parentId = stripVariationPrefix(variationGroupId, v.orderRoutingId);
    const parent = parentById.get(parentId) || null;

    if (parent) seenParent.add(parentId);
    rows.push({
      routingName: routingNameById[v.orderRoutingId] || routingNameById[parentId] || v.orderRoutingId,
      parentRoutingId: parent ? parentId : null,
      variationRoutingId: v.orderRoutingId,
      parent,
      variation: v,
    });
  }

  // Parent-only routings (active in parent, not present in the variation run).
  for (const p of parentResults) {
    if (seenParent.has(p.orderRoutingId)) continue;
    rows.push({
      routingName: routingNameById[p.orderRoutingId] || p.orderRoutingId,
      parentRoutingId: p.orderRoutingId,
      variationRoutingId: null,
      parent: p,
      variation: null,
    });
  }

  // Sort by the sequenceNum of whichever side exists (variation preferred).
  return rows.sort((a, b) => {
    const sa = a.variation?.sequenceNum ?? a.parent?.sequenceNum ?? 0;
    const sb = b.variation?.sequenceNum ?? b.parent?.sequenceNum ?? 0;

    return sa - sb;
  });
}
