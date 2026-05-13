import {
  brokeringRouteDraftSchema
} from "./brokeringRouteDraftSchema";
import type {
  BrokeringRouteDraft
} from "./brokeringRouteDraftSchema";
import type {
  DraftConversationMessage,
  PageCapabilityManifest
} from "./pageCapabilitySchema";
import {
  BrokeringRouteDraftValidationError,
  validateBrokeringRouteDraftJson
} from "./brokeringRouteDraftValidator";

type BrokeringRouteDraftGenerate = (
  messages: Array<{ role: "user"; content: string }>,
  options: Record<string, unknown>
) => Promise<{ object: unknown }>;

type BrokeringRouteDraftGenerationParams = {
  prompt: string;
  conversationHistory: DraftConversationMessage[];
  orderRoutingDomainKnowledge: string;
  pageCapabilityManifest: PageCapabilityManifest;
  outputContract?: unknown;
  instructions?: string;
  abortSignal?: AbortSignal;
  maxAttempts?: number;
  generate: BrokeringRouteDraftGenerate;
};

const DEFAULT_MAX_ATTEMPTS = 4;

export async function generateValidatedBrokeringRouteDraft(params: BrokeringRouteDraftGenerationParams): Promise<BrokeringRouteDraft> {
  const maxAttempts = Math.max(1, params.maxAttempts || DEFAULT_MAX_ATTEMPTS);
  let previousValidationFailure: { issues: string[]; draft: unknown } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await params.generate(
      [{
        role: "user",
        content: JSON.stringify(buildBrokeringRouteDraftPromptPayload(params, previousValidationFailure, attempt, maxAttempts))
      }],
      {
        maxSteps: 1,
        abortSignal: params.abortSignal,
        instructions: buildBrokeringRouteDraftAttemptInstructions(params.instructions || "", previousValidationFailure),
        structuredOutput: {
          schema: brokeringRouteDraftSchema,
          errorStrategy: "strict"
        }
      }
    );

    try {
      return validateBrokeringRouteDraftJson(result.object, params.pageCapabilityManifest);
    } catch (error) {
      if (!(error instanceof BrokeringRouteDraftValidationError) || attempt === maxAttempts) {
        throw error;
      }

      previousValidationFailure = {
        issues: error.issues,
        draft: result.object
      };
    }
  }

  throw new BrokeringRouteDraftValidationError(["Draft assistant did not return a valid brokering route draft."]);
}

function buildBrokeringRouteDraftPromptPayload(
  params: BrokeringRouteDraftGenerationParams,
  previousValidationFailure: { issues: string[]; draft: unknown } | null,
  attempt: number,
  maxAttempts: number
) {
  return {
    userPrompt: params.prompt,
    conversationHistory: params.conversationHistory,
    orderRoutingDomainKnowledge: params.orderRoutingDomainKnowledge,
    pageCapabilityManifest: params.pageCapabilityManifest,
    outputContract: params.outputContract || params.pageCapabilityManifest.outputContract,
    attempt,
    maxAttempts,
    previousValidationFailure
  };
}

function buildBrokeringRouteDraftAttemptInstructions(
  baseInstructions: string,
  previousValidationFailure: { issues: string[]; draft: unknown } | null
) {
  return [
    baseInstructions,
    "The user message includes orderRoutingDomainKnowledge loaded from the YAML knowledge base. Read and apply it as advisory context.",
    "Do not invent option IDs.",
    "Do not include markdown or explanatory text outside the structured output object.",
    "For closest-location requests, use inventorySelection.sorts with field='proximity' and direction='asc'. Leave inventorySelection.filters.proximity.maxDistance and unit null unless the user gives an explicit distance limit.",
    previousValidationFailure
      ? "The previous structured output failed validation. Return a corrected full JSON object that fixes every issue in previousValidationFailure. Do not repeat the invalid fields."
      : ""
  ].filter(Boolean).join("\n");
}
