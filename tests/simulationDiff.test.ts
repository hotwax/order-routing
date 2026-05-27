import assert from "assert";
import { diffParameters, diffRoutings, buildVariant, isNoOp } from "../src/util/simulationDiff";

// Test Task 2: Parameter diff
{
  const baseline = { distance: 50, brokeringSafetyStock: 5 };
  const snapshot = { distance: 100, brokeringSafetyStock: 5 };
  const out = diffParameters(baseline, snapshot);
  assert.deepStrictEqual(out, { distance: 100 }, "only changed scalar included");
}
{
  const baseline = { inventorySortByList: ["A", "B"] };
  const snapshot = { inventorySortByList: ["A", "B"] };
  assert.deepStrictEqual(diffParameters(baseline, snapshot), {}, "equal arrays produce no override");
}
{
  const baseline = { inventorySortByList: ["A", "B"] };
  const snapshot = { inventorySortByList: ["B", "A"] };
  assert.deepStrictEqual(diffParameters(baseline, snapshot), { inventorySortByList: ["B", "A"] }, "reordered array is a change");
}

// Helper for Task 3
const baseRouting = () => ({
  orderRoutingId: "R1", routingName: "First", sequenceNum: 1,
  orderFilters: [{ fieldName: "salesChannelEnumId", fieldValue: "WEB" }],
  rules: [{
    routingRuleId: "RULE1", orderRoutingId: "R1", sequenceNum: 1,
    inventoryFilters: [{ fieldName: "atp", fieldValue: 0 }],
    actions: [{ actionTypeEnumId: "ORA_MV_TO_QUEUE", actionValue: "QUEUE_FAC" }],
  }],
});

// Test Task 3: Structural diff (diffRoutings)
{
  const baseline = { routings: [baseRouting()] };
  const snapshot = { routings: [baseRouting()] };
  assert.deepStrictEqual(diffRoutings(baseline, snapshot), [], "identical routings → no deltas");
}
{
  const baseline = { routings: [baseRouting()] };
  const snap = { routings: [baseRouting()] };
  snap.routings[0].rules[0].actions[0] = { actionTypeEnumId: "ORA_BROKER", actionValue: "FAC_A" };
  assert.deepStrictEqual(diffRoutings(baseline, snap), [
    { op: "SET_RULE_ACTION", routingRuleId: "RULE1", actionTypeEnumId: "ORA_BROKER", actionValue: "FAC_A" },
  ], "action change");
}
{
  const baseline = { routings: [baseRouting()] };
  const snap = { routings: [baseRouting()] };
  snap.routings[0].rules = [];
  assert.deepStrictEqual(diffRoutings(baseline, snap), [
    { op: "REMOVE_RULE", routingRuleId: "RULE1" },
  ], "removed rule");
}
{
  const baseline = { routings: [baseRouting()] };
  const snap = { routings: [baseRouting()] };
  snap.routings[0].rules.push({
    orderRoutingId: "R1", sequenceNum: 2,
    inventoryFilters: [], actions: [{ actionTypeEnumId: "ORA_BROKER", actionValue: "FAC_B" }],
  });
  const deltas = diffRoutings(baseline, snap);
  assert.strictEqual(deltas.length, 1);
  assert.strictEqual(deltas[0].op, "ADD_RULE");
  assert.strictEqual((deltas[0] as any).orderRoutingId, "R1");
  assert.ok((deltas[0] as any).ruleSeed.actions, "ruleSeed carries the new rule body");
}
{
  const baseline = { routings: [baseRouting()] };
  const snap = { routings: [baseRouting()] };
  snap.routings[0].rules[0].inventoryFilters[0].fieldValue = 10;
  assert.deepStrictEqual(diffRoutings(baseline, snap), [
    { op: "SET_RULE_INV_COND", routingRuleId: "RULE1", fieldName: "atp", fieldValue: 10 },
  ], "inventory condition change");
}
{
  const baseline = { routings: [baseRouting()] };
  const snap = { routings: [baseRouting()] };
  snap.routings[0].orderFilters[0].fieldValue = "POS";
  assert.deepStrictEqual(diffRoutings(baseline, snap), [
    { op: "SET_ROUTING_FILTER", orderRoutingId: "R1", fieldName: "salesChannelEnumId", fieldValue: "POS" },
  ], "routing filter change");
}
{
  const baseline = { routings: [baseRouting()] };
  const snap = { routings: [baseRouting()] };
  snap.routings[0].sequenceNum = 5;
  assert.deepStrictEqual(diffRoutings(baseline, snap), [
    { op: "SET_ROUTING_SEQUENCE_NUM", orderRoutingId: "R1", sequenceNum: 5 },
  ], "routing sequence change");
}

// Test Task 4: buildVariant + isNoOp
{
  const baseline = { distance: 50, routings: [baseRouting()] };
  const snap = { distance: 100, routings: [baseRouting()] };
  const v = buildVariant("Tighter distance", baseline, snap);
  assert.strictEqual(v.label, "Tighter distance");
  assert.deepStrictEqual(v.parameterOverrides, { distance: 100 });
  assert.deepStrictEqual(v.routingDeltas, []);
  assert.strictEqual(isNoOp(v), false);
}
{
  const baseline = { distance: 50, routings: [baseRouting()] };
  const snap = { distance: 50, routings: [baseRouting()] };
  const v = buildVariant("No change", baseline, snap);
  assert.strictEqual(isNoOp(v), true, "empty overrides + empty deltas is a no-op");
}

console.log("all tests passed");
