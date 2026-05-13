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

{
  let inquiryCalls = 0;
  let draftCalls = 0;
  let classifierPayload: any = null;
  let inquiryPayload: any = null;

  const response = await generateBrokeringRouteAssistantResponse({
    prompt: "What does this route do?",
    conversationHistory: [],
    orderRoutingDomainKnowledge: "domain knowledge",
    pageCapabilityManifest: manifest,
    outputContract: manifest.outputContract,
    classify: async (payload) => {
      classifierPayload = payload;
      return { intent: "inquiry", confidence: 0.91, reason: "question about current routing" };
    },
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
  assert.equal(classifierPayload.prompt, "What does this route do?");
  assert.equal(inquiryPayload.pageCapabilityManifest.visibleEntities.brokeringRun.groupName, "Overnight Priority Orders");
  assert.equal(inquiryPayload.pageCapabilityManifest.visibleEntities.route.routingName, "Warehouse first");
  assert.equal(inquiryPayload.inquiryGuidance.detailLevel, "broad_overview");
  assert.equal(inquiryPayload.inquiryGuidance.maxSentences, 4);
  assert.ok(inquiryPayload.inquiryGuidance.answerStyle.includes("under 90 words"));
  assert.ok(inquiryPayload.inquiryGuidance.focusAreas.includes("schedule"));
  assert.ok(inquiryPayload.inquiryGuidance.focusAreas.includes("inventoryRules"));
}

{
  let inquiryPayload: any = null;
  const response = await generateBrokeringRouteAssistantResponse({
    prompt: "Do both inventory rules allow partial allocation?",
    conversationHistory: [],
    orderRoutingDomainKnowledge: "domain knowledge",
    pageCapabilityManifest: manifest,
    outputContract: manifest.outputContract,
    classify: async () => ({ intent: "inquiry", confidence: 0.95, reason: "specific rule comparison" }),
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
    classify: async () => ({ intent: "edit", confidence: 0.88, reason: "asks to change status" }),
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
  assert.equal(response.draft.summary, "Drafted stores fallback status change.");
  assert.equal(draftCalls, 1);
}

console.log("Brokering route assistant routing tests passed");
