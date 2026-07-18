// tests/variationService.test.ts
import assert from "node:assert";
import { vi } from "vitest";

vi.mock("@common", () => ({
  commonUtil: { hasError: () => false },
}));
vi.mock("@/services/SimApiService", () => ({ simApi: vi.fn() }));

import { simApi } from "../src/services/SimApiService";
import { runVariation, variationRequests } from "../src/services/VariationService";

it("builds variation service requests", () => {
// listVariations
assert.deepStrictEqual(variationRequests.listVariations("100001"), {
  url: "sim-routing/variations", method: "GET", params: { parentRoutingGroupId: "100001" },
});

// createVariation (name optional)
assert.deepStrictEqual(variationRequests.createVariation("100001", "web standard"), {
  url: "sim-routing/routingGroups/100001/variations", method: "POST", data: { variationName: "web standard" },
});
assert.deepStrictEqual(variationRequests.createVariation("100001").data, {});

// getVariation
assert.deepStrictEqual(variationRequests.getVariation("VM100204"), {
  url: "sim-routing/variations/VM100204", method: "GET",
});
assert.deepStrictEqual(variationRequests.deleteVariation("VM100204"), {
  url: "sim-routing/variations/VM100204", method: "DELETE",
});

// setRouting
assert.deepStrictEqual(variationRequests.setRouting("VM100204", "VM100204_100008", { statusId: "ROUTING_ACTIVE" }), {
  url: "sim-routing/variations/VM100204/routings/VM100204_100008", method: "PUT", data: { statusId: "ROUTING_ACTIVE" },
});

// upsertFilter
assert.deepStrictEqual(
  variationRequests.upsertFilter("VM100204", "VM100204_100008", {
    conditionSeqId: "06", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "WEB_SALES_CHANNEL", sequenceNum: 6,
  }),
  {
    url: "sim-routing/variations/VM100204/routings/VM100204_100008/filters", method: "POST",
    data: { conditionSeqId: "06", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "WEB_SALES_CHANNEL", sequenceNum: 6 },
  },
);

// deleteFilter
assert.deepStrictEqual(variationRequests.deleteFilter("VM100204", "VM100204_100008", "06"), {
  url: "sim-routing/variations/VM100204/routings/VM100204_100008/filters/06", method: "DELETE",
});

// rule endpoints
assert.deepStrictEqual(variationRequests.setRule("VM100204", "VM100204_100008", "VM100204_100524", { sequenceNum: 3 }), {
  url: "sim-routing/variations/VM100204/routings/VM100204_100008/rules/VM100204_100524", method: "PUT", data: { sequenceNum: 3 },
});
assert.deepStrictEqual(
  variationRequests.upsertInventoryCondition("VM100204", "VM100204_100008", "VM100204_100524", {
    conditionSeqId: "99", fieldName: "facilityGroupId", operator: "equals", fieldValue: "PICKUP", sequenceNum: 99,
  }).url,
  "sim-routing/variations/VM100204/routings/VM100204_100008/rules/VM100204_100524/inventoryConditions",
);
assert.deepStrictEqual(
  variationRequests.deleteAction("VM100204", "VM100204_100008", "VM100204_100524", "99").url,
  "sim-routing/variations/VM100204/routings/VM100204_100008/rules/VM100204_100524/actions/99",
);

// runVariation (sampleCap optional)
assert.deepStrictEqual(variationRequests.runVariation("VM100204", 500), {
  url: "sim-routing/variations/VM100204/simulation", method: "POST", data: { sampleCap: 500 },
});
assert.deepStrictEqual(variationRequests.runVariation("VM100204").data, {});

console.log("variationService tests passed");
});

it("adopts a canonical top-level simulation id without requiring it from older responses", async () => {
  const groupRunResult = {
    routingGroupId: "VM100204",
    productStoreId: "STORE",
    attemptedItemCount: 10,
    brokeredItemCount: 8,
    queuedItemCount: 2,
    routingResults: []
  };
  vi.mocked(simApi).mockResolvedValueOnce({
    data: { simulationId: "M100374", groupRunResult }
  } as any);

  await expect(runVariation("VM100204", 500)).resolves.toEqual({
    ...groupRunResult,
    simulationId: "M100374"
  });

  vi.mocked(simApi).mockResolvedValueOnce({ data: { groupRunResult } } as any);
  await expect(runVariation("VM100204", 500)).resolves.toBe(groupRunResult);
});

it("tolerates a defensively nested simulation id", async () => {
  const groupRunResult = {
    simulationId: "M_LEGACY",
    routingGroupId: "VM100204",
    routingResults: []
  };
  vi.mocked(simApi).mockResolvedValueOnce({ data: { groupRunResult } } as any);

  await expect(runVariation("VM100204")).resolves.toEqual(groupRunResult);
});
