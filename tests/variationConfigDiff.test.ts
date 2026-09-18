import { describe, expect, it } from "vitest";
import {
  buildVariationConfigDiff,
  restoreVariationSection,
  restoreVariationToBaseline
} from "../src/utils/variationConfigDiff";

const baseline = {
  routingGroupId: "M1",
  routings: [{
    orderRoutingId: "R1",
    routingName: "Standard orders",
    statusId: "ROUTING_ACTIVE",
    sequenceNum: 0,
    orderFilters: [
      { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "queueId", operator: "equals", fieldValue: "QUEUE_A", sequenceNum: 0 },
      { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "orderDate", operator: null, fieldValue: null, sequenceNum: 0 }
    ],
    rules: [{
      routingRuleId: "RR1",
      ruleName: "Warehouse",
      statusId: "RULE_ACTIVE",
      assignmentEnumId: "ORA_SELECTED",
      sequenceNum: 0,
      inventoryFilters: [
        { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", operator: "equals", fieldValue: "FG1", sequenceNum: 0 }
      ],
      actions: [{ actionTypeEnumId: "ORA_NEXT_RULE", actionValue: null }]
    }]
  }]
};

function variation() {
  return {
    ...structuredClone(baseline),
    variationGroupId: "V1",
    routings: [{
      ...structuredClone(baseline.routings[0]),
      orderRoutingId: "V1_R1",
      orderFilters: [
        { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "queueId", operator: "equals", fieldValue: "QUEUE_B", sequenceNum: 0 },
        { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "orderDate", operator: null, fieldValue: null, sequenceNum: 0 },
        { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "shippingMethod", operator: null, fieldValue: null, sequenceNum: 1 }
      ],
      rules: [{
        ...structuredClone(baseline.routings[0].rules[0]),
        routingRuleId: "V1_RR1",
        statusId: "RULE_DRAFT",
        inventoryFilters: [
          { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", operator: "equals", fieldValue: "FG2", sequenceNum: 0 }
        ],
        actions: [
          { actionTypeEnumId: "ORA_NEXT_RULE", actionValue: null },
          { actionTypeEnumId: "ORA_MV_TO_QUEUE", actionValue: "UNFILLABLE" }
        ]
      }]
    }]
  };
}

describe("variation configuration differences", () => {
  it("ignores regenerated backend ids when routing and rule identities are otherwise unchanged", () => {
    const regenerated: any = structuredClone(baseline);
    regenerated.variationGroupId = "V2";
    regenerated.routings[0].orderRoutingId = "SERVER_GENERATED_ROUTE";
    regenerated.routings[0].rules[0].routingRuleId = "SERVER_GENERATED_RULE";

    expect(buildVariationConfigDiff(baseline, regenerated).total).toBe(0);
  });

  it("describes reordering with human positions instead of backend sequence numbers", () => {
    const reordered: any = structuredClone(baseline);
    reordered.routings[0].orderFilters = [
      { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "deliveryDays", sequenceNum: 5 },
      { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "priority", sequenceNum: 0 }
    ];
    const baselineWithSorts: any = structuredClone(baseline);
    baselineWithSorts.routings[0].orderFilters = [
      { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "deliveryDays", sequenceNum: 0 },
      { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "priority", sequenceNum: 5 }
    ];

    const sortRows = buildVariationConfigDiff(baselineWithSorts, reordered).sections.find((section) => section.title === "Sort")!.rows;
    expect(sortRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Delivery days", before: "1", after: "2" }),
      expect.objectContaining({ label: "Priority", before: "2", after: "1" })
    ]));
  });

  it("groups semantic changes while matching prefixed variation ids to baseline ids", () => {
    const diff = buildVariationConfigDiff(baseline, variation());

    expect(diff.total).toBe(5);
    expect(diff.sections.map((section) => section.title)).toEqual([
      "Order filters",
      "Sort",
      "Warehouse: Inventory filters",
      "Warehouse: Actions",
      "Routing rules"
    ]);
    expect(diff.sections[0].rows[0]).toMatchObject({
      label: "Queue id",
      kind: "changed",
      before: "Queue a, Equals",
      after: "Queue b, Equals"
    });
  });

  it("restores one section without discarding unrelated variation changes", () => {
    const current = variation();
    const orderFilters = buildVariationConfigDiff(baseline, current).sections.find((section) => section.title === "Order filters")!;
    const restored = restoreVariationSection(current, baseline, orderFilters.target);
    const remaining = buildVariationConfigDiff(baseline, restored);

    expect(remaining.sections.some((section) => section.title === "Order filters")).toBe(false);
    expect(remaining.sections.some((section) => section.title === "Sort")).toBe(true);
    expect(remaining.sections.some((section) => section.title === "Warehouse: Actions")).toBe(true);
  });

  it("resets the effective variation to the live baseline", () => {
    const restored = restoreVariationToBaseline(variation(), baseline);

    expect(restored.variationGroupId).toBe("V1");
    expect(buildVariationConfigDiff(baseline, restored).total).toBe(0);
  });
});
