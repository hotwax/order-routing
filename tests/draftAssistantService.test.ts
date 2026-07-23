import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.fn();

vi.mock("@common", () => ({
  client: (...args: any[]) => client(...args),
  commonUtil: {
    getMaargURL: () => "https://oms.example/rest/s1/",
    getOmsURL: () => "",
    getToken: () => "token",
  },
}));
vi.mock("@/utils/simConfig", () => ({ mastraUrl: () => "https://circuit.example" }));

import { requestBrokeringRouteDraftOperations } from "@/services/DraftAssistantService";
import {
  applyDraftOperations,
  applyDraftProposal,
  createDraftOutputContract,
  createDraftProposal,
  validateDraftOperations,
} from "@/utils/draftUtils";
import type { DraftProposal, PageCapabilityManifest } from "@/types/draft";

const manifest = (): PageCapabilityManifest => ({
  pageId: "order-routing.rules",
  route: "/tabs/circuit",
  visibleEntities: {},
  editableTargets: [
    {
      target: "route.statusId",
      label: "Route status",
      valueType: "enum",
      currentValue: "ROUTING_DRAFT",
      options: [
        { id: "ROUTING_DRAFT", label: "Draft" },
        { id: "ROUTING_ACTIVE", label: "Active", aliases: ["activate"] },
      ],
      editable: true,
    },
    {
      target: "selectedRule.partialAllocation",
      label: "Partial allocation",
      valueType: "boolean",
      currentValue: false,
      editable: true,
    },
  ],
  outputContract: createDraftOutputContract(),
});

describe("draft validation and application", () => {
  it("normalizes supported values and rejects targets the page does not expose", () => {
    const result = validateDraftOperations([
      { op: "set", target: "route.statusId", value: "activate" },
      { op: "set", target: "route.unknown", value: "x" },
    ], manifest());

    expect(result.operations).toEqual([{ op: "set", target: "route.statusId", value: "ROUTING_ACTIVE" }]);
    expect(result.unansweredQuestions).toEqual(["The target 'route.unknown' is not available on this page."]);
  });

  it("mutates only registered local bindings", () => {
    let status = "ROUTING_DRAFT";
    const result = applyDraftOperations([
      { op: "set", target: "route.statusId", value: "ROUTING_ACTIVE" },
      { op: "set", target: "selectedRule.partialAllocation", value: true },
    ], manifest(), {
      "route.statusId": {
        target: "route.statusId",
        setValue: (value) => { status = String(value); },
      },
    });

    expect(status).toBe("ROUTING_ACTIVE");
    expect(result.appliedCount).toBe(1);
    expect(result.skipped).toEqual([
      "Skipped selectedRule.partialAllocation; no local draft binding is registered.",
    ]);
  });

  it("creates and selects a sibling routing before applying its operations", async () => {
    const calls: string[] = [];
    const proposal: DraftProposal = {
      operations: [],
      unansweredQuestions: [],
      summary: "Create West Coast",
      providerSummary: "Create West Coast",
      newRouting: { routingKey: "new:west", name: "West Coast" },
    };

    await applyDraftProposal(proposal, manifest(), {
      createSiblingRouting: async (name) => { calls.push(`create:${name}`); return "ROUTING_NEW"; },
      selectRouting: (id) => { calls.push(`select:${id}`); },
      buildBindings: () => { calls.push("bind"); return {}; },
    });

    expect(calls).toEqual(["create:West Coast", "select:ROUTING_NEW", "bind"]);
  });

  it("keeps the provider summary secondary to the validated user-visible change", () => {
    const proposal = createDraftProposal({
      operations: [{ op: "set", target: "route.statusId", value: "activate" }],
      unansweredQuestions: [],
      summary: "Changed several things",
    }, manifest());

    expect(proposal.operations).toHaveLength(1);
    expect(proposal.summary).toBe("Route status: Active");
    expect(proposal.providerSummary).toBe("Changed several things");
  });
});

describe("draft assistant request", () => {
  beforeEach(() => client.mockReset());

  it("passes conversation context and maps an inquiry without manufacturing edits", async () => {
    client.mockResolvedValue({
      data: {
        schemaVersion: "brokering-route-assistant.v1",
        intent: "inquiry",
        message: "This routing brokers warehouse inventory first.",
        questions: ["Which rule should I inspect?"],
      },
    });
    const history = [{ role: "user" as const, content: "Explain this route" }];

    await expect(requestBrokeringRouteDraftOperations("What does it do?", manifest(), { conversationHistory: history }))
      .resolves.toEqual({
        operations: [],
        unansweredQuestions: ["Which rule should I inspect?"],
        summary: "This routing brokers warehouse inventory first.",
        intent: "inquiry",
      });

    expect(client).toHaveBeenCalledWith(expect.objectContaining({
      url: "/brokering-route-assistant",
      baseURL: "https://circuit.example",
      data: expect.objectContaining({
        prompt: "What does it do?",
        conversationHistory: history,
        omsBaseUrl: "https://oms.example/rest/s1/",
        authToken: "token",
      }),
    }));
  });
});
