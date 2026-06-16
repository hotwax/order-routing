// tests/traceRollup.test.ts
import assert from "node:assert";
import { outcomeCounts, facilityRollup, compareFacilities, queuedDiff, describeRuleAttempts } from "../src/util/simulationResults";
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

// --- compareFacilities ---
assert.deepStrictEqual(compareFacilities(undefined, undefined), []);

const cmp = compareFacilities(
  [trace("O1", "FULLY_BROKERED", [["WH_NYC", 1]]), trace("O2", "FULLY_BROKERED", [["WH_NYC", 1]])],
  [trace("O1", "FULLY_BROKERED", [["WH_NYC", 1]]), trace("O2", "FULLY_BROKERED", [["STORE_LA", 1]]), trace("O3", "FULLY_BROKERED", [["STORE_LA", 2]])],
);
// Sorted by variationQty desc; union of both sides; delta = variation - parent (itemCount based).
assert.deepStrictEqual(cmp, [
  { facilityId: "STORE_LA", parentQty: 0, variationQty: 2, delta: 2 },
  { facilityId: "WH_NYC", parentQty: 2, variationQty: 1, delta: -1 },
]);

// --- queuedDiff ---
assert.deepStrictEqual(queuedDiff(undefined, undefined), []);

const queued = queuedDiff(
  [trace("O1", "QUEUED", [], "00101"), trace("O2", "FULLY_BROKERED", [], "00101")],
  [trace("O1", "QUEUED", [], "00101"), trace("O2", "QUEUED", [], "00101"), trace("O3", "FULLY_BROKERED", [], "00101")],
);
// O1 queued in both -> not new; O2 newly queued; O3 not queued at all.
assert.deepStrictEqual(queued, [
  { orderId: "O1", shipGroupSeqId: "00001", orderItemSeqId: "00101", newlyQueued: false },
  { orderId: "O2", shipGroupSeqId: "00001", orderItemSeqId: "00101", newlyQueued: true },
]);

// No parent traces -> no baseline -> never flagged "newly queued" (avoids a false claim).
assert.deepStrictEqual(
  queuedDiff(undefined, [trace("O9", "QUEUED", [], "00101")]),
  [{ orderId: "O9", shipGroupSeqId: "00001", orderItemSeqId: "00101", newlyQueued: false }],
);

// Facility present only in the parent still appears (union join), with a negative delta.
assert.deepStrictEqual(
  compareFacilities([trace("O8", "FULLY_BROKERED", [["WH_NYC", 2]])], []),
  [{ facilityId: "WH_NYC", parentQty: 1, variationQty: 0, delta: -1 }],
);

// Queueing is keyed per order ITEM: same order, different item seq -> newly queued.
assert.deepStrictEqual(
  queuedDiff([trace("O1", "QUEUED", [], "00101")], [trace("O1", "QUEUED", [], "00102")]),
  [{ orderId: "O1", shipGroupSeqId: "00001", orderItemSeqId: "00102", newlyQueued: true }],
);

// Empty parent array is a real baseline ("parent queued nothing"), unlike undefined -> flags apply.
assert.deepStrictEqual(
  queuedDiff([], [trace("O10", "QUEUED", [], "00101")]),
  [{ orderId: "O10", shipGroupSeqId: "00001", orderItemSeqId: "00101", newlyQueued: true }],
);

// --- describeRuleAttempts ---
assert.deepStrictEqual(describeRuleAttempts({ orderId: "O1", finalReason: "QUEUED" }), []);

const lines = describeRuleAttempts({
  orderId: "O1",
  finalReason: "FULLY_BROKERED",
  ruleAttempts: [
    { routingRuleId: "RR1", sequenceNum: 1, outcome: "NO_INVENTORY" },
    { routingRuleId: "RR2", sequenceNum: 2, outcome: "FULL_BROKER" },
    { routingRuleId: "RR3", sequenceNum: 3, outcome: "SOME_NEW_OUTCOME" },
    { routingRuleId: "RR4", sequenceNum: 4, outcome: "ERROR", errorMessage: "timeout" },
    { routingRuleId: "RR5", sequenceNum: 5, outcome: "SKIPPED_BY_ACTION" },
    { routingRuleId: "RR6", outcome: null },
  ],
});
assert.deepStrictEqual(lines, [
  "Rule 1: no available inventory — fell through",
  "Rule 2: fully brokered here",
  "Rule 3: some new outcome",      // unknown outcomes humanize instead of breaking
  "Rule 4: errored (timeout)",
  "Rule 5: skipped by action filter",
  "Rule ?: unknown outcome",       // null outcome and missing sequenceNum degrade gracefully
]);

// Attempts narrate in sequenceNum order even when the payload is unordered.
assert.deepStrictEqual(
  describeRuleAttempts({
    orderId: "O1",
    finalReason: "FULLY_BROKERED",
    ruleAttempts: [
      { routingRuleId: "RR2", sequenceNum: 2, outcome: "FULL_BROKER" },
      { routingRuleId: "RR1", sequenceNum: 1, outcome: "NO_INVENTORY" },
    ],
  }),
  ["Rule 1: no available inventory — fell through", "Rule 2: fully brokered here"],
);

// Two ship groups of the same order item are distinct queued rows.
const twoShipGroups = queuedDiff(undefined, [
  { orderId: "O11", shipGroupSeqId: "00001", orderItemSeqId: "00101", finalReason: "QUEUED" },
  { orderId: "O11", shipGroupSeqId: "00002", orderItemSeqId: "00101", finalReason: "QUEUED" },
]);
assert.strictEqual(twoShipGroups.length, 2);
assert.notStrictEqual(twoShipGroups[0].shipGroupSeqId, twoShipGroups[1].shipGroupSeqId);

console.log("traceRollup tests passed");
