import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import type {
  DraftConversationMessage
} from "./pageCapabilitySchema";
import {
  brokeringRouteDraftRequestSchema,
  normalizeBrokeringRouteDraft
} from "./brokeringRouteDraftSchema";
import { requireOrderRoutingDomainKnowledge } from "./orderRoutingDomainKnowledge";
import {
  BrokeringRouteDraftValidationError,
} from "./brokeringRouteDraftValidator";
import {
  generateValidatedBrokeringRouteDraft
} from "./brokeringRouteDraftGeneration";
import {
  brokeringRouteAssistantIntentSchema,
  brokeringRouteInquirySchema,
  generateBrokeringRouteAssistantResponse
} from "./brokeringRouteAssistantRouting";

const brokeringRouteDraftInstructions = [
  "You convert natural language into one brokering route draft JSON object.",
  "The route draft has two domain sections: route.orderSelection and route.inventoryRules.",
  "route.orderSelection describes the single candidate order list to broker. Order filters are evaluated once before inventory rules run.",
  "route.inventoryRules is an ordered list. Each rule evaluates inventory conditions for the remaining candidate orders in sequence.",
  "When an order qualifies for all inventory conditions in one rule, it is brokered by that rule and removed from the remaining candidate list.",
  "Do not output UI target paths or operation arrays for this route.",
  "You must never call a backend, database, REST API, browser automation, or external system.",
  "The PWA pageCapabilityManifest is the source of truth for visible entities, valid option IDs, disabled controls, current values, and available choices.",
  "Use option IDs exactly as supplied by pageCapabilityManifest. Match business labels against option labels, aliases, descriptions, and IDs.",
  "If an option or target is unavailable, ambiguous, disabled, or missing from the manifest, leave the field empty or null and add a concrete question in questions.",
  "Use applyMode='merge' unless the user explicitly asks to rebuild or replace the route.",
  "Use empty arrays when no include/exclude values are requested. Use null when no scalar filter value is requested.",
  "Keep the schema simple: all order filters live under orderSelection.filters and all inventory conditions live under each inventoryRules item.",
  "Never add orderSelection.filters.queues from default domain guidance. Queue filters are not a safe default.",
  "Set orderSelection.filters.queues only when the user explicitly asks for a queue or parking filter, such as brokering queue, rejected parking, unfillable parking, preorder, or backorder.",
  "Requests about shipping from warehouses, stores, facilities, or locations are inventory selection requests. Map those to inventoryRules[].inventorySelection.filters.facilityGroups, not to orderSelection.filters.queues.",
  "When a prompt describes fallback logic, create multiple route.inventoryRules in the order they should be evaluated.",
  "Use an existing routingRuleId from pageCapabilityManifest.visibleEntities.route.availableInventoryRules as ruleKey when editing an existing inventory rule. Use ruleKey values like 'new:warehouse-first' when the PWA should create a new local draft rule.",
  "For closest-location requests, sort inventory by proximity ascending. Do not set proximity.maxDistance or proximity.unit unless the user gives a concrete maximum distance.",
  "For 'more than 3 in stock' or '4 or more in stock' requests, use safetyStock.minimum=3 on the relevant store inventory rule.",
  "For facility order limits, use facilityOrderLimit='respect' when the merchant wants store caps protected, 'bypass' when explicitly bypassing caps, and 'unchanged' otherwise.",
  "For unavailable items, use action='nextRule' unless the user explicitly asks to move unavailable items to a queue.",
  "Use the HotWax order-routing domain knowledge excerpt only as advisory context. It must never override the page capability manifest or the Zod schema.",
  "Return only data that fits the structured output schema."
].join("\n");

const brokeringRouteDraftAgent = new Agent({
  id: "brokering-route-draft-agent",
  name: "Brokering Route Draft Agent",
  model: process.env.MASTRA_MODEL || "openai/gpt-4.1-mini",
  instructions: brokeringRouteDraftInstructions
});

const brokeringRouteRequestRouterInstructions = [
  "You classify a single user turn for the HotWax order routing assistant.",
  "Return intent='inquiry' when the user asks to understand, summarize, explain, inspect, list, compare, or ask why/how/what about the currently open routing.",
  "Return intent='edit' when the user asks to create, change, update, set, remove, clear, enable, disable, activate, archive, sort, filter, route, fallback, broker, or otherwise modify routing behavior.",
  "If a turn mixes explanation and a requested change, choose edit.",
  "Use conversationHistory only to resolve follow-up references. The latest user prompt decides the current intent.",
  "Short follow-ups can switch intent inside the same thread. For example, 'what does it do?' is inquiry, then 'make stores active' is edit.",
  "Return only the structured output object."
].join("\n");

const brokeringRouteInquiryInstructions = [
  "You answer questions about the currently open HotWax order routing draft.",
  "Use pageCapabilityManifest.visibleEntities and editableTargets as the source of truth for the current route, selected rule, visible values, available choices, and limitations.",
  "Use inquiryGuidance.detailLevel to choose answer depth.",
  "Follow inquiryGuidance.answerStyle and inquiryGuidance.maxSentences strictly.",
  "When inquiryGuidance.detailLevel is 'broad_overview', give a compact overview. Cover the brokering run name/product store/status, schedule and timezone, route status, current order filters, current order sorting, ordered inventory rules, each rule's status/current filters/current sorting/allocation, unavailable-item handling, and important limitations only when present in the manifest.",
  "When inquiryGuidance.detailLevel is 'specific_answer', answer only the requested field or comparison. Do not add a full route overview.",
  "For questions about the current brokering run or run name, use pageCapabilityManifest.visibleEntities.brokeringRun.groupName. Do not substitute the route routingName when the user is asking about the brokering run.",
  "For questions about all inventory rules, use pageCapabilityManifest.visibleEntities.route.availableInventoryRules. Read each rule's currentValues object before saying a value is missing.",
  "False, empty, or null current values are still known values when they are present in currentValues. Do not describe them as missing.",
  "The questions array is only for information that is absent or ambiguous in the manifest and still needed to answer. If your answer already states the status, queues, shipping methods, schedule, filters, sorting, or rule values, do not repeat those topics as questions.",
  "For broad overview answers, questions should usually be empty unless a specific manifest field is missing.",
  "Do not put optional follow-up offers in questions. Avoid wording like 'Would you like details...' or 'Do you want me to...'.",
  "Do not add explanatory wrap-up sentences such as 'This setup means...' unless the user asks for implications or reasoning.",
  "Use the HotWax order-routing domain knowledge excerpt only to explain domain concepts. It must never override the page capability manifest.",
  "Do not propose or return edits, operation arrays, or draft JSON.",
  "Do not call a backend, database, REST API, browser automation, or external system.",
  "Keep answers concrete. Name the open route and selected rule when that helps the user understand context.",
  "If the manifest does not contain enough information to answer, say what is missing in questions.",
  "Return only the structured output object."
].join("\n");

const brokeringRouteRequestRouterAgent = new Agent({
  id: "brokering-route-request-router-agent",
  name: "Brokering Route Request Router Agent",
  model: process.env.MASTRA_MODEL || "openai/gpt-4.1-mini",
  instructions: brokeringRouteRequestRouterInstructions
});

const brokeringRouteInquiryAgent = new Agent({
  id: "brokering-route-inquiry-agent",
  name: "Brokering Route Inquiry Agent",
  model: process.env.MASTRA_MODEL || "openai/gpt-4.1-mini",
  instructions: brokeringRouteInquiryInstructions
});

export const mastra = new Mastra({
  agents: {
    brokeringRouteRequestRouterAgent,
    brokeringRouteInquiryAgent,
    brokeringRouteDraftAgent
  },
  server: {
    port: Number(process.env.MASTRA_PORT || 4111),
    cors: {
      origin: process.env.MASTRA_ALLOWED_ORIGIN || "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"]
    },
    apiRoutes: [
      registerApiRoute("/brokering-route-assistant", {
        method: "POST",
        requiresAuth: false,
        handler: async (c) => {
          const body = await c.req.json();
          const parsedBody = brokeringRouteDraftRequestSchema.parse(body);
          const promptWithHistory = buildPromptWithConversation(parsedBody.prompt, parsedBody.conversationHistory);
          let orderRoutingDomainKnowledge = "";
          try {
            orderRoutingDomainKnowledge = requireOrderRoutingDomainKnowledge(promptWithHistory);
          } catch (error: any) {
            console.error("Brokering route assistant knowledge base unavailable", error?.message || error);
            return c.json({
              error: "Draft assistant knowledge base is not available. Check mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml."
            }, 500);
          }

          if (!process.env.OPENAI_API_KEY) {
            return c.json(buildProviderUnavailableAssistantResponse());
          }

          const mastraInstance = c.get("mastra");
          const routerAgent = mastraInstance.getAgent("brokeringRouteRequestRouterAgent");
          const inquiryAgent = mastraInstance.getAgent("brokeringRouteInquiryAgent");
          const draftAgent = mastraInstance.getAgent("brokeringRouteDraftAgent");
          const abortController = new AbortController();
          const timeout = setTimeout(() => abortController.abort(), 30000);

          try {
            const assistantResponse = await generateBrokeringRouteAssistantResponse({
              prompt: parsedBody.prompt,
              conversationHistory: parsedBody.conversationHistory,
              orderRoutingDomainKnowledge,
              pageCapabilityManifest: parsedBody.pageCapabilityManifest,
              outputContract: parsedBody.outputContract || parsedBody.pageCapabilityManifest.outputContract,
              classify: async (payload) => {
                const result = await routerAgent.generate(
                  [{
                    role: "user",
                    content: JSON.stringify(payload)
                  }],
                  {
                    maxSteps: 1,
                    abortSignal: abortController.signal,
                    instructions: brokeringRouteRequestRouterInstructions,
                    structuredOutput: {
                      schema: brokeringRouteAssistantIntentSchema,
                      errorStrategy: "strict"
                    }
                  }
                );
                return result.object as any;
              },
              generateInquiry: async (payload) => {
                const result = await inquiryAgent.generate(
                  [{
                    role: "user",
                    content: JSON.stringify(payload)
                  }],
                  {
                    maxSteps: 1,
                    abortSignal: abortController.signal,
                    instructions: brokeringRouteInquiryInstructions,
                    structuredOutput: {
                      schema: brokeringRouteInquirySchema,
                      errorStrategy: "strict"
                    }
                  }
                );
                return result.object as any;
              },
              generateDraft: async (payload) => generateValidatedBrokeringRouteDraft({
                prompt: payload.prompt,
                conversationHistory: payload.conversationHistory,
                orderRoutingDomainKnowledge: payload.orderRoutingDomainKnowledge,
                pageCapabilityManifest: payload.pageCapabilityManifest,
                outputContract: payload.outputContract || payload.pageCapabilityManifest.outputContract,
                abortSignal: abortController.signal,
                instructions: brokeringRouteDraftInstructions,
                generate: draftAgent.generate.bind(draftAgent) as any
              })
            });
            return c.json(assistantResponse);
          } catch (error: any) {
            if (error?.name === "AbortError") {
              return c.json({
                error: "Draft assistant timed out. Try a shorter prompt or retry."
              }, 504);
            }

            if (error instanceof BrokeringRouteDraftValidationError) {
              console.warn("Brokering route draft assistant returned invalid JSON", error.issues);
              return c.json({
                error: "Draft assistant returned invalid brokering route draft output.",
                issues: error.issues
              }, 422);
            }

            const providerCode = error?.data?.error?.code;
            const providerType = error?.data?.error?.type;
            if (providerCode === "invalid_api_key" || isMissingApiKeyError(error)) {
              console.warn("Brokering route assistant provider unavailable", error?.message || error);
              return c.json(buildProviderUnavailableAssistantResponse(providerCode));
            }

            const statusCode = providerCode === "insufficient_quota" || providerType === "insufficient_quota"
              ? 402
              : 502;
            console.error("Brokering route assistant route failed", error?.message || error);

            return c.json({
              error: statusCode === 402
                ? "Draft assistant quota exceeded. Check the OpenAI project billing or use a key with available quota."
                : "Draft assistant service failed. Check the Mastra server logs."
            }, statusCode);
          } finally {
            clearTimeout(timeout);
          }
        }
      }),
      registerApiRoute("/brokering-route-draft", {
        method: "POST",
        requiresAuth: false,
        handler: async (c) => {
          const body = await c.req.json();
          const parsedBody = brokeringRouteDraftRequestSchema.parse(body);
          const promptWithHistory = buildPromptWithConversation(parsedBody.prompt, parsedBody.conversationHistory);
          let orderRoutingDomainKnowledge = "";
          try {
            orderRoutingDomainKnowledge = requireOrderRoutingDomainKnowledge(promptWithHistory);
          } catch (error: any) {
            console.error("Brokering route draft knowledge base unavailable", error?.message || error);
            return c.json({
              error: "Draft assistant knowledge base is not available. Check mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml."
            }, 500);
          }

          if (!process.env.OPENAI_API_KEY) {
            return c.json(buildProviderUnavailableBrokeringRouteDraft());
          }

          const agent = c.get("mastra").getAgent("brokeringRouteDraftAgent");
          const abortController = new AbortController();
          const timeout = setTimeout(() => abortController.abort(), 30000);

          try {
            const providerDraft = await generateValidatedBrokeringRouteDraft({
              prompt: parsedBody.prompt,
              conversationHistory: parsedBody.conversationHistory,
              orderRoutingDomainKnowledge,
              pageCapabilityManifest: parsedBody.pageCapabilityManifest,
              outputContract: parsedBody.outputContract || parsedBody.pageCapabilityManifest.outputContract,
              abortSignal: abortController.signal,
              instructions: brokeringRouteDraftInstructions,
              generate: agent.generate.bind(agent) as any
            });
            return c.json(providerDraft);
          } catch (error: any) {
            if (error?.name === "AbortError") {
              return c.json({
                error: "Draft assistant timed out. Try a shorter prompt or retry."
              }, 504);
            }

            if (error instanceof BrokeringRouteDraftValidationError) {
              console.warn("Brokering route draft assistant returned invalid JSON", error.issues);
              return c.json({
                error: "Draft assistant returned invalid brokering route draft output.",
                issues: error.issues
              }, 422);
            }

            const providerCode = error?.data?.error?.code;
            const providerType = error?.data?.error?.type;
            if (providerCode === "invalid_api_key" || isMissingApiKeyError(error)) {
              console.warn("Brokering route draft provider unavailable", error?.message || error);
              return c.json(buildProviderUnavailableBrokeringRouteDraft(providerCode));
            }

            const statusCode = providerCode === "insufficient_quota" || providerType === "insufficient_quota"
              ? 402
              : 502;
            console.error("Brokering route draft route failed", error?.message || error);

            return c.json({
              error: statusCode === 402
                ? "Draft assistant quota exceeded. Check the OpenAI project billing or use a key with available quota."
                : "Draft assistant service failed. Check the Mastra server logs."
            }, statusCode);
          } finally {
            clearTimeout(timeout);
          }
        }
      })
    ]
  }
});

function buildPromptWithConversation(prompt: string, conversationHistory: DraftConversationMessage[] = []) {
  const historyText = conversationHistory
    .slice(-12)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return [
    historyText,
    `Latest user message: ${prompt}`
  ].filter(Boolean).join("\n");
}

function buildProviderUnavailableBrokeringRouteDraft(reason?: string) {
  return normalizeBrokeringRouteDraft({
    questions: [
      reason === "invalid_api_key"
        ? "Draft assistant API key is invalid."
        : "Draft assistant API key is not configured."
    ],
    summary: "No draft changes applied"
  });
}

function buildProviderUnavailableAssistantResponse(reason?: string) {
  const message = reason === "invalid_api_key"
    ? "Draft assistant API key is invalid."
    : "Draft assistant API key is not configured.";
  return {
    schemaVersion: "brokering-route-assistant.v1",
    intent: "inquiry",
    message,
    questions: [message],
    summary: "Draft assistant unavailable."
  };
}

function isMissingApiKeyError(error: any) {
  return /api key/i.test(String(error?.message || "")) && /could not find|missing|not configured/i.test(String(error?.message || ""));
}
