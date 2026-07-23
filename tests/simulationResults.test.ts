import { describe, expect, it } from "vitest";
import {
  compareFacilities,
  describeRuleAttempts,
  fillRateOf,
  joinRoutingResults,
  persistedSimulationAdapter,
  queuedDiff,
  toRows,
} from "@/utils/simulationResults";
import type { OrderTrace, RoutingRunResult } from "@/types/variation";

const run = (orderRoutingId: string, sequenceNum: number, eligibleEntryCount: number): RoutingRunResult => ({
  orderRoutingId,
  sequenceNum,
  eligibleEntryCount,
  attemptedItemCount: eligibleEntryCount,
  brokeredItemCount: 0,
  queuedItemCount: 0,
});

const trace = (
  orderId: string,
  finalReason: string,
  facilityId?: string,
  shipGroupSeqId = "00001",
  orderItemSeqId = "00101",
): OrderTrace => ({
  orderId,
  shipGroupSeqId,
  orderItemSeqId,
  finalReason,
  finalAssignments: facilityId ? [{
    orderId,
    shipGroupSeqId,
    orderItemSeqId,
    facilityId,
    routedQty: 1,
    itemQty: 1,
  }] : [],
});

describe("persisted simulation results", () => {
  it("adapts the confirmed list/detail contract into baseline and variation rows", () => {
    const adapted = persistedSimulationAdapter({
      simulation: { simulationId: "SIM_1", partial: "N", simulationRan: "Y" },
      variants: [
        { isBaseline: "Y", attemptedItemCount: 100, brokeredItemCount: 80, queuedItemCount: 20 },
        {
          isBaseline: "N",
          label: "Tighter distance",
          attemptedItemCount: 100,
          brokeredItemCount: 90,
          queuedItemCount: 10,
          diff: { routingBrokeredDelta: 10 },
        },
      ],
    });

    expect(adapted.baseline).toMatchObject({ attemptedItemCount: 100, brokeredItemCount: 80, queuedItemCount: 20 });
    expect(adapted.variants).toEqual([expect.objectContaining({
      label: "Tighter distance",
      groupRun: expect.objectContaining({ brokeredItemCount: 90 }),
      diff: { routingBrokeredDelta: 10 },
      failed: false,
    })]);
    expect(toRows(adapted).map(({ label }) => label)).toEqual(["Baseline", "Tighter distance"]);
    expect(fillRateOf(toRows(adapted)[1])).toBe(0.9);
  });

  it("marks failed variants as partial and safely handles missing counts", () => {
    const adapted = persistedSimulationAdapter({
      simulation: { partial: "N", simulationRan: "N" },
      variants: [
        { isBaseline: "Y" },
        { isBaseline: "N", label: "Broken", failed: "Y", failureReason: "timeout" },
      ],
    });

    expect(adapted.baseline).toMatchObject({ attemptedItemCount: 0, brokeredItemCount: 0, queuedItemCount: 0 });
    expect(adapted.variants[0]).toMatchObject({ failed: true, failureReason: "timeout" });
    expect(adapted.partial).toBe(true);
    expect(adapted.simulationRan).toBe(false);
  });
});

describe("parent and variation comparison", () => {
  it("joins prefixed variation routings with the parent and retains parent-only rows", () => {
    const rows = joinRoutingResults({
      variationGroupId: "VM100204",
      parentResults: [run("100008", 5, 0), run("100009", 6, 12)],
      variationResults: [run("VM100204_100008", 5, 150)],
      routingNameById: {
        "100008": "Standard",
        "VM100204_100008": "Standard",
        "100009": "Express",
      },
    });

    expect(rows.map(({ routingName }) => routingName)).toEqual(["Standard", "Express"]);
    expect(rows[0]).toMatchObject({ parentRoutingId: "100008", variationRoutingId: "VM100204_100008" });
    expect(rows[1]).toMatchObject({ parentRoutingId: "100009", variationRoutingId: null, variation: null });
  });

  it("reports facility allocation and queue changes without inventing a baseline", () => {
    const parent = [trace("O1", "FULLY_BROKERED", "WH"), trace("O2", "QUEUED")];
    const variation = [
      trace("O1", "FULLY_BROKERED", "STORE"),
      trace("O2", "QUEUED"),
      trace("O3", "QUEUED"),
    ];

    expect(compareFacilities(parent, variation)).toEqual([
      { facilityId: "STORE", parentQty: 0, variationQty: 1, delta: 1 },
      { facilityId: "WH", parentQty: 1, variationQty: 0, delta: -1 },
    ]);
    expect(queuedDiff(parent, variation)).toEqual([
      { orderId: "O2", shipGroupSeqId: "00001", orderItemSeqId: "00101", newlyQueued: false },
      { orderId: "O3", shipGroupSeqId: "00001", orderItemSeqId: "00101", newlyQueued: true },
    ]);
    expect(queuedDiff(undefined, [trace("O3", "QUEUED")])[0].newlyQueued).toBe(false);
  });

  it("turns ordered rule attempts into readable operational explanations", () => {
    expect(describeRuleAttempts({
      orderId: "O1",
      finalReason: "FULLY_BROKERED",
      ruleAttempts: [
        { routingRuleId: "R2", sequenceNum: 2, outcome: "FULL_BROKER" },
        { routingRuleId: "R1", sequenceNum: 1, outcome: "NO_INVENTORY" },
        { routingRuleId: "R3", sequenceNum: 3, outcome: "ERROR", errorMessage: "timeout" },
      ],
    })).toEqual([
      "Rule 1: no available inventory — fell through",
      "Rule 2: fully brokered here",
      "Rule 3: errored (timeout)",
    ]);
  });
});
