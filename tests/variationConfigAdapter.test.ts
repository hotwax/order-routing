import { describe, expect, it, vi } from "vitest";

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: { hasError: () => false },
}));

import { variationRequests } from "@/services/VariationService";
import {
  buildRoutingNameMap,
  fromVariationRoutings,
  nextSeqId,
  stripVariationPrefix,
  toConfigPayload,
} from "@/utils/variationUtils";

const apiRoutings = [{
  orderRoutingId: "VM1_100008",
  routingName: "Standard",
  statusId: "ROUTING_ACTIVE",
  sequenceNum: 5,
  filters: [
    { conditionSeqId: "07", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityId", operator: "not-equals", fieldValue: "_NA_", sequenceNum: 4 },
    { conditionSeqId: "06", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "salesChannelEnumId", operator: "equals", fieldValue: "WEB", sequenceNum: 3 },
  ],
  rules: [{
    routingRuleId: "VM1_100524",
    ruleName: "Pick",
    statusId: "RULE_ACTIVE",
    sequenceNum: 1,
    assignmentEnumId: "ORA_SELECTED",
    inventoryConditions: [{ conditionSeqId: "01", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", operator: "equals", fieldValue: "PICKUP", sequenceNum: 0 }],
    actions: [{ actionSeqId: "01", actionTypeEnumId: "ORA_NEXT_RULE", actionValue: null }],
  }],
}];

describe("variation configuration adapter", () => {
  it("maps API collections into the canvas shape and preserves stable ids", () => {
    const canvas = fromVariationRoutings(apiRoutings);

    expect(canvas[0].orderFilters.map((filter: any) => filter.fieldName))
      .toEqual(["salesChannelEnumId", "facilityId_excluded"]);
    expect(canvas[0].rules[0]).toMatchObject({
      routingRuleId: "VM1_100524",
      assignmentEnumId: "ORA_SELECTED",
      inventoryFilters: [expect.objectContaining({ fieldName: "facilityGroupId" })],
    });
  });

  it("creates the bare replacement array expected by PUT /config", () => {
    const payload = toConfigPayload(fromVariationRoutings(apiRoutings));

    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0]).not.toHaveProperty("orderRoutingId");
    expect(payload[0].rules[0]).not.toHaveProperty("routingRuleId");
    expect(payload[0].filters.find((filter: any) => filter.operator === "not-equals").fieldName)
      .toBe("facilityId");
  });

  it("keeps parent identities and next sequence ids deterministic", () => {
    expect(stripVariationPrefix("VM1", "VM1_100008")).toBe("100008");
    expect(buildRoutingNameMap({ routings: apiRoutings } as any)).toEqual({ VM1_100008: "Standard" });
    expect(nextSeqId([{ conditionSeqId: "01" }, { conditionSeqId: "06" }], "conditionSeqId")).toBe("07");
  });
});

describe("variation request contract", () => {
  it("builds the create, replace, and run endpoints without double-wrapping routings", () => {
    expect(variationRequests.createVariation("GROUP", "Holiday")).toEqual({
      url: "sim-routing/routingGroups/GROUP/variations",
      method: "POST",
      data: { variationName: "Holiday" },
    });
    expect(variationRequests.replaceConfig("VM1", [{ routingName: "Standard" }])).toEqual({
      url: "sim-routing/variations/VM1/config",
      method: "PUT",
      data: { routings: [{ routingName: "Standard" }] },
    });
    expect(variationRequests.runVariation("VM1", 500)).toEqual({
      url: "sim-routing/variations/VM1/simulation",
      method: "POST",
      data: { sampleCap: 500 },
    });
  });
});
