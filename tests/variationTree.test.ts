// tests/variationTree.test.ts
import assert from "node:assert";
import {
  isPlaceholder, sortBySequence, stripVariationPrefix, buildRoutingNameMap, nextSeqId,
} from "../src/util/variationUtils";
import type { VariationTree } from "../src/types/variation";

// isPlaceholder: a condition with null operator AND null value is an unset placeholder.
assert.strictEqual(isPlaceholder({ conditionSeqId: "04", fieldName: "orderDate", operator: null, fieldValue: null, sequenceNum: 0 }), true);
assert.strictEqual(isPlaceholder({ conditionSeqId: "06", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "POS_SALES_CHANNEL", sequenceNum: 0 }), false);

// sortBySequence: ascending by sequenceNum, stable for ties.
assert.deepStrictEqual(
  sortBySequence([{ sequenceNum: 5, id: "a" }, { sequenceNum: 1, id: "b" }, { sequenceNum: 5, id: "c" }]).map((x: any) => x.id),
  ["b", "a", "c"],
);

// stripVariationPrefix: removes the "<variationGroupId>_" prefix to recover the parent routing id.
assert.strictEqual(stripVariationPrefix("VM100204", "VM100204_100008"), "100008");
assert.strictEqual(stripVariationPrefix("VM100204", "100008"), "100008"); // already bare -> unchanged

// buildRoutingNameMap: orderRoutingId -> routingName for every routing in a tree.
const tree: VariationTree = {
  variationGroupId: "VM100204", parentRoutingGroupId: "100001", productStoreId: "SM_STORE",
  variationName: "x", statusId: "VAR_DRAFT",
  routings: [
    { orderRoutingId: "VM100204_100008", routingName: "Standard", statusId: "ROUTING_ACTIVE", sequenceNum: 5, filters: [], rules: [] },
  ],
};
assert.deepStrictEqual(buildRoutingNameMap(tree), { "VM100204_100008": "Standard" });

// nextSeqId: returns a 2-digit zero-padded id one past the max numeric seqId present.
assert.strictEqual(nextSeqId([{ conditionSeqId: "01" }, { conditionSeqId: "06" }], "conditionSeqId"), "07");
assert.strictEqual(nextSeqId([], "conditionSeqId"), "01");
assert.strictEqual(nextSeqId([{ actionSeqId: "09" }], "actionSeqId"), "10");

console.log("variationTree tests passed");
