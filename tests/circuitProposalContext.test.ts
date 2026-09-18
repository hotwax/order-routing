import { describe, expect, it } from "vitest";
import { buildCircuitProposalContextCards, selectCircuitProposalCards } from "../src/utils/circuitProposalContext";
import { isRoutingRuleDraftDirty } from "../src/utils/routingWorkingCopy";

describe("Circuit proposal review context", () => {
  it("renders a self-describing card for a create-routing-only proposal", () => {
    const cards = buildCircuitProposalContextCards({
      operations: [],
      newRouting: { routingKey: "new:holiday", name: "Holiday routing" }
    });

    expect(cards).toEqual([{
      key: "new-routing:routing",
      eyebrow: "Routing",
      title: "New routing",
      kind: "routing",
      items: [{
        target: "newRouting.name",
        label: "Routing name",
        value: "Holiday routing",
        dirty: true
      }]
    }]);
  });

  it("groups changed settings by routing rule for the in-chat review card", () => {
    const cards = buildCircuitProposalContextCards({
      operations: [
        {
          op: "set",
          target: "selectedRule.inventoryFilters.PROXIMITY",
          value: 151,
          ruleKey: "RULE_3",
          ruleName: "Warehouse with proximity"
        },
        {
          op: "set",
          target: "selectedRule.inventoryFilters.MEASUREMENT_SYSTEM",
          value: "IMPERIAL",
          ruleKey: "RULE_3",
          ruleName: "Warehouse with proximity"
        }
      ]
    });

    expect(cards).toEqual([{
      key: "rule:RULE_3:filters",
      eyebrow: "Warehouse with proximity",
      title: "Filters",
      kind: "filters",
      items: [
        { target: "selectedRule.inventoryFilters.PROXIMITY", label: "Proximity", value: "151", dirty: true },
        { target: "selectedRule.inventoryFilters.MEASUREMENT_SYSTEM", label: "Measurement unit", value: "Imperial", dirty: true }
      ]
    }]);
  });

  it("stacks operations as the matching canvas cards", () => {
    const cards = buildCircuitProposalContextCards({
      operations: [
        { op: "set", target: "route.orderFilters.SHIPPING_METHOD", value: ["STANDARD"] },
        { op: "set", target: "route.orderSorts.ORDER_DATE", value: true },
        { op: "set", target: "selectedRule.partialAllocation", value: true, ruleKey: "RULE_1", ruleName: "Any warehouse" },
        { op: "set", target: "selectedRule.autoCancelDays", value: 5, ruleKey: "RULE_1", ruleName: "Any warehouse" }
      ]
    });

    expect(cards.map(({ key, title, kind }) => ({ key, title, kind }))).toEqual([
      { key: "route:filters", title: "Filters", kind: "filters" },
      { key: "route:sort", title: "Sort", kind: "sort" },
      { key: "rule:RULE_1:partial", title: "Partially available", kind: "partial" },
      { key: "rule:RULE_1:unavailable", title: "Unavailable items", kind: "unavailable" }
    ]);
    expect(cards[1].items[0]).toEqual({
      target: "route.orderSorts.ORDER_DATE",
      label: "Order date",
      value: "",
      dirty: true
    });
  });

  it("keeps or discards an entire proposal card without splitting its settings", () => {
    const proposal = {
      operations: [
        { op: "set" as const, target: "route.orderSorts.ORDER_DATE", value: true },
        { op: "set" as const, target: "route.orderSorts.SHIPPING_METHOD", value: true },
        {
          op: "set" as const,
          target: "selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT",
          value: false,
          ruleKey: "RULE_3",
          ruleName: "Hail mary"
        }
      ],
      unansweredQuestions: [],
      summary: "Drafted routing changes",
      providerSummary: "Drafted routing changes",
      newRouting: { routingKey: "new:holiday", name: "Holiday" }
    };

    const selected = selectCircuitProposalCards(proposal, new Set(["route:sort"]));

    expect(selected.operations.map((operation) => operation.target)).toEqual([
      "route.orderSorts.ORDER_DATE",
      "route.orderSorts.SHIPPING_METHOD"
    ]);
    expect(selected.newRouting).toBeUndefined();
    expect(proposal.operations).toHaveLength(3);
  });

  it("detects a changed rule independent of object key order", () => {
    const baseline = {
      routingRuleId: "RULE_3",
      ruleName: "Warehouse with proximity",
      statusId: "RULE_ACTIVE",
      sequenceNum: 10,
      assignmentEnumId: "ORA_SINGLE",
      inventoryFilters: {
        ENTCT_FILTER: {
          distance: { fieldName: "distance", fieldValue: 150 }
        }
      },
      actions: {}
    };
    const reordered = {
      actions: {},
      inventoryFilters: {
        ENTCT_FILTER: {
          distance: { fieldValue: 150, fieldName: "distance" }
        }
      },
      assignmentEnumId: "ORA_SINGLE",
      sequenceNum: 10,
      statusId: "RULE_ACTIVE",
      ruleName: "Warehouse with proximity"
    };
    const changed = structuredClone(reordered);
    changed.inventoryFilters.ENTCT_FILTER.distance.fieldValue = 151;

    expect(isRoutingRuleDraftDirty(reordered, baseline)).toBe(false);
    expect(isRoutingRuleDraftDirty(changed, baseline)).toBe(true);
    expect(isRoutingRuleDraftDirty(changed, null)).toBe(true);
  });
});
