import assert from "assert";
import { applyProductStoreId } from "../src/utils/simulationCompute";

it("applies the product store id without mutating variants", () => {
const variants = [
  { label: "A", parameterOverrides: { distance: 50 }, routingDeltas: [] as any[] },
  { label: "B", parameterOverrides: {}, routingDeltas: [{ op: "REMOVE_RULE", routingRuleId: "R" }] as any[] },
];

// Merges productStoreId into each variant's parameterOverrides, preserving existing overrides + deltas.
const out = applyProductStoreId(variants as any, "SM_STORE");
assert.deepStrictEqual(out[0].parameterOverrides, { distance: 50, productStoreId: "SM_STORE" }, "merges, keeps existing");
assert.deepStrictEqual(out[1].parameterOverrides, { productStoreId: "SM_STORE" }, "adds to empty overrides");
assert.deepStrictEqual(out[1].routingDeltas, [{ op: "REMOVE_RULE", routingRuleId: "R" }], "preserves routingDeltas");

// Blank id => variants returned unchanged (no productStoreId key injected).
const out2 = applyProductStoreId(variants as any, "");
assert.deepStrictEqual(out2[0].parameterOverrides, { distance: 50 }, "blank id leaves overrides untouched");

// Does not mutate the input variants.
assert.deepStrictEqual(variants[0].parameterOverrides, { distance: 50 }, "input not mutated");

console.log("applyProductStoreId tests passed");
});
