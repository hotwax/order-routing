// tests/routingGroupService.test.ts — shared routing-group fetch+normalize helpers used by both the
// OMS store (orderRoutingStore, via api()) and the isolated simulate path (simulationStore, via simApi()).
import { describe, it, expect, vi } from "vitest";

vi.mock("@common", () => ({
  commonUtil: {
    // Real sortSequence sorts by sequenceNum ascending; this mirror is enough for these assertions.
    sortSequence: (arr: any[]) => [...arr].sort((a, b) => (a.sequenceNum ?? 0) - (b.sequenceNum ?? 0)),
    hasError: (r: any) => r?._error === true,
  },
}));

import { normalizeRoutingGroupHierarchy, fetchRoutingGroupDetail } from "../src/services/RoutingGroupService";

describe("normalizeRoutingGroupHierarchy", () => {
  it("sorts routings + rules by sequence and rewrites _excluded fieldNames for negative operators", () => {
    const group = {
      routingGroupId: "G1",
      routings: [
        { orderRoutingId: "R2", sequenceNum: 2, orderFilters: [] },
        {
          orderRoutingId: "R1", sequenceNum: 1,
          orderFilters: [{ fieldName: "salesChannelEnumId", operator: "not-in" }],
          rules: [
            { routingRuleId: "RR2", sequenceNum: 2 },
            { routingRuleId: "RR1", sequenceNum: 1, inventoryFilters: [{ fieldName: "facilityGroupId", operator: "not-equals" }] },
          ],
        },
      ],
    };

    const out = normalizeRoutingGroupHierarchy(group);

    expect(out.routings.map((r: any) => r.orderRoutingId)).toEqual(["R1", "R2"]);
    expect(out.routings[0].orderFilters[0].fieldName).toBe("salesChannelEnumId_excluded");
    const r1 = out.routings[0];
    expect(r1.rules.map((x: any) => x.routingRuleId)).toEqual(["RR1", "RR2"]);
    expect(r1.rules[0].inventoryFilters[0].fieldName).toBe("facilityGroupId_excluded");
  });

  it("returns the group untouched when there are no routings", () => {
    expect(normalizeRoutingGroupHierarchy({ routingGroupId: "G", routings: [] }))
      .toEqual({ routingGroupId: "G", routings: [] });
  });
});

describe("fetchRoutingGroupDetail", () => {
  it("pulls /raw via the supplied request fn, preserving baseURL, and normalizes the result", async () => {
    const request = vi.fn().mockResolvedValue({ data: { routingGroupId: "G1", routings: [{ orderRoutingId: "R1", sequenceNum: 1 }] } });
    const out = await fetchRoutingGroupDetail("G1", [], request, "http://sim/rest/s1/");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: "order-routing/groups/G1/raw", method: "GET", baseURL: "http://sim/rest/s1/",
    }));
    expect(out.routingGroupId).toBe("G1");
    expect(out.routings[0].orderRoutingId).toBe("R1");
  });

  it("treats an empty/non-object /raw body as a valid group with no routings (using the list metadata)", async () => {
    const request = vi.fn().mockResolvedValue({ data: "" });
    const out = await fetchRoutingGroupDetail("G1", [{ routingGroupId: "G1", groupName: "Grp" }], request, "");
    expect(out).toMatchObject({ routingGroupId: "G1", groupName: "Grp", routings: [] });
  });

  it("falls back to the list metadata (without routings) when the request throws and the group is listed", async () => {
    const request = vi.fn().mockRejectedValue(new Error("network down"));
    const out = await fetchRoutingGroupDetail("G1", [{ routingGroupId: "G1", groupName: "Grp" }], request, "");
    // No routings array: cache checks must treat this as partial and refetch on the next visit.
    expect(out).toMatchObject({ routingGroupId: "G1", groupName: "Grp" });
    expect(out.routings).toBeUndefined();
  });

  it("rethrows when the request throws and the group is not in the list (nothing to render)", async () => {
    const request = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(fetchRoutingGroupDetail("G1", [], request, "")).rejects.toThrow("network down");
  });

  it("builds paths under the supplied component name (ai-routing rename is one env change)", async () => {
    const request = vi.fn().mockResolvedValue({ data: { routingGroupId: "G1" } });
    await fetchRoutingGroupDetail("G1", [], request, "http://sim/rest/s1/", "ai-routing");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: "ai-routing/groups/G1/raw" }));
  });
});
