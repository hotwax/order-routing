import { toConfigPayload, fromVariationRoutings, isEquivalentVariationConfig } from "../src/utils/variationUtils";
import { buildVariationConfigDiff } from "../src/utils/variationConfigDiff";
import { describe, expect, it, vi } from "vitest";
import { getRoutingSortDirection, normalizeRoutingSort } from "../src/utils/routingSort";
import { buildRoutingGroupSavePayload } from "../src/utils/routingGroupEditorPayload";
import { buildCircuitProposalContextCards } from "../src/utils/circuitProposalContext";
import { validateDraftOperations, createDraftOutputContract } from "../src/utils/draftUtils";

const condition = (fieldName: string, sortDirection?: "asc" | "desc") => ({
  fieldName, conditionTypeEnumId: "ENTCT_SORT_BY", conditionSeqId: "001", sequenceNum: 7,
  ...(sortDirection ? { sortDirection } : {})
});

describe("routing sort direction", () => {
  it.each(["asc", "desc"] as const)("round-trips explicit %s through both save payloads and loading", direction => {
    const source = { routings: [{ orderFilters: [condition("orderDate", direction)], rules: [{ inventoryFilters: [condition("inventoryForAllocation", direction)] }] }] };
    const payload = buildRoutingGroupSavePayload(source, '["orderDate desc", "inventoryForAllocation desc"]');
    for (const item of [payload.routings[0].orderFilters[0], payload.routings[0].rules[0].inventoryFilters[0]]) {
      expect(item.fieldName.endsWith(" desc")).toBe(direction === "desc");
      expect(item).not.toHaveProperty("sortDirection");
      expect(item.conditionSeqId).toBe("001");
      expect(item.sequenceNum).toBe(7);
      expect(normalizeRoutingSort(item).sortDirection).toBe(direction);
    }
    expect(source.routings[0].orderFilters[0].fieldName).toBe("orderDate");
    expect(source.routings[0].orderFilters[0].sortDirection).toBe(direction);
  });

  it("preserves direction in simulation payloads and detects direction-only differences", () => {
    const raw = [{ orderRoutingId: "R1", routingName: "Route", orderFilters: [condition("orderDate desc")], rules: [{ routingRuleId: "RR1", ruleName: "Rule", inventoryFilters: [condition("distance desc")] }] }];
    const normalized = fromVariationRoutings(raw);
    const payload = toConfigPayload(normalized);
    expect(payload[0].orderFilters[0].fieldName).toBe("orderDate desc");
    expect(payload[0].rules[0].inventoryFilters[0].fieldName).toBe("distance desc");
    const before = { routings: normalized };
    const after = structuredClone(before);
    after.routings[0].rules[0].inventoryFilters[0].sortDirection = "asc";
    expect(isEquivalentVariationConfig(before, after)).toBe(false);
    const diff = buildVariationConfigDiff(before, after);
    expect(diff.sections.flatMap(section => section.rows)).toContainEqual(expect.objectContaining({ kind: "changed", before: "Descending", after: "Ascending" }));
  });

  it("uses the editor default for a manually added variation sort", () => {
    vi.stubEnv("VITE_FILTER_SORT_DESC", '["inventoryForAllocation desc"]');
    try {
      const payload = toConfigPayload([{ orderFilters: [], rules: [{ inventoryFilters: [condition("inventoryForAllocation")] }] }]);
      expect(payload[0].rules[0].inventoryFilters[0].fieldName).toBe("inventoryForAllocation desc");
      const before = { routings: [{ routingName: "Route", rules: [{ ruleName: "Rule", inventoryFilters: [condition("inventoryForAllocation", "asc")] }] }] };
      const after = structuredClone(before);
      delete after.routings[0].rules[0].inventoryFilters[0].sortDirection;
      expect(buildVariationConfigDiff(before, after).sections.flatMap(section => section.rows)).toContainEqual(expect.objectContaining({ before: "Ascending", after: "Descending" }));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps allocation dependencies scoped to the rule being changed", () => {
    const manifest: any = {
      visibleEntities: { route: { availableInventoryRules: ["A", "B"].map(routingRuleId => ({ routingRuleId, currentValues: { partialAllocation: true, partialGroupedItemAllocation: true } })) } },
      editableTargets: [
        { target: "selectedRule.partialAllocation", label: "Partial", valueType: "boolean", currentValue: true, editable: true },
        { target: "selectedRule.partialGroupItemsAllocation", label: "Grouped", valueType: "boolean", currentValue: true, editable: true, dependencies: [{ target: "selectedRule.partialAllocation", values: [true] }] }
      ], outputContract: createDraftOutputContract()
    };
    const result = validateDraftOperations([
      { op: "set", target: "selectedRule.partialAllocation", value: false, ruleKey: "A" },
      { op: "set", target: "selectedRule.partialGroupItemsAllocation", value: false, ruleKey: "B" }
    ], manifest);
    expect(result.operations).toHaveLength(2);
    expect(result.unansweredQuestions).toEqual([]);
  });

  it("preserves persisted directions when they differ from the defaults", () => {
    const ascending = normalizeRoutingSort(condition("inventoryForAllocation"));
    const descending = normalizeRoutingSort(condition("distance DESC"));
    expect(getRoutingSortDirection(ascending, '["inventoryForAllocation desc"]')).toBe("asc");
    expect(descending).toMatchObject({ fieldName: "distance", sortDirection: "desc" });
    expect(normalizeRoutingSort(descending)).toEqual(descending);
  });

  it("keeps default direction for manually added sorts without an explicit direction", () => {
    expect(getRoutingSortDirection(condition("inventoryForAllocation"), '["inventoryForAllocation desc"]')).toBe("desc");
    expect(getRoutingSortDirection(condition("distance"), '["inventoryForAllocation desc"]')).toBe("asc");
  });

  it.each(["asc", "desc"] as const)("shows %s in the proposal card", sortDirection => {
    const cards = buildCircuitProposalContextCards({ operations: [{ op: "set", target: "route.orderSorts.ORDER_DATE", value: true, sortDirection }] });
    expect(cards[0].items[0].value).toBe(sortDirection === "asc" ? "Ascending" : "Descending");
  });

  it("rejects invalid direction metadata and direction on a non-sort operation", () => {
    const manifest: any = { editableTargets: [
      { target: "route.orderSorts.ORDER_DATE", label: "Order date", valueType: "boolean", editable: true },
      { target: "selectedRule.partialAllocation", label: "Partial allocation", valueType: "boolean", editable: true }
    ], outputContract: createDraftOutputContract() };
    const result = validateDraftOperations([
      { op: "set", target: "route.orderSorts.ORDER_DATE", value: true, sortDirection: "sideways" as any },
      { op: "set", target: "selectedRule.partialAllocation", value: true, sortDirection: "asc" },
      { op: "set", target: "route.orderSorts.ORDER_DATE", value: false, sortDirection: "asc" }
    ], manifest);
    expect(result.operations).toEqual([]);
    expect(result.unansweredQuestions).toHaveLength(3);
  });
});
