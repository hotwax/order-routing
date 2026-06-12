// tests/traceRollup.test.ts
import assert from "node:assert";
import { outcomeCounts, facilityRollup } from "../src/util/traceRollup";
import type { OrderTrace } from "../src/types/variation";

const trace = (orderId: string, finalReason: string | null, assignments: Array<[string | null, number]> = [], orderItemSeqId = "00101"): OrderTrace => ({
  orderId,
  orderItemSeqId,
  shipGroupSeqId: "00001",
  finalReason,
  finalAssignments: assignments.map(([facilityId, routedQty]) => ({
    orderId, orderItemSeqId, shipGroupSeqId: "00001", facilityId, routedQty, itemQty: routedQty,
  })),
  ruleAttempts: [],
});

// --- outcomeCounts ---
assert.deepStrictEqual(outcomeCounts(undefined), {});
assert.deepStrictEqual(outcomeCounts([]), {});
assert.deepStrictEqual(
  outcomeCounts([
    trace("O1", "FULLY_BROKERED"),
    trace("O2", "FULLY_BROKERED"),
    trace("O3", "QUEUED"),
  ]),
  { FULLY_BROKERED: 2, QUEUED: 1 },
);

// finalReason null -> bucketed as UNKNOWN.
assert.deepStrictEqual(outcomeCounts([trace("O5", null)]), { UNKNOWN: 1 });

// --- facilityRollup ---
assert.deepStrictEqual(facilityRollup(undefined), []);
assert.deepStrictEqual(facilityRollup([trace("O1", "UNFILLABLE")]), []); // no assignments -> empty

const rolled = facilityRollup([
  trace("O1", "FULLY_BROKERED", [["WH_NYC", 2]]),
  trace("O2", "FULLY_BROKERED", [["WH_NYC", 1], ["STORE_LA", 3]]),
  trace("O3", "PARTIALLY_BROKERED", [["STORE_LA", 1]]),
]);
// Sorted by itemCount desc, ties by facilityId asc.
assert.deepStrictEqual(rolled, [
  { facilityId: "STORE_LA", itemCount: 2, totalRoutedQty: 4 },
  { facilityId: "WH_NYC", itemCount: 2, totalRoutedQty: 3 },
]);

// Backordered (null facilityId) assignments are excluded from the per-facility rollup.
assert.deepStrictEqual(
  facilityRollup([trace("O4", "PARTIALLY_BROKERED", [["WH_NYC", 1], [null, 2]])]),
  [{ facilityId: "WH_NYC", itemCount: 1, totalRoutedQty: 1 }],
);

// Primary sort key is itemCount desc (not just the tie-break).
assert.deepStrictEqual(
  facilityRollup([
    trace("O6", "FULLY_BROKERED", [["A_FIRST_ALPHA", 9]]),
    trace("O7", "FULLY_BROKERED", [["Z_LAST", 1], ["Z_LAST", 1]]),
  ]),
  [
    { facilityId: "Z_LAST", itemCount: 2, totalRoutedQty: 2 },
    { facilityId: "A_FIRST_ALPHA", itemCount: 1, totalRoutedQty: 9 },
  ],
);

console.log("traceRollup tests passed");
