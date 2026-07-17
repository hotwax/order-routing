// tests/persistedSimulationAdapter.test.ts
// Backend R2 shape (confirmed): { simulation: {header}, variants: [...] }. JSON fields arrive
// already PARSED (variant.diff is an object); the raw *Json strings are ignored.
import assert from "assert";
import { persistedSimulationAdapter } from "../src/utils/simulationResults";

it("adapts persisted simulation responses", () => {
// VARIATION run: baseline + one variant; diff is a parsed object.
{
  const raw = {
    simulation: { simulationId: "SIM_1", runType: "VARIATION", statusId: "COMPLETE",
      partial: "N", simulationRan: "Y", createdDate: 1780984319839 },
    variants: [
      { variantSeqId: 0, label: "baseline", isBaseline: "Y", failed: "N",
        attemptedItemCount: 100, brokeredItemCount: 80, queuedItemCount: 20 },
      { variantSeqId: 1, label: "Tighter distance", isBaseline: "N", failed: "N",
        attemptedItemCount: 100, brokeredItemCount: 90, queuedItemCount: 10,
        diff: { routingBrokeredDelta: 10 } },
    ],
  };
  const out = persistedSimulationAdapter(raw);
  assert.deepStrictEqual(out.baseline, { brokeredItemCount: 80, attemptedItemCount: 100, queuedItemCount: 20, outcomes: null }, "baseline counts from isBaseline variant");
  assert.strictEqual(out.variants.length, 1, "one non-baseline variant");
  assert.strictEqual(out.variants[0].label, "Tighter distance");
  assert.deepStrictEqual(out.variants[0].groupRun, { brokeredItemCount: 90, attemptedItemCount: 100, queuedItemCount: 10, outcomes: null });
  assert.deepStrictEqual(out.variants[0].diff, { routingBrokeredDelta: 10 }, "parsed diff object used");
  assert.strictEqual(out.variants[0].failed, false);
  assert.strictEqual(out.partial, false);
  assert.strictEqual(out.simulationRan, true);
  assert.strictEqual(out.identity.kind, "baseline");
}

// Synchronous parent/variation history records are distinguished by the explicit variationGroupId,
// never by response ordering or their near-identical timestamps/counts (live UAT M100375/M100374).
{
  const baseline = persistedSimulationAdapter({
    simulation: { simulationId: "M100375", routingGroupId: "M100255", runType: "SINGLE", statusId: "COMPLETE", simulationRan: "Y" },
    variants: [{ isBaseline: "Y", brokeredItemCount: 16, attemptedItemCount: 663, queuedItemCount: 532 }]
  });
  const variation = persistedSimulationAdapter({
    simulation: { simulationId: "M100374", routingGroupId: "M100255", variationGroupId: "VM100005", runType: "SINGLE", statusId: "COMPLETE", simulationRan: "Y" },
    variants: [{ isBaseline: "Y", brokeredItemCount: 16, attemptedItemCount: 663, queuedItemCount: 532 }]
  });

  assert.strictEqual(baseline.identity.kind, "baseline");
  assert.strictEqual(baseline.baseline.brokeredItemCount, 16);
  assert.deepStrictEqual(baseline.variants, []);
  assert.deepStrictEqual(variation.identity, {
    kind: "variation", label: "VM100005", routingGroupId: "M100255", variationGroupId: "VM100005"
  });
  assert.strictEqual(variation.baseline, null);
  assert.strictEqual(variation.variants[0].label, "VM100005");
  assert.strictEqual(variation.variants[0].groupRun.brokeredItemCount, 16);
}

// Prefer explicit display metadata when the backend supplies it, while retaining id association.
{
  const out = persistedSimulationAdapter({
    simulation: { routingGroupId: "M100255", variationGroupId: "VM100005", variationName: "Codex live check 2026-07-16" },
    variants: [{ isBaseline: "Y", brokeredItemCount: 2, attemptedItemCount: 3 }]
  });
  assert.strictEqual(out.identity.label, "Codex live check 2026-07-16");
  assert.strictEqual(out.variants[0].label, "Codex live check 2026-07-16");
}

// Robustness: a raw diffJson string is still parsed if `diff` is absent (defensive fallback).
{
  const raw = { simulation: { runType: "VARIATION", statusId: "COMPLETE", partial: "N", simulationRan: "Y" },
    variants: [
      { variantSeqId: 0, isBaseline: "Y", failed: "N", brokeredItemCount: 1, attemptedItemCount: 1, queuedItemCount: 0 },
      { variantSeqId: 1, label: "V", isBaseline: "N", failed: "N", brokeredItemCount: 1, attemptedItemCount: 1, queuedItemCount: 0, diffJson: '{"routingBrokeredDelta":0}' },
    ] };
  assert.deepStrictEqual(persistedSimulationAdapter(raw).variants[0].diff, { routingBrokeredDelta: 0 }, "diffJson string fallback parsed");
}

// SINGLE run: only synthetic baseline → variants empty, baseline from it.
{
  const raw = { simulation: { runType: "SINGLE", statusId: "COMPLETE", partial: "N", simulationRan: "Y" },
    variants: [{ variantSeqId: 0, isBaseline: "Y", failed: "N", brokeredItemCount: 5, attemptedItemCount: 6, queuedItemCount: 1 }] };
  const out = persistedSimulationAdapter(raw);
  assert.deepStrictEqual(out.baseline, { brokeredItemCount: 5, attemptedItemCount: 6, queuedItemCount: 1, outcomes: null });
  assert.deepStrictEqual(out.variants, []);
}

// partial = header.partial OR any variant.failed; failed flag mapped; failureReason carried.
{
  const raw = { simulation: { runType: "VARIATION", statusId: "COMPLETE", partial: "N", simulationRan: "Y" },
    variants: [
      { variantSeqId: 0, isBaseline: "Y", failed: "N", brokeredItemCount: 0, attemptedItemCount: 0, queuedItemCount: 0 },
      { variantSeqId: 1, label: "Boom", isBaseline: "N", failed: "Y", failureReason: "timeout", brokeredItemCount: 0, attemptedItemCount: 0, queuedItemCount: 0 },
    ] };
  const out = persistedSimulationAdapter(raw);
  assert.strictEqual(out.partial, true, "partial true when a variant failed");
  assert.strictEqual(out.variants[0].failed, true);
  assert.strictEqual(out.variants[0].failureReason, "timeout");
}

// missing/null counts default to 0; simulationRan=N honored; unknown id (simulation:null) → empty.
{
  const raw = { simulation: { runType: "SINGLE", statusId: "COMPLETE", partial: "N", simulationRan: "N" },
    variants: [{ variantSeqId: 0, isBaseline: "Y", failed: "N" }] };
  const out = persistedSimulationAdapter(raw);
  assert.deepStrictEqual(out.baseline, { brokeredItemCount: 0, attemptedItemCount: 0, queuedItemCount: 0, outcomes: null });
  assert.strictEqual(out.simulationRan, false);

  const empty = persistedSimulationAdapter({ simulation: null, variants: [] });
  assert.deepStrictEqual(empty.variants, [], "unknown id → no variants");
}

// A failed single run has no non-baseline row; carry the header failure into the rendered baseline.
{
  const out = persistedSimulationAdapter({
    simulation: { runType: "SINGLE", statusId: "FAILED", failureReason: "inventory snapshot unavailable", simulationRan: "N" },
    variants: []
  });
  assert.strictEqual(out.baseline.failed, true);
  assert.strictEqual(out.baseline.failureReason, "inventory snapshot unavailable");
  assert.strictEqual(out.partial, false);
}

// Phase 1: any incoming `outcomes` is intentionally dropped (rich panels degrade until backend adds it to R2).
{
  const raw = { simulation: { runType: "SINGLE", statusId: "COMPLETE", partial: "N", simulationRan: "Y" },
    variants: [{ variantSeqId: 0, isBaseline: "Y", failed: "N", brokeredItemCount: 1, attemptedItemCount: 1, queuedItemCount: 0, outcomes: { leak: true } }] };
  assert.strictEqual(persistedSimulationAdapter(raw).baseline.outcomes, null, "outcomes is always null in Phase 1");
}

console.log("persistedSimulationAdapter tests passed");
});
