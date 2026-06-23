// tests/variationService.test.ts
import assert from "node:assert";
import { variationRequests } from "../src/services/VariationService";

// listVariations
assert.deepStrictEqual(variationRequests.listVariations("100001"), {
  url: "variations", method: "GET", params: { parentRoutingGroupId: "100001" },
});

// createVariation (name optional)
assert.deepStrictEqual(variationRequests.createVariation("100001", "web standard"), {
  url: "routingGroups/100001/variations", method: "POST", data: { variationName: "web standard" },
});
assert.deepStrictEqual(variationRequests.createVariation("100001").data, {});

// getVariation
assert.deepStrictEqual(variationRequests.getVariation("VM100204"), {
  url: "variations/VM100204", method: "GET",
});

// setRouting
assert.deepStrictEqual(variationRequests.setRouting("VM100204", "VM100204_100008", { statusId: "ROUTING_ACTIVE" }), {
  url: "variations/VM100204/routings/VM100204_100008", method: "PUT", data: { statusId: "ROUTING_ACTIVE" },
});

// upsertFilter
assert.deepStrictEqual(
  variationRequests.upsertFilter("VM100204", "VM100204_100008", {
    conditionSeqId: "06", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "WEB_SALES_CHANNEL", sequenceNum: 6,
  }),
  {
    url: "variations/VM100204/routings/VM100204_100008/filters", method: "POST",
    data: { conditionSeqId: "06", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "WEB_SALES_CHANNEL", sequenceNum: 6 },
  },
);

// deleteFilter
assert.deepStrictEqual(variationRequests.deleteFilter("VM100204", "VM100204_100008", "06"), {
  url: "variations/VM100204/routings/VM100204_100008/filters/06", method: "DELETE",
});

// rule endpoints
assert.deepStrictEqual(variationRequests.setRule("VM100204", "VM100204_100008", "VM100204_100524", { sequenceNum: 3 }), {
  url: "variations/VM100204/routings/VM100204_100008/rules/VM100204_100524", method: "PUT", data: { sequenceNum: 3 },
});
assert.deepStrictEqual(
  variationRequests.upsertInventoryCondition("VM100204", "VM100204_100008", "VM100204_100524", {
    conditionSeqId: "99", fieldName: "facilityGroupId", operator: "equals", fieldValue: "PICKUP", sequenceNum: 99,
  }).url,
  "variations/VM100204/routings/VM100204_100008/rules/VM100204_100524/inventoryConditions",
);
assert.deepStrictEqual(
  variationRequests.deleteAction("VM100204", "VM100204_100008", "VM100204_100524", "99").url,
  "variations/VM100204/routings/VM100204_100008/rules/VM100204_100524/actions/99",
);

// runVariation (sampleCap optional)
assert.deepStrictEqual(variationRequests.runVariation("VM100204", 500), {
  url: "variations/VM100204/simulation", method: "POST", data: { sampleCap: 500 },
});
assert.deepStrictEqual(variationRequests.runVariation("VM100204").data, {});

console.log("variationService tests passed");
