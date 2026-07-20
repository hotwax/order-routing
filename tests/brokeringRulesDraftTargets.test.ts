import { describe, expect, it } from "vitest";
import { applyDraftOperations } from "@/utils/draftUtils";
import {
  buildBrokeringRulesBindings,
  buildBrokeringRulesManifest,
} from "@/utils/brokeringRulesManifest";

const ruleEnums = {
  QUEUE: { id: "OIP_QUEUE", code: "facilityId" },
};
const conditionFilterEnums = {
  FACILITY_GROUP: { id: "IIP_FACILITY_GROUP", code: "facilityGroupId" },
  SPLIT_ITEM_GROUP: { id: "IIP_SPLIT_ITEM_GROUP", code: "splitOrderItemGroup" },
};
const conditionSortEnums = {
  PROXIMITY: { id: "ISP_PROXIMITY", code: "distance" },
};
const actionEnums = {
  RM_AUTO_CANCEL_DATE: { id: "ORA_RM_CANCEL_DATE", code: "RM_AUTO_CANCEL_DATE" },
  AUTO_CANCEL_DAYS: { id: "ORA_AUTO_CANCEL_DAYS", code: "ADD_AUTO_CANCEL_DATE" },
  NEXT_RULE: { id: "ORA_NEXT_RULE", code: "NEXT_RULE" },
  MOVE_TO_QUEUE: { id: "ORA_MV_TO_QUEUE", code: "MOVE_TO_QUEUE" },
};

function fixture() {
  const selectedRule = {
    routingRuleId: "RULE_1",
    ruleName: "Primary rule",
    statusId: "RULE_DRAFT",
    assignmentEnumId: "ORA_SINGLE",
    sequenceNum: 1,
  };
  const inventoryRules = [{ ...selectedRule }];
  const rulesInformation = {
    RULE_1: {
      ...selectedRule,
      inventoryFilters: { ENTCT_FILTER: {}, ENTCT_SORT_BY: {} },
      actions: {
        ORA_MV_TO_QUEUE: {
          routingRuleId: "RULE_1",
          actionTypeEnumId: "ORA_MV_TO_QUEUE",
          actionValue: "BROKERING_QUEUE",
        },
      },
    },
  };
  const draft = {
    orderRoutingId: "ROUTING_1",
    selectedRoutingRule: { value: { ...selectedRule } },
    routingStatus: { value: "ROUTING_DRAFT" },
    orderRoutingFilterOptions: {
      value: {
        facilityId: {
          conditionTypeEnumId: "ENTCT_FILTER" as const,
          fieldName: "facilityId",
          fieldValue: "BROKERING_QUEUE",
        },
      },
    },
    orderRoutingSortOptions: { value: {} },
    inventoryRuleFilterOptions: { value: {} },
    inventoryRuleSortOptions: { value: {} },
    inventoryRuleActions: { value: { ...rulesInformation.RULE_1.actions } },
    inventoryRules: { value: inventoryRules },
    rulesInformation: { value: rulesInformation },
    rulesForReorder: { value: inventoryRules },
    ruleActionType: { value: "ORA_MV_TO_QUEUE" },
    hasUnsavedChanges: { value: false },
    ruleEnums,
    conditionFilterEnums,
    conditionSortEnums,
    actionEnums,
  };
  const manifest = buildBrokeringRulesManifest({
    pageRoute: "/tabs/circuit",
    orderRoutingId: "ROUTING_1",
    routingName: "Primary",
    routingStatus: draft.routingStatus.value,
    brokeringRun: {
      routingGroupId: "GROUP_1",
      groupName: "US Brokering",
      productStoreId: "STORE",
      routings: [
        { orderRoutingId: "ROUTING_1", routingName: "Primary", statusId: "ROUTING_DRAFT", sequenceNum: 1 },
        { orderRoutingId: "ROUTING_2", routingName: "Fallback", statusId: "ROUTING_ACTIVE", sequenceNum: 2 },
      ],
    },
    selectedRoutingRule: draft.selectedRoutingRule.value,
    isTestEnabled: false,
    orderRoutingFilterOptions: draft.orderRoutingFilterOptions.value,
    orderRoutingSortOptions: {},
    inventoryRuleFilterOptions: {},
    inventoryRuleSortOptions: {},
    inventoryRuleActions: draft.inventoryRuleActions.value,
    inventoryRules,
    rulesInformation,
    ruleActionType: draft.ruleActionType.value,
    ruleEnums,
    conditionFilterEnums,
    conditionSortEnums,
    actionEnums,
    facilities: {
      BROKERING_QUEUE: { facilityName: "Brokering Queue" },
      UNFILLABLE_PARKING: { facilityName: "Unfillable Parking" },
    },
    shippingMethods: {},
    salesChannels: {},
    facilityGroups: {},
    brokeringFacilityGroups: {},
  });

  return { draft, manifest };
}

describe("Circuit brokering-rule manifest", () => {
  it("exposes the current run, sibling routings, and readable active filters", () => {
    const { manifest } = fixture();
    const brokeringRun = manifest.visibleEntities.brokeringRun as any;
    const route = manifest.visibleEntities.route as any;

    expect(brokeringRun).toMatchObject({ routingGroupId: "GROUP_1", groupName: "US Brokering" });
    expect(brokeringRun.availableSiblingRoutings.map((routing: any) => routing.routingName))
      .toEqual(["Primary", "Fallback"]);
    expect(route.currentOrderFilters).toEqual([expect.objectContaining({
      target: "route.orderFilters.QUEUE",
      valueLabel: "Brokering Queue",
    })]);
    expect(route.draftLimitations).toMatchObject({
      canCreateInventoryRules: true,
      canCreateSiblingRoutings: true,
    });
  });

  it("applies validated route, allocation, and unavailable-item changes to the local draft", () => {
    const { draft, manifest } = fixture();
    const result = applyDraftOperations([
      { op: "set", target: "route.statusId", value: "ROUTING_ACTIVE" },
      { op: "set", target: "selectedRule.partialAllocation", value: true },
      { op: "set", target: "selectedRule.unavailableItemsQueueId", value: "unfillable queue" },
    ], manifest, buildBrokeringRulesBindings(draft));

    expect(result.appliedCount).toBe(3);
    expect(draft.routingStatus.value).toBe("ROUTING_ACTIVE");
    expect(draft.selectedRoutingRule.value.assignmentEnumId).toBe("ORA_MULTI");
    expect(draft.inventoryRuleActions.value.ORA_MV_TO_QUEUE.actionValue).toBe("UNFILLABLE_PARKING");
    expect(draft.hasUnsavedChanges.value).toBe(true);
  });

  it("rejects values outside the manifest instead of mutating the draft", () => {
    const { draft, manifest } = fixture();
    const result = applyDraftOperations([
      { op: "set", target: "selectedRule.statusId", value: "RULE_DELETED" },
    ], manifest, buildBrokeringRulesBindings(draft));

    expect(result.appliedCount).toBe(0);
    expect(result.unansweredQuestions).toHaveLength(1);
    expect(draft.selectedRoutingRule.value.statusId).toBe("RULE_DRAFT");
    expect(draft.hasUnsavedChanges.value).toBe(false);
  });
});
