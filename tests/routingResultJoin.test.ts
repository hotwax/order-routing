// tests/routingResultJoin.test.ts
import assert from "node:assert";
import { joinRoutingResults } from "../src/utils/simulationResults";
import type { RoutingRunResult } from "../src/types/variation";

const r = (id: string, seq: number, elig: number): RoutingRunResult => ({
  orderRoutingId: id, sequenceNum: seq, eligibleEntryCount: elig,
  attemptedItemCount: elig, brokeredItemCount: 0, queuedItemCount: 0,
});

it("joins parent and variation routing results", () => {
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
});

it("joins persist-on-save routing ids by their stable routing names", () => {
  const parentResults = [
    r("P_UNFILLABLE", 1, 0),
    r("P_EXPEDITED", 2, 47),
    r("P_STANDARD", 3, 328),
  ];
  const variationResults = [
    r("V42_r0", 1, 328),
    r("V42_r1", 2, 45),
    r("V42_r2", 3, 0),
  ];
  const routingNameById = {
    P_UNFILLABLE: "Unfillable Standard Orders",
    P_EXPEDITED: "Expedited Orders",
    P_STANDARD: "Standard Order",
    V42_r0: "Unfillable Standard Orders",
    V42_r1: "Expedited Orders",
    V42_r2: "Standard Order",
  };

  const rows = joinRoutingResults({
    variationGroupId: "V42", parentResults, variationResults, routingNameById,
  });

  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(rows.map((row) => row.routingName), [
    "Unfillable Standard Orders",
    "Expedited Orders",
    "Standard Order",
  ]);
  assert.deepStrictEqual(rows.map((row) => [
    row.parentRoutingId,
    row.variationRoutingId,
    row.parent?.eligibleEntryCount,
    row.variation?.eligibleEntryCount,
  ]), [
    ["P_UNFILLABLE", "V42_r0", 0, 328],
    ["P_EXPEDITED", "V42_r1", 47, 45],
    ["P_STANDARD", "V42_r2", 328, 0],
  ]);
});

it("uses sequence only to disambiguate duplicate routing names", () => {
  const parentResults = [r("P1", 4, 10), r("P2", 9, 20)];
  const variationResults = [r("V7_r0", 9, 25), r("V7_r1", 4, 15)];
  const routingNameById = { P1: "Standard", P2: "Standard", V7_r0: "Standard", V7_r1: "Standard" };

  const rows = joinRoutingResults({
    variationGroupId: "V7", parentResults, variationResults, routingNameById,
  });

  assert.strictEqual(rows.length, 2);
  const sequenceFour = rows.find((row) => row.variation?.sequenceNum === 4)!;
  const sequenceNine = rows.find((row) => row.variation?.sequenceNum === 9)!;
  assert.strictEqual(sequenceFour.parentRoutingId, "P1");
  assert.strictEqual(sequenceNine.parentRoutingId, "P2");
});

it("does not manufacture a parent match when duplicate names remain ambiguous", () => {
  const parentResults = [r("P1", 1, 10), r("P2", 2, 20)];
  const variationResults = [r("V8_r0", 3, 30)];
  const routingNameById = { P1: "Standard", P2: "Standard", V8_r0: "Standard" };

  const rows = joinRoutingResults({
    variationGroupId: "V8", parentResults, variationResults, routingNameById,
  });

  assert.strictEqual(rows.length, 3);
  const variationOnly = rows.find((row) => row.variationRoutingId === "V8_r0")!;
  assert.strictEqual(variationOnly.parent, null);
  assert.strictEqual(rows.filter((row) => row.variation === null).length, 2);
});

console.log("routingResultJoin tests passed");
