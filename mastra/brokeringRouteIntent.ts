import { z } from "zod/v4";
import type { DraftConversationMessage } from "./pageCapabilitySchema";

export const brokeringRouteIntentSchema = z.object({
  intent: z.enum(["edit", "inquiry"]),
  reasoning: z.string().min(1)
}).strict();

export type BrokeringRouteIntent = z.infer<typeof brokeringRouteIntentSchema>;

export type BrokeringRouteIntentPayload = {
  userPrompt: string;
  conversationHistory: DraftConversationMessage[];
};

export const brokeringRouteIntentInstructions = [
  "Classify the user's latest message as either \"edit\" or \"inquiry\".",
  "\"edit\" means the user wants to change a brokering route — toggle a flag, add/remove a filter, change a sort, rename a rule, change status, allow or deny a behavior. Examples: \"allow partial allocation for B bucket\", \"add a queue filter for backorders\", \"make stores fallback active\", \"B bucket should ship within 50 miles\".",
  "\"inquiry\" means the user wants to read, understand, or compare. Examples: \"what does this route do?\", \"is partial allocation on for B bucket?\", \"which rules ship from warehouses?\".",
  "If the message is genuinely ambiguous, return \"inquiry\". The user can re-ask with an imperative if they wanted an edit. Never mutate state on a guess.",
  "The reasoning field must be one short sentence explaining the decision; it is logged but not shown to the user.",
  "Return only the structured output object."
].join("\n");

type ClassifyGenerate = (
  messages: Array<{ role: "user"; content: string }>,
  options: Record<string, unknown>
) => Promise<{ object: unknown }>;

type ClassifyParams = BrokeringRouteIntentPayload & {
  generate: ClassifyGenerate;
  abortSignal?: AbortSignal;
};

// Pure function — accepts an injected `generate` callback so it can be unit
// tested without a real Mastra agent. The route handler in mastra/index.ts
// supplies `agent.generate.bind(agent) as any` as the callback in production
// (the `as any` matches the established pattern in brokeringRouteDraftGeneration.ts —
// Mastra's `Agent.generate` type is stricter than this callback signature).
export async function classifyBrokeringRouteIntent(params: ClassifyParams): Promise<BrokeringRouteIntent> {
  // 6 turns of recent history — enough to resolve pronoun/anaphora across a
  // short back-and-forth in the route editor; cheaper than passing full history.
  const payload: BrokeringRouteIntentPayload = {
    userPrompt: params.userPrompt,
    conversationHistory: params.conversationHistory.slice(-6)
  };

  const result = await params.generate(
    [{ role: "user", content: JSON.stringify(payload) }],
    {
      maxSteps: 1,
      ...(params.abortSignal !== undefined ? { abortSignal: params.abortSignal } : {}),
      instructions: brokeringRouteIntentInstructions,
      structuredOutput: { schema: brokeringRouteIntentSchema, errorStrategy: "strict" }
    }
  );

  return brokeringRouteIntentSchema.parse(result.object);
}
