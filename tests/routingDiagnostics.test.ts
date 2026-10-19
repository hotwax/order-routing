import { describe, expect, it } from "vitest";
import {
  SHIPPING_REASON,
  UNATTRIBUTED_REASON,
  axisCeiling,
  buildFacilityHolds,
  buildRuleSeries,
  buildSafetyByReason,
  buildStoreShipped,
  lastCompleteWeeks,
  ruleLabel,
  thresholdSummary,
  toSafetyRule,
  totalHolds,
  weekOverWeek
} from "@/utils/routingDiagnostics";

const facilities = {
  W1: { facilityId: "W1", facilityName: "Warehouse", facilityTypeId: "WAREHOUSE" },
  S1: { facilityId: "S1", facilityName: "Boston", facilityTypeId: "RETAIL_STORE" },
  S2: { facilityId: "S2", facilityName: "Austin", facilityTypeId: "RETAIL_STORE" }
};

describe("lastCompleteWeeks", () => {
  it("returns complete Monday weeks in UTC, oldest first", () => {
    // Tuesday 13 Oct 2026, 10:00 UTC
    const weeks = lastCompleteWeeks(2, Date.UTC(2026, 9, 13, 10));
    expect(weeks.map((week) => new Date(week.start).toISOString())).toEqual([
      "2026-09-28T00:00:00.000Z",
      "2026-10-05T00:00:00.000Z"
    ]);
    expect(weeks[1].end).toBe(Date.UTC(2026, 9, 12));
  });

  it("treats a Monday as the start of a new, incomplete week", () => {
    const weeks = lastCompleteWeeks(1, Date.UTC(2026, 9, 12, 1));
    expect(new Date(weeks[0].start).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("ruleLabel", () => {
  it("keeps the routing and rule name from the recorded rule", () => {
    expect(ruleLabel("Primary : Standard Shipping : Priority 1 - Store Fulfillment]")).toBe("Standard Shipping : Priority 1 - Store Fulfillment");
    expect(ruleLabel(undefined)).toBe("");
  });
});

describe("buildRuleSeries", () => {
  it("uses each rule's server distinct counts per week and the location types from the range query", () => {
    const series = buildRuleSeries([
      [
        { routingRule: "G : Ship : Store]", routingRuleId: "1", routingGroupId: "G", orderCount: "12" },
        { routingRule: "G : Ship : DC]", routingRuleId: "2", routingGroupId: "G", orderCount: "40" }
      ],
      [
        { routingRule: "G : Ship : Store]", routingRuleId: "1", routingGroupId: "G", orderCount: 7 }
      ]
    ], [
      { routingRuleId: "1", facilityTypeId: "RETAIL_STORE" },
      { routingRuleId: "1", facilityTypeId: "WAREHOUSE" },
      { routingRuleId: "2", facilityTypeId: "WAREHOUSE" }
    ]);
    expect(series.map((rule) => [rule.ruleKey, rule.label, rule.counts, rule.facilityTypeIds])).toEqual([
      ["2", "Ship : DC", [40, 0], ["WAREHOUSE"]],
      ["1", "Ship : Store", [12, 7], ["RETAIL_STORE", "WAREHOUSE"]]
    ]);
  });

  it("keeps same-named rules from different groups apart and names their group", () => {
    const series = buildRuleSeries([[
      { routingRule: "East : Ship : Nearest]", routingRuleId: "10", routingGroupId: "G1", orderCount: 4 },
      { routingRule: "West : Ship : Nearest]", routingRuleId: "20", routingGroupId: "G2", orderCount: 9 }
    ]]);
    expect(series.map((rule) => [rule.ruleKey, rule.label, rule.routingGroupId, rule.counts[0]])).toEqual([
      ["20", "West : Ship : Nearest", "G2", 9],
      ["10", "East : Ship : Nearest", "G1", 4]
    ]);
  });
});

describe("buildStoreShipped", () => {
  it("counts only retail-store shipments that are not POS or pickup", () => {
    const result = buildStoreShipped([
      [
        { facilityId: "S1", salesChannelEnumId: "WEB_SALES_CHANNEL", shipmentMethodTypeId: "STANDARD", shippedUnits: "20" },
        { facilityId: "S1", salesChannelEnumId: "POS_SALES_CHANNEL", shipmentMethodTypeId: "STANDARD", shippedUnits: "4" },
        { facilityId: "S2", salesChannelEnumId: "LOOP_EXCH", shipmentMethodTypeId: "STANDARD", shippedUnits: "3" },
        { facilityId: "W1", salesChannelEnumId: "WEB_SALES_CHANNEL", shipmentMethodTypeId: "STANDARD", shippedUnits: "900" }
      ],
      [
        { facilityId: "S2", salesChannelEnumId: "WEB_SALES_CHANNEL", shipmentMethodTypeId: "STANDARD", shippedUnits: "11" }
      ]
    ], facilities);
    expect(result.weeklyUnits).toEqual([23, 11]);
    expect(result.stores.map((store) => [store.facilityName, store.units])).toEqual([
      ["Boston", [20, 0]],
      ["Austin", [3, 11]]
    ]);
  });
});

describe("buildFacilityHolds", () => {
  it("combines safety stock and shipping exclusion without double counting the overlap", () => {
    const holds = buildFacilityHolds(
      [
        { facilityId: "S1", allowBrokering: "Y", availableUnits: 100 },
        { facilityId: "S1", allowBrokering: "N", availableUnits: 20 },
        { facilityId: "S1", allowBrokering: null, availableUnits: 5 },
        { facilityId: "W1", allowBrokering: null, availableUnits: 1000 },
        { facilityId: "OTHER", allowBrokering: "Y", availableUnits: 50 }
      ],
      [
        { facilityId: "S1", allowBrokering: "Y", heldUnits: 30 },
        { facilityId: "S1", allowBrokering: "N", heldUnits: 6 }
      ],
      [
        { facilityId: "S1", allowBrokering: "Y", heldUnits: 4 }
      ],
      facilities
    );
    const store = holds.find((hold) => hold.facilityId === "S1")!;
    expect(store).toMatchObject({ available: 125, safetyStockHeld: 40, shippingExcluded: 20, overlap: 6, combinedHeld: 54, eligible: 71 });
    expect(store.safetyStockShare).toBeCloseTo(0.32);
    expect(holds.map((hold) => hold.facilityId)).toEqual(["S1", "W1"]);

    const total = totalHolds(holds);
    expect(total).toMatchObject({ available: 1125, safetyStockHeld: 40, combinedHeld: 54, eligible: 1071 });
  });
});

describe("axisCeiling", () => {
  it("rounds the axis top up to 1, 2 or 5 times a power of ten", () => {
    expect([311, 4689, 2, 0, 1000].map(axisCeiling)).toEqual([500, 5000, 2, 1, 1000]);
  });
});

describe("weekOverWeek", () => {
  it("compares the last two weeks and needs a non-zero base", () => {
    expect(weekOverWeek([100, 120])).toBeCloseTo(0.2);
    expect(weekOverWeek([0, 5])).toBeNull();
    expect(weekOverWeek([5])).toBeNull();
  });
});

describe("buildSafetyByReason", () => {
  const rules = [
    { ruleId: "1", ruleName: "Default", statusId: "ATP_RULE_ACTIVE", sequenceNum: 1,
      ruleActions: [{ actionTypeEnumId: "ATP_SAFETY_STOCK", fieldValue: "0" }],
      ruleConditions: [{ conditionTypeEnumId: "ENTCT_ATP_FAC_GROUPS", fieldName: "facilityGroupId", operator: "in", fieldValue: "AllRetail" }] },
    { ruleId: "2", ruleName: "New Arrivals", statusId: "ATP_RULE_ACTIVE", sequenceNum: 2,
      ruleActions: [{ actionTypeEnumId: "ATP_SAFETY_STOCK", fieldValue: "1" }],
      ruleConditions: [
        { conditionTypeEnumId: "ENTCT_ATP_FAC_GROUPS", fieldName: "facilityGroupId", operator: "in", fieldValue: "AllRetail" },
        { conditionTypeEnumId: "ENTCT_ATP_FILTER", fieldName: "tags", operator: "contains", fieldValue: "FALL, FALL-2" }
      ] },
    { ruleId: "3", ruleName: "Winter", statusId: "ATP_RULE_ACTIVE", sequenceNum: 3,
      ruleActions: [{ actionTypeEnumId: "ATP_SAFETY_STOCK", fieldValue: "2" }],
      ruleConditions: [{ conditionTypeEnumId: "ENTCT_ATP_FILTER", fieldName: "tags", operator: "contains", fieldValue: "WINTER" }] }
  ].map(toSafetyRule);

  it("reads facility groups, tags and the buffer from an ATP rule", () => {
    expect(rules[1]).toMatchObject({ buffer: 1, includeFacilityGroupIds: ["AllRetail"], excludeFacilityGroupIds: [], includeTags: ["FALL", "FALL-2"], hasUnsupportedCondition: false });
  });

  it("credits the highest matching rule only when its buffer matches the record", () => {
    const holds = buildFacilityHolds(
      [{ facilityId: "S1", allowBrokering: "Y", availableUnits: 50 }, { facilityId: "S1", allowBrokering: "N", availableUnits: 10 }],
      [{ facilityId: "S1", allowBrokering: "N", heldUnits: 1 }],
      [],
      facilities
    );
    const result = buildSafetyByReason(
      [
        { productId: "fall", facilityId: "S1", minimumStock: 1, lastInventoryCount: 4 },
        { productId: "both", facilityId: "S1", minimumStock: 2, lastInventoryCount: 1 },
        { productId: "fall-low", facilityId: "S1", minimumStock: 1, lastInventoryCount: 0 },
        { productId: "untagged", facilityId: "S1", minimumStock: 1, lastInventoryCount: 3 },
        { productId: "fall", facilityId: "W1", minimumStock: 1, lastInventoryCount: 9 }
      ],
      { fall: ["FALL"], both: ["FALL-2", "WINTER"], "fall-low": ["FALL"] },
      rules,
      { AllRetail: ["S1"] },
      holds
    );
    const store = result.stores[0];
    expect(store.units).toEqual({ 2: 1, 3: 1, [UNATTRIBUTED_REASON]: 1, [SHIPPING_REASON]: 9 });
    expect(result.reasons).toEqual(["3", "2", UNATTRIBUTED_REASON, SHIPPING_REASON]);
    expect(result.labels).toMatchObject({ 2: "New Arrivals", 3: "Winter" });
    expect(result.totals[SHIPPING_REASON]).toBe(9);
  });
});

describe("safety stock rule facility groups", () => {
  const rule = (ruleName: string, sequenceNum: number, groups: { operator: string; fieldValue: string }[]) => toSafetyRule({
    ruleId: ruleName, ruleName, statusId: "ATP_RULE_ACTIVE", sequenceNum,
    ruleActions: [{ actionTypeEnumId: "ATP_SAFETY_STOCK", fieldValue: "1" }],
    ruleConditions: groups.map((group) => ({ conditionTypeEnumId: "ENTCT_ATP_FAC_GROUPS", fieldName: "facilityGroupId", ...group }))
  });
  const holds = buildFacilityHolds(
    [{ facilityId: "S1", allowBrokering: "Y", availableUnits: 5 }, { facilityId: "S2", allowBrokering: "Y", availableUnits: 5 }],
    [], [], facilities
  );
  const skus = [
    { productId: "P", facilityId: "S1", minimumStock: 1, lastInventoryCount: 5 },
    { productId: "P", facilityId: "S2", minimumStock: 1, lastInventoryCount: 5 }
  ];
  const groups = { North: ["S1"] };

  it("treats ALL as every facility group and honours excluded groups", () => {
    const rules = [rule("Everywhere but North", 2, [{ operator: "in", fieldValue: "ALL" }, { operator: "not-in", fieldValue: "North" }])];
    expect(rules[0]).toMatchObject({ includeFacilityGroupIds: [], excludeFacilityGroupIds: ["North"] });
    const result = buildSafetyByReason(skus, {}, rules, groups, holds);
    const units = Object.fromEntries(result.stores.map((store) => [store.facilityId, store.units]));
    expect(units).toEqual({ S1: { [UNATTRIBUTED_REASON]: 1 }, S2: { "Everywhere but North": 1 } });
  });

  it("leaves a SKU unattributed when the matching rule has a condition the dashboard can't evaluate", () => {
    const features = toSafetyRule({
      ruleId: "F", ruleName: "Bulky", statusId: "ATP_RULE_ACTIVE", sequenceNum: 3,
      ruleActions: [{ actionTypeEnumId: "ATP_SAFETY_STOCK", fieldValue: "1" }],
      ruleConditions: [{ conditionTypeEnumId: "ENTCT_ATP_FILTER", fieldName: "productFeatures", operator: "contains", fieldValue: "Bulky" }]
    });
    const broad = rule("Everywhere", 1, [{ operator: "in", fieldValue: "ALL" }]);
    const result = buildSafetyByReason(skus, {}, [features, broad], groups, holds);
    expect(result.totals).toEqual({ [UNATTRIBUTED_REASON]: 2 });
  });

  it("labels same-named rules by id", () => {
    const result = buildSafetyByReason(skus, {}, [rule("Twin", 2, [{ operator: "in", fieldValue: "North" }]), { ...rule("Twin", 1, []), ruleId: "Twin-2" }], groups, holds);
    expect(result.labels).toEqual({ Twin: "Twin (Twin)", "Twin-2": "Twin (Twin-2)" });
  });
});

describe("thresholdSummary", () => {
  it("reports no hold when no threshold rule is active", () => {
    expect(thresholdSummary([])).toEqual({ activeRules: 0, maxThreshold: 0 });
    expect(thresholdSummary([{ statusId: "ATP_RULE_ACTIVE", ruleActions: [{ actionTypeEnumId: "ATP_THRESHOLD", fieldValue: "5" }] }])).toEqual({ activeRules: 1, maxThreshold: 5 });
  });
});
