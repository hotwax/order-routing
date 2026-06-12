// tests/traceRollup.test.ts
import assert from "node:assert";
import { outcomeCounts, facilityRollup } from "../src/util/traceRollup";
import type { OrderTrace } from "../src/types/variation";

const trace = (orderId: string, finalReason: string, assignments: Array<[string, number]> = [], orderItemSeqId = "00101"): OrderTrace => ({
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

console.log("traceRollup tests passed");
