import type { Agent } from "@mastra/core/agent";
import { z } from "zod/v4";
import type { DiagnosticPattern } from "./orderRoutingDomainKnowledge";
import type { DraftConversationMessage } from "./pageCapabilitySchema";

export type RunsListIntent =
  | "config_lookup"
  | "behavior_diagnostic"
  | "environmental_audit"
  | "recommendation";

export type RunsListIntentResult = {
  intent: RunsListIntent;
  matchedPatternId: string | null;
  reasoning: string;
};

export const runsListIntentClassificationSchema = z.object({
  intent: z.enum([
    "config_lookup",
    "behavior_diagnostic",
    "environmental_audit",
    "recommendation"
  ]),
  matchedPatternId: z.string().min(1).nullable(),
  reasoning: z.string().min(1)
}).strict();

export const brokeringRunsListIntentInstructions = [
  "You classify a single user prompt about the HotWax Brokering Runs list page into exactly one intent.",
  "Return one of four intents:",
  "- config_lookup: answerable from the page manifest alone — schedule, filter setup, rule order, allocation settings. Examples: 'what schedule does the Morning run use?', 'which rules use queue X?', 'show me the order filters on the Standard run'.",
  "- behavior_diagnostic: needs live routing-decision data; the user is asking what is happening, not what to change. Examples: 'how many orders are in unfillable?', 'why are so many orders going to Brooklyn?', 'which run sent the most orders today?'.",
  "- environmental_audit: asks specifically about brokering reference config — what facility groups exist, what brokering settings are set, what facility order caps exist. Examples: 'what facility groups do I have?', 'is the shipment threshold set?', 'which facilities have order caps?'.",
  "- recommendation: asks for advice or changes to improve outcomes. Examples: 'how do I reduce unfillable orders?', 'what should I change to ship faster?', 'why is my fill rate low and what can I do about it?'.",
  "Pattern matching: the user message also includes a `patterns` array of diagnostic patterns. Each pattern has an `id`, an `intent`, and `userQuestionExamples`. If the current prompt closely matches one pattern's intent AND phrasing (the user is asking the same kind of question as one of its examples), set `matchedPatternId` to that pattern's id. Otherwise set `matchedPatternId` to null. Return at most one matched pattern.",
  "Multi-turn handling: the user message also includes `conversationHistory`, a list of the most recent 1-3 turns. If the current prompt is a short follow-up — pronoun-led ('this', 'that', 'it'), deictic, or missing a subject — interpret it in the context of the prior turns. Example: after 'how many in unfillable?' a follow-up 'how can I prevent this?' must classify as `recommendation`, not `config_lookup`, because 'this' refers to the unfillable problem.",
  "When a prompt carries traits of multiple intents (e.g. 'how many are in unfillable, and what should I do about it?'), pick `recommendation` if the user is asking for advice or changes; pick the diagnostic/audit intent otherwise.",
  "`reasoning` must be a single short sentence stating why this intent (and pattern, if any) was chosen. Do not enumerate alternatives.",
  "Return only the structured output object. Do not call any tools."
].join("\n");

export type ClassifyRunsListIntentArgs = {
  prompt: string;
  conversationHistory: DraftConversationMessage[];
  patterns: DiagnosticPattern[];
  agent: Agent;
  abortSignal: AbortSignal;
};

export async function classifyRunsListIntent(args: ClassifyRunsListIntentArgs): Promise<RunsListIntentResult> {
  const compactPatterns = args.patterns.map((pattern) => ({
    id: pattern.id,
    userQuestionExamples: pattern.userQuestionExamples,
    intent: pattern.intent
  }));

  const recentHistory = args.conversationHistory.slice(-3);

  const payload = {
    prompt: args.prompt,
    conversationHistory: recentHistory,
    patterns: compactPatterns
  };

  const result = await args.agent.generate(
    [{ role: "user" as const, content: JSON.stringify(payload) }],
    {
      maxSteps: 1,
      abortSignal: args.abortSignal,
      instructions: brokeringRunsListIntentInstructions,
      structuredOutput: { schema: runsListIntentClassificationSchema, errorStrategy: "strict" }
    } as any
  );

  const classification = result.object as RunsListIntentResult;
  return {
    intent: classification.intent,
    matchedPatternId: classification.matchedPatternId ?? null,
    reasoning: classification.reasoning
  };
}
