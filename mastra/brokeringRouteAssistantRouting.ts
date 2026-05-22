import { z } from "zod/v4";
import type {
  BrokeringRouteDraft
} from "./brokeringRouteDraftSchema";
import type {
  DraftConversationMessage,
  PageCapabilityManifest
} from "./pageCapabilitySchema";
import type { BrokeringRouteIntent, BrokeringRouteIntentPayload } from "./brokeringRouteIntent";

export const brokeringRouteInquirySchema = z.object({
  answer: z.string().min(1),
  questions: z.array(z.string().min(1)),
  summary: z.string().min(1)
}).strict();

export type BrokeringRouteInquiry = z.infer<typeof brokeringRouteInquirySchema>;

export type BrokeringRouteAssistantPayload = {
  prompt: string;
  conversationHistory: DraftConversationMessage[];
  orderRoutingDomainKnowledge: string;
  pageCapabilityManifest: PageCapabilityManifest;
  outputContract?: unknown;
  inquiryGuidance?: BrokeringRouteInquiryGuidance;
};

export type BrokeringRouteInquiryGuidance = {
  detailLevel: "broad_overview" | "specific_answer";
  focusAreas: string[];
  maxSentences: number;
  answerStyle: string;
  instructions: string[];
};

export type BrokeringRouteAssistantResponse =
  | {
    schemaVersion: "brokering-route-assistant.v1";
    intent: "inquiry";
    message: string;
    questions: string[];
    summary: string;
  }
  | {
    schemaVersion: "brokering-route-assistant.v1";
    intent: "edit";
    draft: BrokeringRouteDraft;
  };

type GenerateBrokeringRouteAssistantResponseParams = BrokeringRouteAssistantPayload & {
  classifyIntent: (payload: BrokeringRouteIntentPayload) => Promise<BrokeringRouteIntent>;
  generateInquiry: (payload: BrokeringRouteAssistantPayload) => Promise<BrokeringRouteInquiry>;
  generateDraft: (payload: BrokeringRouteAssistantPayload) => Promise<BrokeringRouteDraft>;
};

// Single-word imperative verbs that signal an edit when matched as a whole token.
// Nouns that overlap with inquiry vocab (route, broker, fallback, apply, put) are
// intentionally excluded — substring matching them misroutes inquiries like
// "what does this route do?" or "is there a fallback rule?".
const EDIT_VERB_TOKENS = new Set([
  "add", "set", "update", "change", "create", "remove", "clear", "enable",
  "disable", "activate", "archive", "bypass", "respect", "include", "exclude",
  "make", "move", "switch", "replace", "rebuild", "reset", "configure", "assign"
]);

// Softer verbs that ARE imperative when they lead the prompt ("allow partial
// allocation for B bucket") but appear inside inquiries too ("Do both rules
// allow partial allocation?"). Only treat them as edit when they are the first
// content token, after optional politeness prefixes like "please"/"can you".
const LEAD_EDIT_VERB_TOKENS = new Set(["allow", "permit", "deny", "forbid"]);
const LEAD_SKIP_TOKENS = new Set(["please", "can", "could", "would", "you", "kindly"]);

// Multi-word edit cues. These are precise enough to match as substrings.
const EDIT_PHRASES = ["sort by", "filter by", "turn on", "turn off", "set up"];

export function classifyIntent(prompt: string): "edit" | "inquiry" {
  const norm = normalizePrompt(prompt);
  if (!norm) {
    return "inquiry";
  }
  if (EDIT_PHRASES.some((phrase) => norm.includes(phrase))) {
    return "edit";
  }
  const tokens = norm.split(" ");
  if (tokens.some((token) => EDIT_VERB_TOKENS.has(token))) {
    return "edit";
  }
  let leadIndex = 0;
  while (leadIndex < tokens.length && LEAD_SKIP_TOKENS.has(tokens[leadIndex])) {
    leadIndex += 1;
  }
  if (LEAD_EDIT_VERB_TOKENS.has(tokens[leadIndex])) {
    return "edit";
  }
  return "inquiry";
}

export async function generateBrokeringRouteAssistantResponse(
  params: GenerateBrokeringRouteAssistantResponseParams
): Promise<BrokeringRouteAssistantResponse> {
  const payload = buildPayload(params);
  const { intent } = await params.classifyIntent({
    userPrompt: params.prompt,
    conversationHistory: params.conversationHistory
  });

  if (intent === "inquiry") {
    const inquiry = brokeringRouteInquirySchema.parse(await params.generateInquiry(payload));
    return {
      schemaVersion: "brokering-route-assistant.v1",
      intent: "inquiry",
      message: inquiry.answer,
      questions: inquiry.questions,
      summary: inquiry.summary
    };
  }

  return {
    schemaVersion: "brokering-route-assistant.v1",
    intent: "edit",
    draft: await params.generateDraft(payload)
  };
}

function buildPayload(params: BrokeringRouteAssistantPayload): BrokeringRouteAssistantPayload {
  return {
    prompt: params.prompt,
    conversationHistory: params.conversationHistory,
    orderRoutingDomainKnowledge: params.orderRoutingDomainKnowledge,
    pageCapabilityManifest: params.pageCapabilityManifest,
    outputContract: params.outputContract || params.pageCapabilityManifest.outputContract,
    inquiryGuidance: buildBrokeringRouteInquiryGuidance(params.prompt)
  };
}

export function buildBrokeringRouteInquiryGuidance(prompt: string): BrokeringRouteInquiryGuidance {
  if (isBroadInquiry(prompt)) {
    return {
      detailLevel: "broad_overview",
      focusAreas: [
        "brokeringRun",
        "schedule",
        "routeStatus",
        "orderFilters",
        "orderSorts",
        "inventoryRules",
        "allocation",
        "unavailableItems",
        "limitations"
      ],
      maxSentences: 4,
      answerStyle: "Use 3-4 short bullets or 3-4 short sentences. Stay under 90 words.",
      instructions: [
        "Give a compact overview of the current brokering run.",
        "Include schedule/status, route filters, route sorting, ordered inventory rules, rule allocation behavior, and unavailable-item handling when present in the manifest.",
        "Do not explain general order-routing behavior or implications unless the user asks why or how it works.",
        "Call out missing manifest data only after summarizing the values that are present."
      ]
    };
  }

  return {
    detailLevel: "specific_answer",
    focusAreas: [],
    maxSentences: 2,
    answerStyle: "Use 1-2 short sentences or up to 3 short bullets. Stay under 45 words.",
    instructions: [
      "Answer only the requested fields or comparison.",
      "Use pageCapabilityManifest.visibleEntities.route.availableInventoryRules[].currentValues for inventory-rule questions.",
      "Do not include defaults, implications, or a full route summary unless the user asks for them."
    ]
  };
}

function isBroadInquiry(prompt: string) {
  const normalizedPrompt = normalizePrompt(prompt);
  return [
    "help me understand",
    "give me an overview",
    "overview of",
    "summarize",
    "explain this route",
    "explain the route",
    "explain this routing",
    "explain the routing",
    "what does this route do",
    "what does this routing do",
    "what is this route doing",
    "what is this routing doing"
  ].some((phrase) => normalizedPrompt.includes(phrase));
}

function normalizePrompt(prompt: string) {
  return String(prompt || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
