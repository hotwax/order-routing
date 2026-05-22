import assert from "assert";
import {
  generateBrokeringRouteAssistantResponse
} from "../mastra/brokeringRouteAssistantRouting";
import type { PageCapabilityManifest } from "../mastra/pageCapabilitySchema";

const manifest: PageCapabilityManifest = {
  pageId: "order-routing.rules",
  route: "/tabs/circuit",
  visibleEntities: {
    brokeringRun: {
      routingGroupId: "100051",
      groupName: "Overnight Priority Orders",
      productStoreId: "STORE"
    },
    route: {
      orderRoutingId: "ROUTE_1",
      routingName: "Warehouse first",
      statusId: "ROUTING_DRAFT",
      availableInventoryRules: [
        { routingRuleId: "RULE_1", ruleName: "Warehouses", statusId: "RULE_ACTIVE", sequenceNum: 10 },
        { routingRuleId: "RULE_2", ruleName: "Stores fallback", statusId: "RULE_DRAFT", sequenceNum: 20 }
      ]
    },
    selectedRule: {
      routingRuleId: "RULE_1",
      ruleName: "Warehouses",
      statusId: "RULE_ACTIVE",
      activeInventoryFilterTargets: ["selectedRule.inventoryFilters.FACILITY_GROUP"]
    }
  },
  editableTargets: [],
  outputContract: {
    operations: ["set"],
    operationShape: {},
    responseShape: {}
  }
};

const emptyDraft = {
  schemaVersion: "brokering-route-draft.v1" as const,
  applyMode: "merge" as const,
  route: {
    statusId: "ROUTING_DRAFT" as const,
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
  summary: "No draft changes applied"
};

(async () => {
  // generateBrokeringRouteAssistantResponse — inquiry path dispatches to the
  // injected classifyIntent callback, which returns "inquiry".
  {
    let inquiryCalls = 0;
    let draftCalls = 0;
    let inquiryPayload: any = null;

    const response = await generateBrokeringRouteAssistantResponse({
      prompt: "What does this route do?",
      conversationHistory: [],
      orderRoutingDomainKnowledge: "domain knowledge",
      pageCapabilityManifest: manifest,
      outputContract: manifest.outputContract,
      classifyIntent: async () => ({ intent: "inquiry", reasoning: "broad question" }),
      generateInquiry: async (payload) => {
        inquiryCalls += 1;
        inquiryPayload = payload;
        return {
          answer: "This route brokers orders to warehouses before stores.",
          questions: [],
          summary: "Explained current routing."
        };
      },
      generateDraft: async () => {
        draftCalls += 1;
        return emptyDraft;
      }
    });

    assert.equal(response.intent, "inquiry");
    assert.equal(response.message, "This route brokers orders to warehouses before stores.");
    assert.equal(inquiryCalls, 1);
    assert.equal(draftCalls, 0);
    assert.equal(inquiryPayload.pageCapabilityManifest.visibleEntities.brokeringRun.groupName, "Overnight Priority Orders");
    assert.equal(inquiryPayload.pageCapabilityManifest.visibleEntities.route.routingName, "Warehouse first");
    assert.equal(inquiryPayload.inquiryGuidance.detailLevel, "broad_overview");
    assert.equal(inquiryPayload.inquiryGuidance.maxSentences, 4);
    assert.ok(inquiryPayload.inquiryGuidance.answerStyle.includes("under 90 words"));
    assert.ok(inquiryPayload.inquiryGuidance.focusAreas.includes("schedule"));
    assert.ok(inquiryPayload.inquiryGuidance.focusAreas.includes("inventoryRules"));
  }

  // Specific inquiry — should pick the specific_answer guidance branch.
  {
    let inquiryPayload: any = null;
    const response = await generateBrokeringRouteAssistantResponse({
      prompt: "Do both inventory rules allow partial allocation?",
      conversationHistory: [],
      orderRoutingDomainKnowledge: "domain knowledge",
      pageCapabilityManifest: manifest,
      outputContract: manifest.outputContract,
      classifyIntent: async () => ({ intent: "inquiry", reasoning: "yes/no question" }),
      generateInquiry: async (payload) => {
        inquiryPayload = payload;
        return {
          answer: "No. Warehouses allows partial allocation; Stores fallback does not.",
          questions: [],
          summary: "Answered partial allocation question."
        };
      },
      generateDraft: async () => {
        throw new Error("draft agent should not handle inquiry requests");
      }
    });

    assert.equal(response.intent, "inquiry");
    assert.equal(response.message, "No. Warehouses allows partial allocation; Stores fallback does not.");
    assert.equal(inquiryPayload.inquiryGuidance.detailLevel, "specific_answer");
    assert.equal(inquiryPayload.inquiryGuidance.maxSentences, 2);
    assert.ok(inquiryPayload.inquiryGuidance.answerStyle.includes("under 45 words"));
    assert.ok(inquiryPayload.inquiryGuidance.instructions.some((instruction: string) => instruction.includes("only the requested fields")));
  }

  // Edit path — classifier picks up the imperative verb and dispatches to draft.
  {
    let draftCalls = 0;
    const response = await generateBrokeringRouteAssistantResponse({
      prompt: "Make the stores fallback active.",
      conversationHistory: [
        { role: "user", content: "What does this route do?" },
        { role: "assistant", content: "It brokers warehouse first, then stores fallback." }
      ],
      orderRoutingDomainKnowledge: "domain knowledge",
      pageCapabilityManifest: manifest,
      outputContract: manifest.outputContract,
      classifyIntent: async () => ({ intent: "edit", reasoning: "imperative make" }),
      generateInquiry: async () => {
        throw new Error("inquiry agent should not handle edit requests");
      },
      generateDraft: async (payload) => {
        draftCalls += 1;
        assert.equal(payload.conversationHistory.length, 2);
        return {
          ...emptyDraft,
          summary: "Drafted stores fallback status change."
        };
      }
    });

    assert.equal(response.intent, "edit");
    if (response.intent !== "edit") throw new Error("unreachable");
    assert.equal(response.draft.summary, "Drafted stores fallback status change.");
    assert.equal(draftCalls, 1);
  }

  // Classifier-driven dispatch — even a "soft" prompt the old dictionary
  // would have called inquiry (e.g. "the B bucket" with no verb) must route
  // to draft when the classifier returns edit.
  {
    let draftCalls = 0;
    const response = await generateBrokeringRouteAssistantResponse({
      prompt: "the B bucket",
      conversationHistory: [],
      orderRoutingDomainKnowledge: "domain knowledge",
      pageCapabilityManifest: manifest,
      outputContract: manifest.outputContract,
      classifyIntent: async () => ({ intent: "edit", reasoning: "stub" }),
      generateInquiry: async () => {
        throw new Error("classifier said edit; inquiry agent must not run");
      },
      generateDraft: async () => {
        draftCalls += 1;
        return { ...emptyDraft, summary: "Stub edit dispatched by classifier." };
      }
    });

    assert.equal(response.intent, "edit");
    assert.equal(draftCalls, 1);
  }

  console.log("Brokering route assistant routing tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
