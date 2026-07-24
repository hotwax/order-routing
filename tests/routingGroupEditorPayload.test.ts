import { describe, expect, it } from "vitest";
import {
  buildRoutingGroupEditorDraftPayload,
  buildRoutingGroupSavePayload,
  stripRoutingGroupSaveIds
} from "../src/utils/routingGroupEditorPayload";

describe("routing group save payload", () => {
  it("strips UI state recursively and denormalizes excluded/descending fields", () => {
    const source = {
      routingGroupId: "G1",
      hasUnsavedChanges: true,
      isRoutingGroupDetailLoaded: true,
      schedule: { cronExpression: "0 0 * * * ?" },
      routings: [{
        orderRoutingId: "R1",
        _tempId: "route-key",
        orderFilters: [{
          fieldName: "queue_excluded",
          operator: "not-in",
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldValue: "Q1"
        }, {
          fieldName: "orderDate",
          conditionTypeEnumId: "ENTCT_SORT_BY"
        }],
        rules: [{
          routingRuleId: "RR1",
          _tempId: "rule-key",
          inventoryFilters: [{
            fieldName: "inventoryForAllocation",
            conditionTypeEnumId: "ENTCT_SORT_BY"
          }],
          actions: []
        }]
      }]
    };

    const payload = buildRoutingGroupSavePayload(
      source,
      '["orderDate desc","inventoryForAllocation desc"]'
    );

    expect(payload).not.toHaveProperty("hasUnsavedChanges");
    expect(payload).not.toHaveProperty("isRoutingGroupDetailLoaded");
    expect(payload.routings[0]).not.toHaveProperty("_tempId");
    expect(payload.routings[0].rules[0]).not.toHaveProperty("_tempId");
    expect(payload.routings[0].orderFilters[0].fieldName).toBe("queue");
    expect(payload.routings[0].orderFilters[1].fieldName).toBe("orderDate desc");
    expect(payload.routings[0].rules[0].inventoryFilters[0].fieldName).toBe("inventoryForAllocation desc");
    expect(source.routings[0].orderFilters[0].fieldName).toBe("queue_excluded");
  });

  it("removes every server-owned id from a new group hierarchy", () => {
    const payload = stripRoutingGroupSaveIds({
      routingGroupId: "00000000-0000-4000-8000-000000000001",
      routings: [{
        routingGroupId: "00000000-0000-4000-8000-000000000001",
        orderRoutingId: "00000000-0000-4000-8000-000000000002",
        orderFilters: [{ orderRoutingId: "OLD", conditionSeqId: "01" }],
        rules: [{
          orderRoutingId: "OLD",
          routingRuleId: "00000000-0000-4000-8000-000000000003",
          inventoryFilters: [{ routingRuleId: "OLD", conditionSeqId: "02" }],
          actions: [{ routingRuleId: "OLD", actionSeqId: "03" }]
        }]
      }]
    }, { isNewRoutingGroup: true });

    expect(payload).not.toHaveProperty("routingGroupId");
    expect(payload.routings[0]).not.toHaveProperty("routingGroupId");
    expect(payload.routings[0]).not.toHaveProperty("orderRoutingId");
    expect(payload.routings[0].orderFilters[0]).toEqual({});
    expect(payload.routings[0].rules[0]).not.toHaveProperty("orderRoutingId");
    expect(payload.routings[0].rules[0]).not.toHaveProperty("routingRuleId");
    expect(payload.routings[0].rules[0].inventoryFilters[0]).toEqual({});
    expect(payload.routings[0].rules[0].actions[0]).toEqual({});
  });

  it("removes copied child ids when a route/rule has a client UUID", () => {
    const payload = stripRoutingGroupSaveIds({
      routingGroupId: "G1",
      routings: [{
        orderRoutingId: "00000000-0000-4000-8000-000000000010",
        orderFilters: [{ orderRoutingId: "R1", conditionSeqId: "01", fieldName: "queue" }],
        rules: [{
          routingRuleId: "00000000-0000-4000-8000-000000000011",
          orderRoutingId: "R1",
          inventoryFilters: [{ routingRuleId: "RR1", conditionSeqId: "02", fieldName: "distance" }],
          actions: [{ routingRuleId: "RR1", actionSeqId: "03", actionTypeEnumId: "ORA_NEXT_RULE" }]
        }]
      }]
    });

    const route = payload.routings[0];
    expect(route).not.toHaveProperty("orderRoutingId");
    expect(route.orderFilters[0]).toEqual({ fieldName: "queue" });
    expect(route.rules[0]).not.toHaveProperty("routingRuleId");
    expect(route.rules[0]).not.toHaveProperty("orderRoutingId");
    expect(route.rules[0].inventoryFilters[0]).toEqual({ fieldName: "distance" });
    expect(route.rules[0].actions[0]).toEqual({ actionTypeEnumId: "ORA_NEXT_RULE" });
  });

  it("keeps established ids while stripping only a newly added rule", () => {
    const payload = stripRoutingGroupSaveIds({
      routingGroupId: "G1",
      routings: [{
        orderRoutingId: "R1",
        rules: [{
          routingRuleId: "00000000-0000-4000-8000-000000000020",
          orderRoutingId: "R1",
          inventoryFilters: [{ routingRuleId: "00000000-0000-4000-8000-000000000020", fieldName: "distance" }]
        }]
      }]
    });

    expect(payload.routingGroupId).toBe("G1");
    expect(payload.routings[0].orderRoutingId).toBe("R1");
    expect(payload.routings[0].rules[0].orderRoutingId).toBe("R1");
    expect(payload.routings[0].rules[0]).not.toHaveProperty("routingRuleId");
    expect(payload.routings[0].rules[0].inventoryFilters[0]).not.toHaveProperty("routingRuleId");
  });

  it("folds editor maps into a cloned working group", () => {
    const original = {
      routingGroupId: "G1",
      routings: [{
        orderRoutingId: "R1",
        routingName: "Before",
        orderFilters: [],
        rules: [{ routingRuleId: "RR1", inventoryFilters: [], actions: [] }]
      }]
    };

    const draft = buildRoutingGroupEditorDraftPayload({
      group: original,
      orderRoutingId: "R1",
      routingPatch: { routingName: "After" },
      orderRoutingFilterOptions: {
        promise: { fieldName: "promiseDaysCutoff", fieldValue: 0, sequenceNum: 5 }
      },
      inventoryRules: [{ routingRuleId: "RR1", ruleName: "Rule" }],
      rulesInformation: {
        RR1: {
          inventoryFilters: {
            ENTCT_FILTER: { empty: { fieldName: "empty" } },
            ENTCT_SORT_BY: { distance: { fieldName: "distance", conditionTypeEnumId: "ENTCT_SORT_BY" } }
          },
          actions: { next: { routingActionTypeId: "ORA_NEXT_RULE", actionValue: "" } }
        }
      }
    });

    expect(draft.routings[0].routingName).toBe("After");
    expect(draft.routings[0].orderFilters).toEqual([
      { fieldName: "promiseDaysCutoff", fieldValue: 0, sequenceNum: 5 }
    ]);
    expect(draft.routings[0].rules[0].inventoryFilters).toEqual([
      { fieldName: "distance", conditionTypeEnumId: "ENTCT_SORT_BY" }
    ]);
    expect(draft.routings[0].rules[0].actions).toEqual([
      { actionTypeEnumId: "ORA_NEXT_RULE", actionValue: "" }
    ]);
    expect(original.routings[0].routingName).toBe("Before");
  });
});
