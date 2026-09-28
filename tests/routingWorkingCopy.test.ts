import { describe, expect, it } from "vitest";
import {
  activeRoutingNavigationOperation,
  applyPendingRoutingInlineEdits,
  applyRoutingProposalPreview,
  canonicalRoutingEditorRoute,
  isRoutingRecordRoute,
  prepareRoutingGroupSaveCommit,
  projectRuleForEditor,
  replaceWorkingEntry,
  routingEditorReferenceMaps,
  routingEditorCodeLabel,
  routingGroupScheduleWorkingCopy,
  routingWorkingKey,
  ruleWorkingKey,
  settleRoutingEditorDiscard,
  serializeRoutingWorkingCopy,
  serializeRuleWorkingCopy,
  updateRoutingFilterCondition,
  updateRuleFilterCondition
} from "../src/utils/routingWorkingCopy";

describe("routing working-copy projections", () => {
  it("shows readable sandbox labels without consulting live OMS references", () => {
    expect(routingEditorCodeLabel("ROUTING_ACTIVE")).toBe("Active");
    expect(routingEditorCodeLabel("deliveryDays")).toBe("Delivery Days");
    expect(routingEditorCodeLabel("facilitySequence")).toBe("Facility Sequence");
    expect(routingEditorCodeLabel("salesVelocity")).toBe("Sales Velocity");
  });

  it("uses only simulation-scoped editor references in sandbox mode", () => {
    const simulation = {
      facilities: { SIM_F: { facilityId: "SIM_F" } },
      facilityGroups: { SIM_G: { facilityGroupId: "SIM_G" } },
      shippingMethods: { SIM_S: { shipmentMethodTypeId: "SIM_S" } },
      salesChannels: { SIM_C: { enumId: "SIM_C" } }
    };
    const live = {
      facilities: { OMS_F: { facilityId: "OMS_F" } },
      facilityGroups: { OMS_G: { facilityGroupId: "OMS_G" } },
      shippingMethods: { OMS_S: { shipmentMethodTypeId: "OMS_S" } },
      salesChannels: { OMS_C: { enumId: "OMS_C" } },
      catalogCategories: { OMS_CAT: { productCategoryId: "OMS_CAT" } }
    };

    expect(routingEditorReferenceMaps(true, simulation, live)).toEqual({
      ...simulation,
      catalogCategories: {}
    });
    expect(routingEditorReferenceMaps(false, simulation, live)).toBe(live);
  });

  it("locks navigation for variation saves and simulation runs", () => {
    expect(activeRoutingNavigationOperation({
      isSavingEditor: false,
      isApplyingCircuit: false,
      isSavingVariation: true,
      isRunningSimulation: false
    })).toBe("variation-save");
    expect(activeRoutingNavigationOperation({
      isSavingEditor: false,
      isApplyingCircuit: false,
      isSavingVariation: false,
      isRunningSimulation: true
    })).toBe("simulation-run");
    expect(activeRoutingNavigationOperation({
      isSavingEditor: true,
      isApplyingCircuit: false,
      isSavingVariation: true,
      isRunningSimulation: true
    })).toBe("editor-save");
  });

  it("republishes clean state after queued discard rebind updates try to mark it dirty", async () => {
    let description = "Edited";
    let editorDirty = true;
    let persistedDirty = true;

    await settleRoutingEditorDiscard(
      () => { description = "Saved"; },
      () => {
        editorDirty = false;
        persistedDirty = false;
      },
      async () => {
        // Models a queued Ionic change event caused by programmatic value rebinding.
        await Promise.resolve();
        editorDirty = true;
        persistedDirty = true;
      }
    );

    expect(description).toBe("Saved");
    expect(editorDirty).toBe(false);
    expect(persistedDirty).toBe(false);
  });

  it("rolls back a partially applied Circuit preview and rejects before the host publishes it", async () => {
    const proposal = { id: "P1" };
    let workingState = "manual";
    let hasRollbackSnapshot = false;
    let hostPendingProposal: any = null;

    const preview = async () => {
      await applyRoutingProposalPreview(
        () => { hasRollbackSnapshot = true; },
        async () => {
          workingState = "partial mutation";
          throw new Error("apply failed");
        },
        () => {
          workingState = "manual";
          hasRollbackSnapshot = false;
        }
      );
      // Mirrors RoutingDetailCanvas: the host publishes only after preview resolves.
      hostPendingProposal = proposal;
    };

    await expect(preview()).rejects.toThrow("apply failed");
    expect(workingState).toBe("manual");
    expect(hasRollbackSnapshot).toBe(false);
    expect(hostPendingProposal).toBeNull();
  });

  it("clears scheduler state when the visible group has no schedule", () => {
    const scheduled = routingGroupScheduleWorkingCopy({
      schedule: { jobName: "JOB1", cronExpression: "0 0 0 * * ?" }
    });
    const unscheduled = routingGroupScheduleWorkingCopy({ routingGroupId: "G2" });

    expect(scheduled).toEqual({ jobName: "JOB1", cronExpression: "0 0 0 * * ?" });
    expect(unscheduled).toEqual({});
  });

  it("flushes every pending inline label before the header Save serializes the group", () => {
    const group = { groupName: "Before", description: "Old" };
    const route = { orderRoutingId: "R1", routingName: "Old route" };
    const rawRule = { routingRuleId: "RR1", ruleName: "Old rule" };
    const activeRule = { ...rawRule, ruleName: "  New rule  " };

    expect(applyPendingRoutingInlineEdits({
      group,
      activeRouting: route,
      activeRule,
      inventoryRules: [rawRule],
      editing: { groupName: true, description: true, routeName: true, ruleName: true },
      values: {
        groupName: "  New group  ",
        description: "",
        routeName: "  New route  ",
        ruleName: activeRule.ruleName
      }
    })).toBe(true);

    expect(group).toEqual({ groupName: "New group", description: "" });
    expect(route.routingName).toBe("New route");
    expect(activeRule.ruleName).toBe("New rule");
    expect(rawRule.ruleName).toBe("Old rule");
  });

  it("includes a pending rule rename in the serialized variation working copy", () => {
    const rawRule = {
      routingRuleId: "RR1",
      ruleName: "Old rule",
      inventoryFilters: [],
      actions: []
    };
    const activeRule = projectRuleForEditor(rawRule);

    applyPendingRoutingInlineEdits({
      group: {},
      activeRule,
      inventoryRules: [rawRule],
      editing: { ruleName: true },
      values: { ruleName: "UAT renamed rule" }
    });
    const serializedRule = serializeRuleWorkingCopy(
      activeRule,
      activeRule.inventoryFilters.ENTCT_FILTER,
      activeRule.inventoryFilters.ENTCT_SORT_BY,
      activeRule.actions
    );
    const serializedRouting = serializeRoutingWorkingCopy(
      { orderRoutingId: "R1" },
      {},
      {},
      [serializedRule]
    );

    expect(serializedRouting.rules[0].ruleName).toBe("UAT renamed rule");
  });

  it("does not replace required names with blank pending input", () => {
    const group = { groupName: "Group", description: "Description" };
    const route = { orderRoutingId: "R1", routingName: "Route" };
    const rawRule = { routingRuleId: "RR1", ruleName: "Rule" };
    const activeRule = { ...rawRule, ruleName: "" };

    expect(applyPendingRoutingInlineEdits({
      group,
      activeRouting: route,
      activeRule,
      inventoryRules: [rawRule],
      editing: { groupName: true, routeName: true, ruleName: true },
      values: { groupName: " ", routeName: " ", ruleName: " " }
    })).toBe(false);

    expect(group.groupName).toBe("Group");
    expect(route.routingName).toBe("Route");
    expect(rawRule.ruleName).toBe("Rule");
  });

  it("uses the canonical consolidated routing-detail URL", () => {
    expect(canonicalRoutingEditorRoute("GROUP-1")).toBe("/order-routing/GROUP-1");
    expect(isRoutingRecordRoute("/order-routing/GROUP-1")).toBe(true);
    expect(isRoutingRecordRoute("/order-routing/GROUP-1/test")).toBe(true);
    expect(isRoutingRecordRoute("/order-routing")).toBe(false);
  });

  it("publishes a clean state before first-save canonical navigation", () => {
    let dirty = true;
    const replacement = prepareRoutingGroupSaveCommit("temp-group", "GROUP-1", () => {
      dirty = false;
    });

    // This models the parent route guard evaluating the state as router.replace begins.
    const wouldPrompt = dirty;
    expect(wouldPrompt).toBe(false);
    expect(replacement).toBe("/order-routing/GROUP-1");
  });

  it("round-trips a raw rule through editor maps without mutating the raw value", () => {
    const raw = {
      routingRuleId: "rule-1",
      ruleName: "Nearest",
      inventoryFilters: [
        { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", fieldValue: "A" },
        { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "distance", sequenceNum: 10 }
      ],
      actions: [{ actionTypeEnumId: "ORA_NEXT_RULE", actionValue: "", actionSeqId: 1 }]
    };

    const projection = projectRuleForEditor(raw);
    projection.inventoryFilters.ENTCT_FILTER.facilityGroupId.fieldValue = "B";
    const serialized = serializeRuleWorkingCopy(
      projection,
      projection.inventoryFilters.ENTCT_FILTER,
      projection.inventoryFilters.ENTCT_SORT_BY,
      projection.actions
    );

    expect(raw.inventoryFilters[0].fieldValue).toBe("A");
    expect(serialized.inventoryFilters).toEqual([
      { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", fieldValue: "B" },
      { conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "distance", sequenceNum: 10 }
    ]);
    expect(serialized.actions).toEqual([
      { actionTypeEnumId: "ORA_NEXT_RULE", actionValue: "", actionSeqId: 1 }
    ]);
  });

  it("serializes the active routing and replaces it by stable key", () => {
    const first = { orderRoutingId: "route-1", routingName: "First", orderFilters: [], rules: [] };
    const second = { orderRoutingId: "route-2", routingName: "Second", orderFilters: [], rules: [] };
    const rule = { _tempId: "temp-rule-1", ruleName: "Draft" };
    const next = serializeRoutingWorkingCopy(first, {
      queue: { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "queue", fieldValue: "Q" }
    }, {}, [rule]);
    const entries = replaceWorkingEntry([first, second], next, routingWorkingKey);

    expect(entries).toHaveLength(2);
    expect(entries[0].orderFilters).toHaveLength(1);
    expect(ruleWorkingKey(entries[0].rules[0])).toBe("temp-rule-1");
    expect(entries[1]).toBe(second);
  });

  it("updates multi-select filters under their canonical backend field without duplicate rows", () => {
    const filters = {
      facilityId: {
        conditionSeqId: "01",
        conditionTypeEnumId: "ENTCT_FILTER",
        fieldName: "facilityId",
        fieldValue: "QUEUE_A",
        operator: "equals"
      },
      QUEUE: {
        conditionTypeEnumId: "ENTCT_FILTER",
        fieldName: "QUEUE",
        fieldValue: "STALE_QUEUE"
      }
    };

    const updated = updateRoutingFilterCondition(
      filters,
      { QUEUE: { code: "facilityId" } },
      "QUEUE",
      ["QUEUE_A", "QUEUE_B"],
      true
    );

    expect(Object.keys(updated)).toEqual(["facilityId"]);
    expect(updated.facilityId).toEqual({
      ...filters.facilityId,
      fieldValue: "QUEUE_A,QUEUE_B",
      operator: "in"
    });
    expect(filters.facilityId.fieldValue).toBe("QUEUE_A");
  });

  it("creates new multi-select filters with the field code used by save serialization", () => {
    const updated = updateRoutingFilterCondition(
      {},
      { SHIPPING_METHOD: { code: "shipmentMethodTypeId" } },
      "SHIPPING_METHOD",
      ["STANDARD", "STORE_PICKUP"],
      true
    );

    expect(updated).toEqual({
      shipmentMethodTypeId: {
        conditionTypeEnumId: "ENTCT_FILTER",
        fieldName: "shipmentMethodTypeId",
        fieldValue: "STANDARD,STORE_PICKUP",
        operator: "in",
        sequenceNum: 1
      }
    });
    expect(serializeRoutingWorkingCopy({ orderFilters: [], rules: [] }, updated, {}, []).orderFilters)
      .toEqual([updated.shipmentMethodTypeId]);
  });

  it("keeps a chosen rule-filter operator and fills missing ones from the control default", () => {
    // Rows added from the inventory filter modal carry an empty operator.
    let filters: Record<string, any> = {
      brokeringSafetyStock: { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "brokeringSafetyStock", operator: "", sequenceNum: 0 },
      facilityGroupId: { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityGroupId", operator: "", sequenceNum: 5 }
    };

    filters = updateRuleFilterCondition(filters, "brokeringSafetyStock", "5", "greater");
    expect(filters.brokeringSafetyStock).toMatchObject({ fieldValue: "5", operator: "greater" });
    // The user switches the operator, then edits the value: the choice must survive.
    filters.brokeringSafetyStock.operator = "greater-equals";
    filters = updateRuleFilterCondition(filters, "brokeringSafetyStock", "7", "greater");
    expect(filters.brokeringSafetyStock).toMatchObject({ fieldValue: "7", operator: "greater-equals" });

    filters = updateRuleFilterCondition(filters, "facilityGroupId", "GROUP_A");
    expect(filters.facilityGroupId.operator).toBe("equals");

    filters = updateRuleFilterCondition(filters, "facilityGroupId_excluded", "GROUP_B");
    expect(filters.facilityGroupId_excluded).toMatchObject({ fieldValue: "GROUP_B", operator: "not-equals" });

    filters = updateRuleFilterCondition(filters, "distance", "50", "less-equals");
    expect(filters.distance.operator).toBe("less-equals");
  });

  it("derives the operator from the selection count and exclusion on every value change", () => {
    const enums = {
      QUEUE: { code: "facilityId" },
      QUEUE_EXCLUDED: { code: "facilityId_excluded" },
      PRIORITY_EXCLUDED: { code: "priority_excluded" }
    };
    // Rows added from the filter modal have no operator until a value is chosen.
    let filters: Record<string, any> = {
      facilityId: { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityId", sequenceNum: 0 },
      facilityId_excluded: { conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityId_excluded", sequenceNum: 5 }
    };

    filters = updateRoutingFilterCondition(filters, enums, "QUEUE", ["Q1"], true);
    expect(filters.facilityId.operator).toBe("equals");
    filters = updateRoutingFilterCondition(filters, enums, "QUEUE", ["Q1", "Q2"], true);
    expect(filters.facilityId.operator).toBe("in");
    filters = updateRoutingFilterCondition(filters, enums, "QUEUE", ["Q2"], true);
    expect(filters.facilityId.operator).toBe("equals");

    filters = updateRoutingFilterCondition(filters, enums, "QUEUE_EXCLUDED", ["Q3"], true);
    expect(filters.facilityId_excluded.operator).toBe("not-equals");
    filters = updateRoutingFilterCondition(filters, enums, "QUEUE_EXCLUDED", ["Q3", "Q4"], true);
    expect(filters.facilityId_excluded.operator).toBe("not-in");

    filters = updateRoutingFilterCondition(filters, enums, "PRIORITY_EXCLUDED", "2");
    expect(filters.priority_excluded.operator).toBe("not-equals");
  });
});
