import { describe, expect, it } from "vitest";
import {
  buildRoutingGroupEditorDraftPayload,
  buildRoutingGroupEditorSavePayload,
  buildRoutingGroupSavePayload,
  stripRoutingGroupSaveIds
} from "../src/utils/routingGroupEditorPayload";

describe("routing group editor payload helpers", () => {
  it("stages editor drafts without save-only denormalization or transient stripping", () => {
    const payload = buildRoutingGroupEditorDraftPayload({
      group: {
        routingGroupId: "group-1",
        hasUnsavedChanges: true,
        isRoutingGroupDetailLoaded: true,
        routings: [{
          orderRoutingId: "route-1",
          routingName: "Original route",
          statusId: "ROUTING_DRAFT",
          orderFilters: [],
          rules: [{
            routingRuleId: "rule-1",
            orderRoutingId: "route-1",
            ruleName: "Original rule",
            statusId: "RULE_DRAFT",
            sequenceNum: 0,
            inventoryFilters: [],
            actions: []
          }]
        }]
      },
      orderRoutingId: "route-1",
      routingPatch: {
        routingName: "Draft route",
        statusId: "ROUTING_ACTIVE"
      },
      orderRoutingFilterOptions: {
        queue_excluded: {
          orderRoutingId: "route-1",
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldName: "queue_excluded",
          operator: "not-in",
          fieldValue: "FAC_A,FAC_B",
          sequenceNum: 0
        }
      },
      inventoryRules: [{
        routingRuleId: "rule-1",
        orderRoutingId: "route-1",
        ruleName: "Draft rule",
        statusId: "RULE_ACTIVE",
        sequenceNum: 0
      }],
      rulesInformation: {
        "rule-1": {
          routingRuleId: "rule-1",
          inventoryFilters: {
            ENTCT_FILTER: {
              facilityGroup_excluded: {
                routingRuleId: "rule-1",
                conditionTypeEnumId: "ENTCT_FILTER",
                fieldName: "facilityGroup_excluded",
                operator: "not-equals",
                fieldValue: "FG_A"
              }
            }
          },
          actions: {
            ORA_NEXT_RULE: {
              routingRuleId: "rule-1",
              routingActionTypeId: "ORA_NEXT_RULE",
              actionValue: ""
            }
          }
        }
      }
    });

    expect(payload.hasUnsavedChanges).toBe(true);
    expect(payload.isRoutingGroupDetailLoaded).toBe(true);
    expect(payload.routings[0].routingName).toBe("Draft route");
    expect(payload.routings[0].orderFilters[0].fieldName).toBe("queue_excluded");
    expect(payload.routings[0].rules[0].inventoryFilters[0].fieldName).toBe("facilityGroup_excluded");
    expect(payload.routings[0].rules[0].actions[0]).toEqual({
      routingRuleId: "rule-1",
      actionTypeEnumId: "ORA_NEXT_RULE",
      actionValue: ""
    });
  });

  it("preserves a staged sibling route draft when saving the current route", () => {
    const group = {
      routingGroupId: "group-1",
      routings: [{
        orderRoutingId: "route-1",
        routingName: "Route one",
        statusId: "ROUTING_DRAFT",
        orderFilters: [],
        rules: []
      }, {
        orderRoutingId: "route-2",
        routingName: "Route two",
        statusId: "ROUTING_DRAFT",
        orderFilters: [],
        rules: []
      }]
    };

    const stagedGroup = buildRoutingGroupEditorDraftPayload({
      group,
      orderRoutingId: "route-1",
      routingPatch: {
        routingName: "Staged route one",
        statusId: "ROUTING_ACTIVE"
      },
      orderRoutingFilterOptions: {},
      orderRoutingSortOptions: {},
      inventoryRules: [],
      rulesInformation: {}
    });

    const payload = buildRoutingGroupEditorSavePayload({
      group: stagedGroup,
      orderRoutingId: "route-2",
      routingPatch: {
        routingName: "Saved route two",
        statusId: "ROUTING_ACTIVE"
      },
      orderRoutingFilterOptions: {},
      orderRoutingSortOptions: {},
      inventoryRules: [],
      rulesInformation: {}
    });

    expect(payload.routings.find((routing: any) => routing.orderRoutingId === "route-1")).toMatchObject({
      routingName: "Staged route one",
      statusId: "ROUTING_ACTIVE"
    });
    expect(payload.routings.find((routing: any) => routing.orderRoutingId === "route-2")).toMatchObject({
      routingName: "Saved route two",
      statusId: "ROUTING_ACTIVE"
    });
  });

  it("folds editor dictionaries into a full routing-group payload", () => {
    const group = {
      routingGroupId: "group-1",
      productStoreId: "store-1",
      hasUnsavedChanges: true,
      routings: [{
        orderRoutingId: "route-1",
        routingGroupId: "group-1",
        routingName: "Original route",
        statusId: "ROUTING_DRAFT",
        orderFilters: [],
        rules: [{
          routingRuleId: "rule-1",
          orderRoutingId: "route-1",
          ruleName: "Original rule",
          statusId: "RULE_DRAFT",
          assignmentEnumId: "ORA_SINGLE",
          sequenceNum: 0,
          inventoryFilters: [],
          actions: []
        }]
      }]
    };

    const payload = buildRoutingGroupEditorSavePayload({
      group,
      orderRoutingId: "route-1",
      routingPatch: {
        routingName: "Updated route",
        statusId: "ROUTING_ACTIVE"
      },
      orderRoutingFilterOptions: {
        queue_excluded: {
          orderRoutingId: "route-1",
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldName: "queue_excluded",
          operator: "not-in",
          fieldValue: "FAC_A,FAC_B"
        }
      },
      orderRoutingSortOptions: {
        orderDate: {
          orderRoutingId: "route-1",
          conditionTypeEnumId: "ENTCT_SORT_BY",
          fieldName: "orderDate",
          sequenceNum: 0
        }
      },
      inventoryRules: [{
        routingRuleId: "rule-1",
        orderRoutingId: "route-1",
        ruleName: "Updated rule",
        statusId: "RULE_ACTIVE",
        assignmentEnumId: "ORA_MULTI",
        sequenceNum: 0
      }],
      rulesInformation: {
        "rule-1": {
          routingRuleId: "rule-1",
          orderRoutingId: "route-1",
          inventoryFilters: {
            ENTCT_FILTER: {
              facilityGroup_excluded: {
                routingRuleId: "rule-1",
                conditionTypeEnumId: "ENTCT_FILTER",
                fieldName: "facilityGroup_excluded",
                operator: "not-equals",
                fieldValue: "FG_A"
              }
            },
            ENTCT_SORT_BY: {
              distance: {
                routingRuleId: "rule-1",
                conditionTypeEnumId: "ENTCT_SORT_BY",
                fieldName: "distance",
                sequenceNum: 0
              }
            }
          },
          actions: {
            ORA_NEXT_RULE: {
              routingRuleId: "rule-1",
              routingActionTypeId: "ORA_NEXT_RULE",
              actionValue: ""
            }
          }
        }
      }
    });

    const routing = payload.routings[0];
    expect(routing.routingName).toBe("Updated route");
    expect(routing.statusId).toBe("ROUTING_ACTIVE");
    expect(routing.orderFilters).toHaveLength(2);
    expect(routing.rules[0].ruleName).toBe("Updated rule");
    expect(routing.rules[0].assignmentEnumId).toBe("ORA_MULTI");
    expect(routing.rules[0].inventoryFilters).toHaveLength(2);
    expect(routing.rules[0].actions).toEqual([{
      routingRuleId: "rule-1",
      actionTypeEnumId: "ORA_NEXT_RULE",
      actionValue: ""
    }]);
  });

  it("keeps list-owned rule status and sequence when cached rule details are stale", () => {
    const payload = buildRoutingGroupEditorSavePayload({
      group: {
        routingGroupId: "group-1",
        routings: [{
          orderRoutingId: "route-1",
          rules: [{
            routingRuleId: "rule-1",
            orderRoutingId: "route-1",
            ruleName: "Rule one",
            statusId: "RULE_DRAFT",
            sequenceNum: 0,
            inventoryFilters: [],
            actions: []
          }, {
            routingRuleId: "rule-2",
            orderRoutingId: "route-1",
            ruleName: "Rule two",
            statusId: "RULE_ACTIVE",
            sequenceNum: 5,
            inventoryFilters: [],
            actions: []
          }]
        }]
      },
      orderRoutingId: "route-1",
      inventoryRules: [{
        routingRuleId: "rule-2",
        orderRoutingId: "route-1",
        ruleName: "Rule two",
        statusId: "RULE_ACTIVE",
        sequenceNum: 0
      }, {
        routingRuleId: "rule-1",
        orderRoutingId: "route-1",
        ruleName: "Rule one",
        statusId: "RULE_ARCHIVED",
        sequenceNum: 5
      }],
      rulesInformation: {
        "rule-1": {
          routingRuleId: "rule-1",
          statusId: "RULE_DRAFT",
          sequenceNum: 0,
          inventoryFilters: [],
          actions: []
        },
        "rule-2": {
          routingRuleId: "rule-2",
          statusId: "RULE_ACTIVE",
          sequenceNum: 5,
          inventoryFilters: [],
          actions: []
        }
      }
    });

    expect(payload.routings[0].rules.map((rule: any) => ({
      id: rule.routingRuleId,
      statusId: rule.statusId,
      sequenceNum: rule.sequenceNum
    }))).toEqual([{
      id: "rule-2",
      statusId: "RULE_ACTIVE",
      sequenceNum: 0
    }, {
      id: "rule-1",
      statusId: "RULE_ARCHIVED",
      sequenceNum: 5
    }]);
  });

  it("drops newly selected filters without values while preserving sort options", () => {
    const payload = buildRoutingGroupEditorSavePayload({
      group: {
        routingGroupId: "group-1",
        routings: [{
          orderRoutingId: "route-1",
          orderFilters: [],
          rules: [{
            routingRuleId: "rule-1",
            orderRoutingId: "route-1",
            ruleName: "Rule one",
            statusId: "RULE_ACTIVE",
            sequenceNum: 0,
            inventoryFilters: [],
            actions: []
          }]
        }]
      },
      orderRoutingId: "route-1",
      orderRoutingFilterOptions: {
        facilityId: {
          orderRoutingId: "route-1",
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldName: "facilityId",
          sequenceNum: 0
        },
        promiseDaysCutoff: {
          orderRoutingId: "route-1",
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldName: "promiseDaysCutoff",
          fieldValue: 0,
          sequenceNum: 5
        }
      },
      orderRoutingSortOptions: {
        orderDate: {
          orderRoutingId: "route-1",
          conditionTypeEnumId: "ENTCT_SORT_BY",
          fieldName: "orderDate",
          sequenceNum: 10
        }
      },
      inventoryRules: [{
        routingRuleId: "rule-1",
        orderRoutingId: "route-1",
        ruleName: "Rule one",
        statusId: "RULE_ACTIVE",
        sequenceNum: 0
      }],
      rulesInformation: {
        "rule-1": {
          routingRuleId: "rule-1",
          inventoryFilters: {
            ENTCT_FILTER: {
              facilityGroupId: {
                routingRuleId: "rule-1",
                conditionTypeEnumId: "ENTCT_FILTER",
                fieldName: "facilityGroupId",
                sequenceNum: 0
              },
              brokeringSafetyStock: {
                routingRuleId: "rule-1",
                conditionTypeEnumId: "ENTCT_FILTER",
                fieldName: "brokeringSafetyStock",
                fieldValue: 0,
                sequenceNum: 5
              }
            },
            ENTCT_SORT_BY: {
              distance: {
                routingRuleId: "rule-1",
                conditionTypeEnumId: "ENTCT_SORT_BY",
                fieldName: "distance",
                sequenceNum: 10
              }
            }
          },
          actions: []
        }
      }
    });

    expect(payload.routings[0].orderFilters).toEqual([{
      orderRoutingId: "route-1",
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: "promiseDaysCutoff",
      fieldValue: 0,
      sequenceNum: 5
    }, {
      orderRoutingId: "route-1",
      conditionTypeEnumId: "ENTCT_SORT_BY",
      fieldName: "orderDate",
      sequenceNum: 10
    }]);
    expect(payload.routings[0].rules[0].inventoryFilters).toEqual([{
      routingRuleId: "rule-1",
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: "brokeringSafetyStock",
      fieldValue: 0,
      sequenceNum: 5
    }, {
      routingRuleId: "rule-1",
      conditionTypeEnumId: "ENTCT_SORT_BY",
      fieldName: "distance",
      sequenceNum: 10
    }]);
  });

  it("keeps first-rule action edits when a route previously had no rules", () => {
    const temporaryRuleId = "00000000-0000-4000-8000-000000000101";
    const payload = buildRoutingGroupEditorSavePayload({
      group: {
        routingGroupId: "group-1",
        routings: [{
          orderRoutingId: "route-1",
          routingName: "Empty route",
          statusId: "ROUTING_ACTIVE",
          orderFilters: [],
          rules: []
        }]
      },
      orderRoutingId: "route-1",
      inventoryRules: [{
        routingRuleId: temporaryRuleId,
        orderRoutingId: "route-1",
        ruleName: "First rule",
        statusId: "RULE_DRAFT",
        assignmentEnumId: "ORA_SINGLE",
        sequenceNum: 0
      }],
      rulesInformation: {
        [temporaryRuleId]: {
          routingRuleId: temporaryRuleId,
          orderRoutingId: "route-1",
          ruleName: "First rule",
          statusId: "RULE_DRAFT",
          assignmentEnumId: "ORA_SINGLE",
          sequenceNum: 0,
          inventoryFilters: {
            ENTCT_FILTER: {},
            ENTCT_SORT_BY: {}
          },
          actions: {
            ORA_MV_TO_QUEUE: {
              routingRuleId: temporaryRuleId,
              actionTypeEnumId: "ORA_MV_TO_QUEUE",
              actionValue: "REJECTED_ITEM_PARKING",
              createdDate: 1
            }
          }
        }
      }
    });

    expect(payload.routings[0].rules).toHaveLength(1);
    expect(payload.routings[0].rules[0].actions).toEqual([{
      routingRuleId: temporaryRuleId,
      actionTypeEnumId: "ORA_MV_TO_QUEUE",
      actionValue: "REJECTED_ITEM_PARKING",
      createdDate: 1
    }]);
  });

  it("denormalizes excluded promise-date filters with the negative operator", () => {
    const payload = buildRoutingGroupEditorSavePayload({
      group: {
        routingGroupId: "group-1",
        routings: [{
          orderRoutingId: "route-1",
          orderFilters: [],
          rules: []
        }]
      },
      orderRoutingId: "route-1",
      orderRoutingFilterOptions: {
        promiseDaysCutoff_excluded: {
          orderRoutingId: "route-1",
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldName: "promiseDaysCutoff_excluded",
          fieldValue: "2",
          operator: "not-equals",
          sequenceNum: 0
        }
      },
      inventoryRules: []
    });

    expect(payload.routings[0].orderFilters).toEqual([{
      orderRoutingId: "route-1",
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: "promiseDaysCutoff",
      fieldValue: "2",
      operator: "not-equals",
      sequenceNum: 0
    }]);
  });

  it("denormalizes UI-only field names before single-json save", () => {
    const payload = buildRoutingGroupSavePayload({
      routingGroupId: "group-1",
      hasUnsavedChanges: true,
      isNew: true,
      isRoutingGroupDetailLoaded: true,
      routings: [{
        orderRoutingId: "route-1",
        orderFilters: [{
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldName: "queue_excluded",
          operator: "not-in",
          fieldValue: "FAC_A,FAC_B"
        }, {
          conditionTypeEnumId: "ENTCT_SORT_BY",
          fieldName: "orderDate",
          sequenceNum: 0
        }],
        rules: [{
          routingRuleId: "rule-1",
          inventoryFilters: [{
            conditionTypeEnumId: "ENTCT_FILTER",
            fieldName: "facilityGroup_excluded",
            operator: "not-equals",
            fieldValue: "FG_A"
          }, {
            conditionTypeEnumId: "ENTCT_SORT_BY",
            fieldName: "distance",
            sequenceNum: 0
          }],
          actions: []
        }]
      }]
    }, "orderDate,distance");

    expect(payload).not.toHaveProperty("hasUnsavedChanges");
    expect(payload).not.toHaveProperty("isNew");
    expect(payload).not.toHaveProperty("isRoutingGroupDetailLoaded");
    expect(payload.routings[0].orderFilters).toEqual([{
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: "queue",
      operator: "not-in",
      fieldValue: "FAC_A,FAC_B"
    }, {
      conditionTypeEnumId: "ENTCT_SORT_BY",
      fieldName: "orderDate desc",
      sequenceNum: 0
    }]);
    expect(payload.routings[0].rules[0].inventoryFilters).toEqual([{
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: "facilityGroup",
      operator: "not-equals",
      fieldValue: "FG_A"
    }, {
      conditionTypeEnumId: "ENTCT_SORT_BY",
      fieldName: "distance desc",
      sequenceNum: 0
    }]);
  });

  it("strips temporary client ids from nested new-rule payloads", () => {
    const temporaryRuleId = "00000000-0000-4000-8000-000000000001";
    const payload = stripRoutingGroupSaveIds({
      routingGroupId: "M100104",
      routings: [{
        orderRoutingId: "M100102",
        rules: [{
          routingRuleId: temporaryRuleId,
          orderRoutingId: "M100102",
          ruleName: "New draft rule",
          inventoryFilters: [{
            routingRuleId: temporaryRuleId,
            conditionTypeEnumId: "ENTCT_FILTER",
            fieldName: "facilityGroup",
            fieldValue: "SV"
          }],
          actions: [{
            routingRuleId: temporaryRuleId,
            actionTypeEnumId: "ORA_NEXT_RULE",
            actionValue: ""
          }]
        }]
      }]
    });

    expect(payload.routingGroupId).toBe("M100104");
    expect(payload.routings[0].orderRoutingId).toBe("M100102");
    expect(payload.routings[0].rules[0]).not.toHaveProperty("routingRuleId");
    expect(payload.routings[0].rules[0].orderRoutingId).toBe("M100102");
    expect(payload.routings[0].rules[0].inventoryFilters[0]).not.toHaveProperty("routingRuleId");
    expect(payload.routings[0].rules[0].actions[0]).not.toHaveProperty("routingRuleId");
  });

  it("strips copied child sequence ids from cloned routes and rules", () => {
    const temporaryRoutingId = "00000000-0000-4000-8000-000000000020";
    const temporaryRuleId = "00000000-0000-4000-8000-000000000021";
    const payload = stripRoutingGroupSaveIds({
      routingGroupId: "M100104",
      routings: [{
        orderRoutingId: temporaryRoutingId,
        orderFilters: [{
          orderRoutingId: "M100102",
          conditionSeqId: "03",
          conditionTypeEnumId: "ENTCT_FILTER",
          fieldName: "queue",
          fieldValue: "REJECTED"
        }],
        rules: [{
          routingRuleId: temporaryRuleId,
          orderRoutingId: "M100102",
          ruleName: "Copied rule",
          inventoryFilters: [{
            routingRuleId: "M100111",
            conditionSeqId: "07",
            conditionTypeEnumId: "ENTCT_FILTER",
            fieldName: "facilityGroup",
            fieldValue: "SV"
          }],
          actions: [{
            routingRuleId: "M100111",
            actionSeqId: "02",
            actionTypeEnumId: "ORA_NEXT_RULE",
            actionValue: ""
          }]
        }]
      }]
    });

    const routing = payload.routings[0];
    expect(routing).not.toHaveProperty("orderRoutingId");
    expect(routing.orderFilters[0]).not.toHaveProperty("orderRoutingId");
    expect(routing.orderFilters[0]).not.toHaveProperty("conditionSeqId");
    expect(routing.rules[0]).not.toHaveProperty("routingRuleId");
    expect(routing.rules[0]).not.toHaveProperty("orderRoutingId");
    expect(routing.rules[0].inventoryFilters[0]).not.toHaveProperty("routingRuleId");
    expect(routing.rules[0].inventoryFilters[0]).not.toHaveProperty("conditionSeqId");
    expect(routing.rules[0].actions[0]).not.toHaveProperty("routingRuleId");
    expect(routing.rules[0].actions[0]).not.toHaveProperty("actionSeqId");
  });

  it("strips all ids when saving a new routing group", () => {
    const payload = stripRoutingGroupSaveIds({
      routingGroupId: "00000000-0000-4000-8000-000000000010",
      routings: [{
        routingGroupId: "00000000-0000-4000-8000-000000000010",
        orderRoutingId: "00000000-0000-4000-8000-000000000011",
        orderFilters: [{
          orderRoutingId: "00000000-0000-4000-8000-000000000011",
          conditionSeqId: "01",
          fieldName: "queue"
        }],
        rules: [{
          routingRuleId: "00000000-0000-4000-8000-000000000012",
          orderRoutingId: "00000000-0000-4000-8000-000000000011",
          inventoryFilters: [{
            routingRuleId: "00000000-0000-4000-8000-000000000012",
            conditionSeqId: "02",
            fieldName: "facilityGroup"
          }],
          actions: [{
            routingRuleId: "00000000-0000-4000-8000-000000000012",
            actionSeqId: "03",
            actionTypeEnumId: "ORA_NEXT_RULE"
          }]
        }]
      }]
    }, { isNewRoutingGroup: true });

    expect(payload).not.toHaveProperty("routingGroupId");
    expect(payload.routings[0]).not.toHaveProperty("routingGroupId");
    expect(payload.routings[0]).not.toHaveProperty("orderRoutingId");
    expect(payload.routings[0].orderFilters[0]).not.toHaveProperty("orderRoutingId");
    expect(payload.routings[0].orderFilters[0]).not.toHaveProperty("conditionSeqId");
    expect(payload.routings[0].rules[0]).not.toHaveProperty("routingRuleId");
    expect(payload.routings[0].rules[0]).not.toHaveProperty("orderRoutingId");
    expect(payload.routings[0].rules[0].inventoryFilters[0]).not.toHaveProperty("routingRuleId");
    expect(payload.routings[0].rules[0].inventoryFilters[0]).not.toHaveProperty("conditionSeqId");
    expect(payload.routings[0].rules[0].actions[0]).not.toHaveProperty("routingRuleId");
    expect(payload.routings[0].rules[0].actions[0]).not.toHaveProperty("actionSeqId");
  });
});
