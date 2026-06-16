// tests/persistedSimulationAdapter.test.ts
// Backend R2 shape (confirmed): { simulation: {header}, variants: [...] }. JSON fields arrive
// already PARSED (variant.diff is an object); the raw *Json strings are ignored.
import assert from "assert";
import { persistedSimulationAdapter } from "../src/util/simulationResults";

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

// Phase 1: any incoming `outcomes` is intentionally dropped (rich panels degrade until backend adds it to R2).
{
  const raw = { simulation: { runType: "SINGLE", statusId: "COMPLETE", partial: "N", simulationRan: "Y" },
    variants: [{ variantSeqId: 0, isBaseline: "Y", failed: "N", brokeredItemCount: 1, attemptedItemCount: 1, queuedItemCount: 0, outcomes: { leak: true } }] };
  assert.strictEqual(persistedSimulationAdapter(raw).baseline.outcomes, null, "outcomes is always null in Phase 1");
}

console.log("persistedSimulationAdapter tests passed");
