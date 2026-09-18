import { describe, expect, it, vi } from "vitest";
import type { DraftProposal, PageCapabilityManifest } from "../src/types/draft";
import {
  applyDraftProposal,
  convertBrokeringRouteDraftToOperations,
  createDraftOutputContract,
  createDraftProposal,
  validateDraftOperations
} from "../src/utils/draftUtils";

function variationManifest(): PageCapabilityManifest {
  return {
    pageId: "order-routing.rules",
    route: "/tabs/circuit/VM100005_100008",
    context: {
      mode: "variation",
      variationId: "VM100005",
      routingGroupId: "M100255"
    },
    visibleEntities: {
      route: { orderRoutingId: "VM100005_100008" },
      selectedRule: { routingRuleId: "VM100005_100524" }
    },
    editableTargets: [
      { target: "route.statusId", label: "Route status", valueType: "enum", currentValue: "ROUTING_DRAFT", options: [{ id: "ROUTING_ACTIVE", label: "Active" }, { id: "ROUTING_DRAFT", label: "Draft" }], editable: true },
      { target: "selectedRule.statusId", label: "Rule status", valueType: "enum", currentValue: "RULE_DRAFT", options: [{ id: "RULE_ACTIVE", label: "Active" }, { id: "RULE_DRAFT", label: "Draft" }], editable: true },
      { target: "selectedRule.partialAllocation", label: "Partial allocation", valueType: "boolean", currentValue: false, editable: true },
      { target: "routingGroup.statusId", label: "Group status", valueType: "string", currentValue: "ACTIVE", editable: true }
    ],
    outputContract: createDraftOutputContract()
  };
}

function providerDraft() {
  return {
    schemaVersion: "brokering-route-draft.v1" as const,
    applyMode: "merge" as const,
    targetRouting: { action: "create" as const, routingKey: "new:copy", name: "Copy" },
    route: {
      statusId: "ROUTING_ACTIVE" as const,
      orderSelection: {
        filters: {
          queues: { include: [], exclude: [] },
          shippingMethods: { include: [], exclude: [] },
          priorities: { include: [], exclude: [] },
          promiseDateDays: { max: null, excludeMax: null },
          salesChannels: { include: [], exclude: [] },
          originFacilityGroups: { include: [], exclude: [] }
        },
        sorts: []
      },
      inventoryRules: []
    },
    questions: [],
    summary: "Activate and clone the route"
  };
}

describe("variation assistant contract", () => {
  it("keeps supported route edits while removing a provider-requested sibling routing", () => {
    const operations = convertBrokeringRouteDraftToOperations(providerDraft(), variationManifest());

    expect(operations.targetRouting).toBeUndefined();
    expect(operations.operations).toContainEqual({ op: "set", target: "route.statusId", value: "ROUTING_ACTIVE" });
    expect(operations.unansweredQuestions).toContain("Creating or cloning a routing is unavailable while editing a simulation variation.");
  });

  it("never surfaces a new routing proposal in variation mode", () => {
    const proposal = createDraftProposal({
      operations: [{ op: "set", target: "selectedRule.partialAllocation", value: true }],
      unansweredQuestions: [],
      summary: "Update and clone",
      intent: "edit",
      targetRouting: { action: "create", routingKey: "new:copy", name: "Copy" }
    }, variationManifest());

    expect(proposal.newRouting).toBeUndefined();
    expect(proposal.operations).toEqual([{ op: "set", target: "selectedRule.partialAllocation", value: true }]);
    expect(proposal.unansweredQuestions).toContain("Creating or cloning a routing is unavailable while editing a simulation variation.");
  });

  it.each(["brokeringRun.schedule", "routingGroup.statusId", "group.runNow", "cloneRouting", "route.clone"])(
    "rejects live-only target %s with a variation-specific reason",
    (target) => {
      const result = validateDraftOperations([{ op: "set", target, value: "x" }], variationManifest());
      expect(result.operations).toEqual([]);
      expect(result.unansweredQuestions[0]).toContain("unavailable while editing a simulation variation");
    }
  );

  it("defensively refuses to apply a prebuilt new-routing proposal", async () => {
    const createSiblingRouting = vi.fn(async () => "SHOULD_NOT_EXIST");
    const proposal: DraftProposal = {
      operations: [], unansweredQuestions: [], summary: "", providerSummary: "",
      newRouting: { routingKey: "new:copy", name: "Copy" }
    };

    const result = await applyDraftProposal(proposal, variationManifest(), {
      createSiblingRouting,
      selectRouting: vi.fn(),
      buildBindings: () => ({})
    });

    expect(createSiblingRouting).not.toHaveBeenCalled();
    expect(result.appliedCount).toBe(0);
    expect(result.skipped[0]).toContain("unavailable while editing a simulation variation");
  });
});
