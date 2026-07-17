// The shared service was intentionally folded into the stores; hierarchy normalization remains pure.
import { describe, it, expect, vi } from "vitest";

vi.mock("@common", () => ({
  commonUtil: {
    // Real sortSequence sorts by sequenceNum ascending; this mirror is enough for these assertions.
    sortSequence: (arr: any[]) => [...arr].sort((a, b) => (a.sequenceNum ?? 0) - (b.sequenceNum ?? 0)),
    hasError: (r: any) => r?._error === true,
  },
}));

import { normalizeRoutingGroupHierarchy } from "../src/utils/ruleUtil";

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
