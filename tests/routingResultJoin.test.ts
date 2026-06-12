// tests/routingResultJoin.test.ts
import assert from "node:assert";
import { joinRoutingResults } from "../src/util/routingResultJoin";
import type { RoutingRunResult } from "../src/types/variation";

const r = (id: string, seq: number, elig: number): RoutingRunResult => ({
  orderRoutingId: id, sequenceNum: seq, eligibleEntryCount: elig,
  attemptedItemCount: elig, brokeredItemCount: 0, queuedItemCount: 0,
});

const variationResults = [r("VM100204_100008", 5, 150)];
const parentResults = [r("100008", 5, 0), r("100009", 6, 12)];
const routingNameById = { "VM100204_100008": "Standard", "100008": "Standard", "100009": "Express" };

const rows = joinRoutingResults({
  variationGroupId: "VM100204", parentResults, variationResults, routingNameById,
});

// One row per routing: matched pair (Standard) + parent-only (Express). Sorted by sequenceNum.
assert.strictEqual(rows.length, 2);

const standard = rows.find((x) => x.routingName === "Standard")!;
assert.strictEqual(standard.parentRoutingId, "100008");
assert.strictEqual(standard.variationRoutingId, "VM100204_100008");
assert.strictEqual(standard.parent!.eligibleEntryCount, 0);
assert.strictEqual(standard.variation!.eligibleEntryCount, 150);

const express = rows.find((x) => x.routingName === "Express")!;
assert.strictEqual(express.parentRoutingId, "100009");
assert.strictEqual(express.variationRoutingId, null);
assert.strictEqual(express.variation, null);

// Sorted by sequenceNum (Standard seq 5 before Express seq 6).
assert.deepStrictEqual(rows.map((x) => x.routingName), ["Standard", "Express"]);

console.log("routingResultJoin tests passed");
