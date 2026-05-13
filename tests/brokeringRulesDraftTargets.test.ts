import assert from "assert";
import { applyDraftOperations } from "../src/services/DraftAssistantService";
import type { DraftOperation } from "../src/services/DraftAssistantService";
import {
  buildBrokeringRulesBindings,
  buildBrokeringRulesManifest
} from "../src/draftTargets/BrokeringRulesDraftTargets";

const ruleEnums = {
  QUEUE: { id: "OIP_QUEUE", code: "facilityId" },
  QUEUE_EXCLUDED: { id: "OIP_QUEUE_EXCLUDED", code: "facilityId_excluded" },
  PROD_CATEGORY: { id: "OIP_PROD_CATEGORY", code: "productCategoryId" },
  PROD_CATEGORY_EXCLUDED: { id: "PROD_CATEGORY_EXCLUDED", code: "productCategoryId_excluded" },
  SHIPPING_METHOD: { id: "OIP_SHIP_METH_TYPE", code: "shipmentMethodTypeId" },
  SHIPPING_METHOD_EXCLUDED: { id: "OIP_SHIP_METH_TYPE_EXCLUDED", code: "shipmentMethodTypeId_excluded" },
  PRIORITY: { id: "OIP_PRIORITY", code: "priority" },
  PRIORITY_EXCLUDED: { id: "OIP_PRIORITY_EXCLUDED", code: "priority_excluded" },
  PROMISE_DATE: { id: "OIP_PROMISE_DATE", code: "promiseDaysCutoff" },
  PROMISE_DATE_EXCLUDED: { id: "OIP_PROMISE_DATE_EXCLUDED", code: "promiseDaysCutoff_excluded" },
  SALES_CHANNEL: { id: "OIP_SALES_CHANNEL", code: "salesChannelEnumId" },
  SALES_CHANNEL_EXCLUDED: { id: "OIP_SALES_CHANNEL_EXCLUDED", code: "salesChannelEnumId_excluded" },
  ORIGIN_FACILITY_GROUP: { id: "OIP_ORIGIN_FAC_GRP", code: "originFacilityGroupId" },
  ORIGIN_FACILITY_GROUP_EXCLUDED: { id: "OIP_ORIGIN_FAC_GRP_EXCLUDED", code: "originFacilityGroupId_excluded" },
  SHIP_BY: { id: "OSP_SHIP_BY", code: "shipBeforeDate" },
  SHIP_AFTER: { id: "OSP_SHIP_AFTER", code: "shipAfterDate" },
  ORDER_DATE: { id: "OSP_ORDER_DATE", code: "orderDate" },
  SHIPPING_METHOD_SORT: { id: "OSP_SHIP_METH", code: "deliveryDays" },
  SORT_PRIORITY: { id: "OSP_PRIORITY", code: "priority" }
};

const conditionFilterEnums = {
  FACILITY_GROUP: { id: "IIP_FACILITY_GROUP", code: "facilityGroupId" },
  FACILITY_GROUP_EXCLUDED: { id: "IIP_FACILITY_GROUP_EXCLUDED", code: "facilityGroupId_excluded" },
  PROXIMITY: { id: "IIP_PROXIMITY", code: "distance" },
  BRK_SAFETY_STOCK: { id: "IIP_BRK_SFTY_STOCK", code: "brokeringSafetyStock" },
  MEASUREMENT_SYSTEM: { id: "IIP_MSMNT_SYSTEM", code: "measurementSystem" },
  SPLIT_ITEM_GROUP: { id: "IIP_SPLIT_ITEM_GROUP", code: "splitOrderItemGroup" },
  FACILITY_ORDER_LIMIT: { id: "IFP_IGNORE_ORD_FAC_LIMIT", code: "ignoreFacilityOrderLimit" },
  SHIP_THRESHOLD: { id: "IFP_SHIP_THREHOLD", code: "shipmentThreshold" },
  WOS: { id: "IFP_WOS", code: "weekOfSupply" }
};

const conditionSortEnums = {
  PROXIMITY: { id: "ISP_PROXIMITY", code: "distance" },
  INV_BALANCE: { id: "ISP_INV_BAL", code: "inventoryForAllocation" },
  CUSTOMER_SEQ: { id: "ISP_CUST_SEQ", code: "facilitySequence" }
};

const actionEnums = {
  RM_AUTO_CANCEL_DATE: { id: "ORA_RM_CANCEL_DATE", code: "RM_AUTO_CANCEL_DATE" },
  AUTO_CANCEL_DAYS: { id: "ORA_AUTO_CANCEL_DAYS", code: "ADD_AUTO_CANCEL_DATE" },
  NEXT_RULE: { id: "ORA_NEXT_RULE", code: "NEXT_RULE" },
  MOVE_TO_QUEUE: { id: "ORA_MV_TO_QUEUE", code: "MOVE_TO_QUEUE" }
};

function createFixture(overrides: any = {}) {
  const selectedRoutingRule = { routingRuleId: "rule-1", ruleName: "Primary rule", statusId: "RULE_DRAFT", assignmentEnumId: "ORA_SINGLE" };
  const inventoryRules = overrides.inventoryRules || [{ ...selectedRoutingRule, ...overrides.selectedRoutingRule, sequenceNum: 0 }];
  const rulesInformation = overrides.rulesInformation || {
    "rule-1": { ...selectedRoutingRule, ...overrides.selectedRoutingRule, inventoryFilters: { ENTCT_FILTER: {}, ENTCT_SORT_BY: {} }, actions: {} }
  };
  const draft = {
    orderRoutingId: "route-1",
    selectedRoutingRule: { value: { ...selectedRoutingRule, ...overrides.selectedRoutingRule } },
    routingStatus: { value: overrides.routingStatus || "ROUTING_DRAFT" },
    orderRoutingFilterOptions: { value: overrides.orderRoutingFilterOptions || {} },
    orderRoutingSortOptions: { value: overrides.orderRoutingSortOptions || {} },
    inventoryRuleFilterOptions: { value: overrides.inventoryRuleFilterOptions || {} },
    inventoryRuleSortOptions: { value: overrides.inventoryRuleSortOptions || {} },
    inventoryRuleActions: { value: overrides.inventoryRuleActions || {
      ORA_MV_TO_QUEUE: {
        routingRuleId: "rule-1",
        actionTypeEnumId: "ORA_MV_TO_QUEUE",
        actionValue: "QUEUE_A"
      }
    } },
    inventoryRules: { value: inventoryRules },
    rulesInformation: { value: rulesInformation },
    rulesForReorder: { value: inventoryRules },
    ruleActionType: { value: overrides.ruleActionType || "ORA_MV_TO_QUEUE" },
    hasUnsavedChanges: { value: false },
    ruleEnums,
    conditionFilterEnums,
    conditionSortEnums,
    actionEnums
  };
  const manifest = buildBrokeringRulesManifest({
    pageRoute: "/tabs/brokering/M100000/M100000/rules",
    orderRoutingId: draft.orderRoutingId,
    routingName: "Route A",
    routingStatus: draft.routingStatus.value,
    selectedRoutingRule: draft.selectedRoutingRule.value,
    isTestEnabled: false,
    orderRoutingFilterOptions: draft.orderRoutingFilterOptions.value,
    orderRoutingSortOptions: draft.orderRoutingSortOptions.value,
    inventoryRuleFilterOptions: draft.inventoryRuleFilterOptions.value,
    inventoryRuleSortOptions: draft.inventoryRuleSortOptions.value,
    inventoryRuleActions: draft.inventoryRuleActions.value,
    inventoryRules: draft.inventoryRules.value,
    rulesInformation: draft.rulesInformation.value,
    ruleActionType: draft.ruleActionType.value,
    ruleEnums,
    conditionFilterEnums,
    conditionSortEnums,
    actionEnums,
    brokeringRun: overrides.brokeringRun,
    facilities: overrides.facilities || { QUEUE_A: { facilityName: "Queue A" }, QUEUE_B: { facilityName: "Queue B" } },
    shippingMethods: overrides.shippingMethods || {},
    salesChannels: { WEB_SALES_CHANNEL: { description: "Web" } },
    facilityGroups: overrides.facilityGroups || { FG1: { facilityGroupName: "West" } },
    brokeringFacilityGroups: overrides.brokeringFacilityGroups || { FG1: { facilityGroupName: "West", facilityGroupTypeId: "BROKERING_GROUP" } }
  });

  return { draft, manifest };
}

function apply(operations: DraftOperation[], overrides: any = {}) {
  const fixture = createFixture(overrides);
  const result = applyDraftOperations(operations, fixture.manifest, buildBrokeringRulesBindings(fixture.draft));
  return { ...fixture, result };
}

const queueFacilities = {
  BROKERING_QUEUE: { facilityName: "Brokering Queue" },
  UNFILLABLE_PARKING: { facilityName: "Unfillable Parking" },
  UNFILLABLE_HOLD_PARKING: { facilityName: "Unfillable Hold Parking" }
};

{
  const { draft, result } = apply([{ op: "set", target: "selectedRule.statusId", value: "RULE_ARCHIVED" }]);
  assert.equal(result.appliedCount, 1);
  assert.equal(draft.selectedRoutingRule.value.statusId, "RULE_ARCHIVED");
  assert.equal(draft.inventoryRules.value[0].statusId, "RULE_ARCHIVED");
  assert.equal(draft.hasUnsavedChanges.value, true);
}

{
  const { manifest } = createFixture();
  const routeEntity = manifest.visibleEntities.route as any;

  assert.equal(routeEntity.draftLimitations.selectedRuleOnly, false);
  assert.equal(routeEntity.draftLimitations.canCreateInventoryRules, true);
  assert.equal(routeEntity.availableInventoryRules[0].routingRuleId, "rule-1");
  assert.equal(routeEntity.availableInventoryRules[0].ruleName, "Primary rule");
  assert.equal(routeEntity.availableInventoryRules[0].statusId, "RULE_DRAFT");
  assert.equal(routeEntity.availableInventoryRules[0].sequenceNum, 0);
}

{
  const { manifest } = createFixture({
    brokeringRun: {
      routingGroupId: "100051",
      groupName: "Overnight Priority Orders",
      productStoreId: "STORE"
    }
  });
  const brokeringRun = manifest.visibleEntities.brokeringRun as any;

  assert.equal(brokeringRun.routingGroupId, "100051");
  assert.equal(brokeringRun.groupName, "Overnight Priority Orders");
  assert.equal(brokeringRun.productStoreId, "STORE");
}

{
  const { manifest } = createFixture({
    orderRoutingFilterOptions: {
      shipmentMethodTypeId: {
        orderRoutingId: "route-1",
        conditionTypeEnumId: "ENTCT_FILTER",
        fieldName: "shipmentMethodTypeId",
        fieldValue: "STANDARD",
        operator: "equals",
        sequenceNum: 0
      }
    },
    orderRoutingSortOptions: {
      orderDate: {
        orderRoutingId: "route-1",
        conditionTypeEnumId: "ENTCT_SORT_BY",
        fieldName: "orderDate",
        fieldValue: "",
        sequenceNum: 0
      }
    },
    shippingMethods: {
      STANDARD: { description: "Standard shipping" }
    }
  });
  const routeEntity = manifest.visibleEntities.route as any;

  assert.deepEqual(routeEntity.currentOrderFilters, [{
    target: "route.orderFilters.SHIPPING_METHOD",
    label: "Shipping method filter",
    value: "STANDARD",
    valueLabel: "Standard shipping",
    operator: "equals",
    sequenceNum: 0
  }]);
  assert.deepEqual(routeEntity.currentOrderSorts, [{
    target: "route.orderSorts.ORDER_DATE",
    label: "Order date sort",
    sequenceNum: 0
  }]);
}

{
  const rulesInformation = {
    "rule-1": {
      routingRuleId: "rule-1",
      ruleName: "Test",
      statusId: "RULE_ACTIVE",
      assignmentEnumId: "ORA_MULTI",
      sequenceNum: 0,
      inventoryFilters: {
        ENTCT_FILTER: {
          facilityGroupId: {
            routingRuleId: "rule-1",
            conditionTypeEnumId: "ENTCT_FILTER",
            fieldName: "facilityGroupId",
            fieldValue: "FG1",
            operator: "equals",
            sequenceNum: 0
          },
          splitOrderItemGroup: {
            routingRuleId: "rule-1",
            conditionTypeEnumId: "ENTCT_FILTER",
            fieldName: "splitOrderItemGroup",
            fieldValue: "Y",
            operator: "equals",
            sequenceNum: 5
          }
        },
        ENTCT_SORT_BY: {
          distance: {
            routingRuleId: "rule-1",
            conditionTypeEnumId: "ENTCT_SORT_BY",
            fieldName: "distance",
            fieldValue: "",
            sequenceNum: 0
          }
        }
      },
      actions: {
        ORA_NEXT_RULE: {
          routingRuleId: "rule-1",
          actionTypeEnumId: "ORA_NEXT_RULE",
          actionValue: ""
        }
      }
    },
    "rule-2": {
      routingRuleId: "rule-2",
      ruleName: "test2",
      statusId: "RULE_DRAFT",
      assignmentEnumId: "ORA_SINGLE",
      sequenceNum: 5,
      inventoryFilters: {
        ENTCT_FILTER: {
          ignoreFacilityOrderLimit: {
            routingRuleId: "rule-2",
            conditionTypeEnumId: "ENTCT_FILTER",
            fieldName: "ignoreFacilityOrderLimit",
            fieldValue: "N",
            operator: "equals",
            sequenceNum: 0
          }
        },
        ENTCT_SORT_BY: {}
      },
      actions: {
        ORA_MV_TO_QUEUE: {
          routingRuleId: "rule-2",
          actionTypeEnumId: "ORA_MV_TO_QUEUE",
          actionValue: "QUEUE_A"
        }
      }
    }
  };
  const { manifest } = createFixture({
    selectedRoutingRule: {
      ruleName: "Test",
      statusId: "RULE_ACTIVE",
      assignmentEnumId: "ORA_MULTI"
    },
    inventoryRules: [
      { routingRuleId: "rule-1", ruleName: "Test", statusId: "RULE_ACTIVE", assignmentEnumId: "ORA_MULTI", sequenceNum: 0 },
      { routingRuleId: "rule-2", ruleName: "test2", statusId: "RULE_DRAFT", assignmentEnumId: "ORA_SINGLE", sequenceNum: 5 }
    ],
    rulesInformation
  });
  const routeEntity = manifest.visibleEntities.route as any;
  const firstRule = routeEntity.availableInventoryRules[0];
  const secondRule = routeEntity.availableInventoryRules[1];

  assert.equal(firstRule.currentValues.partialAllocation, true);
  assert.equal(firstRule.currentValues.partialGroupedItemAllocation, true);
  assert.deepEqual(firstRule.currentValues.inventoryFilters, [
    {
      target: "selectedRule.inventoryFilters.FACILITY_GROUP",
      label: "Inventory facility group filter",
      value: "FG1",
      valueLabel: "West",
      operator: "equals",
      sequenceNum: 0
    },
    {
      target: "selectedRule.partialGroupItemsAllocation",
      label: "Grouped item partial allocation",
      value: true,
      valueLabel: "Allowed",
      operator: "equals",
      sequenceNum: 5
    }
  ]);
  assert.deepEqual(firstRule.currentValues.inventorySorts, [{
    target: "selectedRule.inventorySorts.PROXIMITY",
    label: "Inventory proximity sort",
    sequenceNum: 0
  }]);
  assert.equal(firstRule.currentValues.unavailableItems.actionTypeEnumId, "ORA_NEXT_RULE");
  assert.equal(firstRule.currentValues.unavailableItems.actionLabel, "Next rule");

  assert.equal(secondRule.currentValues.partialAllocation, false);
  assert.equal(secondRule.currentValues.partialGroupedItemAllocation, false);
  assert.deepEqual(secondRule.currentValues.inventoryFilters, [{
    target: "selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT",
    label: "Facility order limit check",
    value: false,
    valueLabel: "Respect facility order limits",
    operator: "equals",
    sequenceNum: 0
  }]);
  assert.equal(secondRule.currentValues.unavailableItems.actionTypeEnumId, "ORA_MV_TO_QUEUE");
  assert.equal(secondRule.currentValues.unavailableItems.actionLabel, "Queue");
  assert.equal(secondRule.currentValues.unavailableItems.queueId, "QUEUE_A");
  assert.equal(secondRule.currentValues.unavailableItems.queueLabel, "Queue A");
}

{
  const { draft, result } = apply([{ op: "set", target: "route.statusId", value: "ROUTING_ACTIVE" }]);
  assert.equal(result.appliedCount, 1);
  assert.equal(draft.routingStatus.value, "ROUTING_ACTIVE");
}

{
  const { draft, result } = apply([{ op: "set", target: "selectedRule.partialAllocation", value: true }]);
  assert.equal(result.appliedCount, 1);
  assert.equal(draft.selectedRoutingRule.value.assignmentEnumId, "ORA_MULTI");
  assert.equal(draft.inventoryRuleFilterOptions.value.splitOrderItemGroup.fieldValue, "Y");
}

{
  const { draft, result } = apply([{ op: "set", target: "selectedRule.unavailableItemsAction", value: "ORA_NEXT_RULE" }]);
  assert.equal(result.appliedCount, 1);
  assert.equal(draft.ruleActionType.value, "ORA_NEXT_RULE");
  assert.ok(draft.inventoryRuleActions.value.ORA_NEXT_RULE);
  assert.equal(draft.inventoryRuleActions.value.ORA_MV_TO_QUEUE, undefined);
}

{
  const { draft, result } = apply([
    { op: "set", target: "selectedRule.unavailableItemsAction", value: "ORA_MV_TO_QUEUE" },
    { op: "set", target: "selectedRule.unavailableItemsQueueId", value: "QUEUE_B" }
  ]);
  assert.equal(result.appliedCount, 2);
  assert.equal(draft.ruleActionType.value, "ORA_MV_TO_QUEUE");
  assert.equal(draft.inventoryRuleActions.value.ORA_MV_TO_QUEUE.actionValue, "QUEUE_B");
}

{
  const { manifest } = createFixture({ facilities: queueFacilities });
  const queueTarget = manifest.editableTargets.find((target) => target.target === "selectedRule.unavailableItemsQueueId");
  const unfillableParking = queueTarget?.options?.find((option) => option.id === "UNFILLABLE_PARKING");
  const unfillableHoldParking = queueTarget?.options?.find((option) => option.id === "UNFILLABLE_HOLD_PARKING");

  assert.ok(unfillableParking?.aliases?.includes("unfillable queue"));
  assert.equal(unfillableHoldParking?.aliases?.includes("unfillable queue"), false);
}

{
  const { draft, result } = apply(
    [{ op: "set", target: "selectedRule.unavailableItemsQueueId", value: "unfillable queue" }],
    { facilities: queueFacilities }
  );

  assert.equal(result.appliedCount, 1);
  assert.equal(draft.inventoryRuleActions.value.ORA_MV_TO_QUEUE.actionValue, "UNFILLABLE_PARKING");
}

{
  const fixture = createFixture();
  const result = applyDraftOperations([
    {
      op: "set",
      target: "selectedRule.inventoryFilters.FACILITY_GROUP",
      value: "FG1",
      ruleKey: "new:warehouse-first",
      ruleName: "Warehouse first",
      ruleSequence: 10
    } as any,
    {
      op: "set",
      target: "selectedRule.inventorySorts.PROXIMITY",
      value: true,
      ruleKey: "new:stores-fallback",
      ruleName: "Stores fallback",
      ruleSequence: 20
    } as any
  ], fixture.manifest, buildBrokeringRulesBindings(fixture.draft));

  assert.equal(result.appliedCount, 2);
  assert.equal(fixture.draft.selectedRoutingRule.value.routingRuleId, "rule-1");
  assert.ok(fixture.draft.inventoryRules.value.some((rule: any) => rule.routingRuleId === "new:warehouse-first"));
  assert.ok(fixture.draft.inventoryRules.value.some((rule: any) => rule.routingRuleId === "new:stores-fallback"));
  assert.equal(fixture.draft.rulesInformation.value["new:warehouse-first"].inventoryFilters.ENTCT_FILTER.facilityGroupId.fieldValue, "FG1");
  assert.equal(fixture.draft.rulesInformation.value["new:stores-fallback"].inventoryFilters.ENTCT_SORT_BY.distance.fieldName, "distance");
}

{
  const { draft, result } = apply(
    [{ op: "set", target: "route.orderFilters.QUEUE_EXCLUDED", value: ["unfillable queue"] }],
    { facilities: queueFacilities }
  );

  assert.equal(result.appliedCount, 1);
  assert.equal(draft.orderRoutingFilterOptions.value.facilityId_excluded.fieldValue, "UNFILLABLE_PARKING");
}

{
  const { manifest } = createFixture();
  const facilityOrderLimitTarget = manifest.editableTargets.find((target) => target.target === "selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT");
  const respectLimits = facilityOrderLimitTarget?.options?.find((option) => option.id === "false");
  const bypassLimits = facilityOrderLimitTarget?.options?.find((option) => option.id === "true");

  assert.equal(facilityOrderLimitTarget?.label, "Facility order limit check");
  assert.ok(respectLimits?.aliases?.includes("cap store usage"));
  assert.ok(respectLimits?.aliases?.includes("protect stores"));
  assert.ok(bypassLimits?.aliases?.includes("bypass facility order limits"));
}

{
  const { manifest } = createFixture();
  const includeFacilityGroupTarget = manifest.editableTargets.find((target) => target.target === "selectedRule.inventoryFilters.FACILITY_GROUP");
  const excludeFacilityGroupTarget = manifest.editableTargets.find((target) => target.target === "selectedRule.inventoryFilters.FACILITY_GROUP_EXCLUDED");

  assert.equal(includeFacilityGroupTarget?.aliases?.includes("all brokering locations"), false);
  assert.ok(excludeFacilityGroupTarget?.aliases?.includes("all brokering locations except"));
}

{
  const { draft, result } = apply([{ op: "set", target: "selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT", value: "cap store usage" }]);
  assert.equal(result.appliedCount, 1);
  assert.equal(draft.inventoryRuleFilterOptions.value.ignoreFacilityOrderLimit.fieldValue, "N");
  assert.equal(draft.hasUnsavedChanges.value, true);
}

{
  const { draft, result } = apply([{ op: "set", target: "selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT", value: "bypass facility order limits" }]);
  assert.equal(result.appliedCount, 1);
  assert.equal(draft.inventoryRuleFilterOptions.value.ignoreFacilityOrderLimit.fieldValue, "Y");
}

{
  const facilityGroups = {
    FG_PRIORITY_FULFILLMENT: {
      facilityGroupId: "FG_PRIORITY_FULFILLMENT",
      facilityGroupName: "Priority Fulfillment Stores",
      facilityGroupTypeId: "BROKERING_GROUP"
    },
    FG_STANDARD: {
      facilityGroupId: "FG_STANDARD",
      facilityGroupName: "Standard Stores",
      facilityGroupTypeId: "BROKERING_GROUP"
    }
  };
  const { manifest } = createFixture({
    facilityGroups,
    brokeringFacilityGroups: facilityGroups
  });
  const facilityGroupTarget = manifest.editableTargets.find((target) => target.target === "selectedRule.inventoryFilters.FACILITY_GROUP");
  const priorityOption = facilityGroupTarget?.options?.find((option) => option.id === "FG_PRIORITY_FULFILLMENT");

  assert.ok(priorityOption?.aliases?.includes("priority fulfillment group"));
}

{
  const facilityGroups = {
    FG_PRIORITY_FULFILLMENT: {
      facilityGroupId: "FG_PRIORITY_FULFILLMENT",
      facilityGroupName: "Priority Fulfillment Stores",
      facilityGroupTypeId: "BROKERING_GROUP"
    },
    FG_STANDARD: {
      facilityGroupId: "FG_STANDARD",
      facilityGroupName: "Standard Stores",
      facilityGroupTypeId: "BROKERING_GROUP"
    }
  };
  const { draft, result } = apply(
    [{ op: "set", target: "selectedRule.inventoryFilters.FACILITY_GROUP", value: "priority fulfillment group" }],
    {
      facilityGroups,
      brokeringFacilityGroups: facilityGroups
    }
  );

  assert.equal(result.appliedCount, 1);
  assert.equal(draft.inventoryRuleFilterOptions.value.facilityGroupId.fieldValue, "FG_PRIORITY_FULFILLMENT");
}

{
  const { draft, result } = apply([{ op: "set", target: "selectedRule.statusId", value: "RULE_DELETED" }]);
  assert.equal(result.appliedCount, 0);
  assert.equal(draft.selectedRoutingRule.value.statusId, "RULE_DRAFT");
  assert.equal(draft.hasUnsavedChanges.value, false);
  assert.equal(result.unansweredQuestions.length, 1);
}

{
  const promiseDateFilter = {
    promiseDaysCutoff: {
      orderRoutingId: "route-1",
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: "promiseDaysCutoff",
      fieldValue: 3
    }
  };
  const { draft, result } = apply(
    [{ op: "set", target: "selectedRule.partialAllocation", value: false }],
    {
      selectedRoutingRule: { assignmentEnumId: "ORA_MULTI" },
      orderRoutingFilterOptions: promiseDateFilter
    }
  );
  assert.equal(result.appliedCount, 0);
  assert.equal(draft.selectedRoutingRule.value.assignmentEnumId, "ORA_MULTI");
  assert.equal(draft.hasUnsavedChanges.value, false);
  assert.equal(result.unansweredQuestions.length, 1);
}

console.log("Brokering rules draft target tests passed");
