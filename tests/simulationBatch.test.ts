import assert from "assert";
import { chunkVariants, mergeVariationResults } from "../src/util/simulationBatch";

// chunk into batches of 5
{
  const variants = Array.from({ length: 12 }, (_, i) => ({ label: `v${i}`, parameterOverrides: {}, routingDeltas: [] }));
  const batches = chunkVariants(variants, 5);
  assert.strictEqual(batches.length, 3);
  assert.deepStrictEqual(batches.map((b) => b.length), [5, 5, 2]);
}
// merge: keep one baseline, concat variants in order
{
  const r1 = { variation: { baseline: { brokeredItemCount: 800 }, variants: [{ label: "a" }, { label: "b" }] } };
  const r2 = { variation: { baseline: { brokeredItemCount: 800 }, variants: [{ label: "c" }] } };
  const merged = mergeVariationResults([r1, r2]);
  assert.deepStrictEqual(merged.baseline, { brokeredItemCount: 800 });
  assert.deepStrictEqual(merged.variants.map((v) => v.label), ["a", "b", "c"]);
}
// merge tolerates a failed batch (null result)
{
  const ok = { variation: { baseline: { brokeredItemCount: 1 }, variants: [{ label: "a" }] } };
  const merged = mergeVariationResults([ok, null]);
  assert.deepStrictEqual(merged.variants.map((v) => v.label), ["a"]);
}

// baseline read from `groupRun` key (the backend's variation envelope shape)
{
  const r = { variation: { groupRun: { brokeredItemCount: 500 }, variants: [{ label: "a" }] } };
  const merged = mergeVariationResults([r]);
  assert.deepStrictEqual(merged.baseline, { brokeredItemCount: 500 }, "baseline read from variation.groupRun");
}

// verified backend shape: baseline counts nested under variation.baseline.groupRun
{
  const r = { variation: {
    baseline: { label: "Baseline (live config)", groupRun: { brokeredItemCount: 6, attemptedItemCount: 120, queuedItemCount: 128 }, diff: null },
    variants: [{ label: "100 miles", groupRun: { brokeredItemCount: 6 }, diff: {} }],
    partial: false, simulationRan: true,
  } };
  const merged = mergeVariationResults([r]);
  assert.deepStrictEqual(merged.baseline, { brokeredItemCount: 6, attemptedItemCount: 120, queuedItemCount: 128 }, "baseline read from variation.baseline.groupRun");
  assert.strictEqual(merged.simulationRan, true);
  assert.strictEqual(merged.variants[0].label, "100 miles");
}

console.log("simulationBatch tests passed");
