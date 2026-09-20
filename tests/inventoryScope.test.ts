import { describe, expect, it } from "vitest";
import { inventoryListQuery, inventoryOperationalFilterParams, inventoryScopeQuery, parseInventoryListQuery, parseInventoryListScope, parseInventoryScope, resolveInventoryChannelId } from "../src/utils/inventoryScope";

describe("inventory scope", () => {
  it("round-trips the full inventory list query through a shareable URL state", () => {
    const query = inventoryListQuery({ type: "location", facilityIds: ["CENTRAL_WAREHOUSE"] }, {
      productIds: ["P100", "P200"],
      sortField: "-availableToPromise",
      allowBrokering: "Y",
      allowPickup: "N",
      atpFilter: "positive",
      qohFilter: "negative",
      safetyStockOperator: "greater-than",
      safetyStockValue: "5",
      pageIndex: 2,
    });

    expect(query).toEqual({
      facilityId: "CENTRAL_WAREHOUSE",
      productId: "P100,P200",
      orderByField: "-availableToPromise",
      allowBrokering: "Y",
      allowPickup: "N",
      minimumStock_from: "5",
      availableToPromise_from: "1",
      quantityOnHand_thru: "-1",
      pageIndex: "2",
    });
    expect(parseInventoryListQuery(query)).toEqual({
      facilityIds: ["CENTRAL_WAREHOUSE"],
      channelId: "",
      productIds: ["P100", "P200"],
      sortField: "-availableToPromise",
      allowBrokering: "Y",
      allowPickup: "N",
      atpFilter: "positive",
      qohFilter: "negative",
      safetyStockOperator: "greater-than",
      safetyStockValue: "5",
      pageIndex: 2,
    });
  });

  it("converts strict safety-stock comparisons to inclusive server boundaries", () => {
    const baseFilters = {
      allowBrokering: "",
      allowPickup: "",
      atpFilter: "" as const,
      qohFilter: "" as const,
    };

    expect(inventoryOperationalFilterParams({
      ...baseFilters,
      safetyStockOperator: "greater-than",
      safetyStockValue: "5",
    })).toMatchObject({ minimumStock_from: "6" });

    expect(inventoryOperationalFilterParams({
      ...baseFilters,
      safetyStockOperator: "less-than",
      safetyStockValue: "5",
    })).toMatchObject({ minimumStock_thru: "4" });
  });

  it("accepts repeated or comma-separated product IDs and rejects invalid pages", () => {
    expect(parseInventoryListQuery({ productId: ["P100,P200", "P200"], pageIndex: "-1" })).toMatchObject({
      productIds: ["P100", "P200"],
      pageIndex: 0,
    });
  });

  it("round-trips multiple facilities with an explicit IN operator", () => {
    const query = inventoryListQuery({ type: "location", facilityIds: ["CENTRAL_WAREHOUSE", "EAST_WAREHOUSE"] }, {
      productIds: [],
      sortField: "",
      allowBrokering: "",
      allowPickup: "",
      atpFilter: "",
      qohFilter: "",
      safetyStockOperator: "",
      safetyStockValue: "",
      pageIndex: 0,
    });

    expect(query).toEqual({
      facilityId: "CENTRAL_WAREHOUSE,EAST_WAREHOUSE",
      facilityId_op: "in",
    });
    expect(parseInventoryListQuery(query)).toMatchObject({
      facilityIds: ["CENTRAL_WAREHOUSE", "EAST_WAREHOUSE"],
      channelId: "",
    });
    expect(parseInventoryListScope(query)).toEqual({
      type: "location",
      facilityIds: ["CENTRAL_WAREHOUSE", "EAST_WAREHOUSE"],
    });
  });

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
