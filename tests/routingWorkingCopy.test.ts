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
  serializeRuleWorkingCopy
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
});
