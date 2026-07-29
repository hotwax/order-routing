import { describe, expect, it } from "vitest";
import { inventoryScopeQuery, parseInventoryScope, resolveInventoryChannelId } from "../src/utils/inventoryScope";

describe("inventory scope", () => {
  it("infers Channel scope from channelId without a view parameter", () => {
    const scope = parseInventoryScope({ channelId: "FAC_GRP" });

    expect(scope).toEqual({ type: "channel", channelId: "FAC_GRP" });
    expect(inventoryScopeQuery(scope)).toEqual({ channelId: "FAC_GRP" });
  });

  it("keeps Location scope represented by facilityId", () => {
    const scope = parseInventoryScope({ facilityId: "CENTRAL_WAREHOUSE" });

    expect(scope).toEqual({ type: "location", facilityId: "CENTRAL_WAREHOUSE" });
    expect(inventoryScopeQuery(scope)).toEqual({ facilityId: "CENTRAL_WAREHOUSE" });
  });

  it("treats facilityId and channelId together as invalid", () => {
    expect(parseInventoryScope({ facilityId: "CENTRAL_WAREHOUSE", channelId: "FAC_GRP" })).toEqual({
      type: "invalid",
      reason: "multiple-scopes",
      facilityId: "CENTRAL_WAREHOUSE",
      channelId: "FAC_GRP",
    });
  });

  it("does not choose an arbitrary value from repeated scope parameters", () => {
    expect(parseInventoryScope({ channelId: ["FAC_GRP", "AMAZON_FAC_GRP"] })).toEqual({
      type: "invalid",
      reason: "multiple-values",
      facilityId: "",
      channelId: "FAC_GRP",
    });
  });

  it("allows an empty route to use the Location fallback", () => {
    expect(parseInventoryScope({})).toEqual({ type: "location", facilityId: "" });
  });

  it("selects the first available channel when Channel view has no selection", () => {
    const channels = [
      { facilityGroupId: "FAC_GRP" },
      { facilityGroupId: "AMAZON_FAC_GRP" },
    ];

    expect(resolveInventoryChannelId(channels)).toBe("FAC_GRP");
    expect(resolveInventoryChannelId(channels, "AMAZON_FAC_GRP")).toBe("AMAZON_FAC_GRP");
  });

  it("does not retain a channel that is unavailable for the current product store", () => {
    expect(resolveInventoryChannelId([{ facilityGroupId: "FAC_GRP" }], "OLD_CHANNEL")).toBe("FAC_GRP");
    expect(resolveInventoryChannelId([], "OLD_CHANNEL")).toBe("");
  });
});
