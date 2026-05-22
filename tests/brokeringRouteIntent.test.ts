import assert from "assert";
import {
  brokeringRouteIntentSchema,
  classifyBrokeringRouteIntent
} from "../mastra/brokeringRouteIntent";

// Schema accepts valid payloads
{
  const parsed = brokeringRouteIntentSchema.parse({ intent: "edit", reasoning: "explicit imperative" });
  assert.equal(parsed.intent, "edit");
  assert.equal(parsed.reasoning, "explicit imperative");
}

// Schema rejects an unknown intent
{
  const result = brokeringRouteIntentSchema.safeParse({ intent: "other", reasoning: "x" });
  assert.equal(result.success, false);
}

// Schema rejects empty reasoning
{
  const result = brokeringRouteIntentSchema.safeParse({ intent: "edit", reasoning: "" });
  assert.equal(result.success, false);
}

// classifyBrokeringRouteIntent passes the prompt + history to the generate callback
{
  let receivedMessages: Array<{ role: string; content: string }> = [];
  let receivedOptions: any = null;

  const result = await classifyBrokeringRouteIntent({
    userPrompt: "allow partial allocation for B bucket",
    conversationHistory: [{ role: "user", content: "what does this route do?" }],
    generate: async (messages, options) => {
      receivedMessages = messages as any;
      receivedOptions = options;
      return { object: { intent: "edit", reasoning: "user said 'allow', clear edit imperative" } };
    }
  });

  assert.equal(result.intent, "edit");
  assert.equal(result.reasoning, "user said 'allow', clear edit imperative");

  // The user message JSON must contain the prompt and the history
  const payload = JSON.parse(receivedMessages[0].content);
  assert.equal(payload.userPrompt, "allow partial allocation for B bucket");
  assert.equal(payload.conversationHistory.length, 1);
  assert.equal(payload.conversationHistory[0].role, "user");

  // Structured output must be wired
  assert.equal(receivedOptions.structuredOutput.errorStrategy, "strict");
  assert.equal(receivedOptions.maxSteps, 1);
}

// classifyBrokeringRouteIntent propagates malformed output as a thrown error
// (via Zod strict parse). The route handler is responsible for catching it
// and falling back to the dictionary.
{
  let threw = false;
  try {
    await classifyBrokeringRouteIntent({
      userPrompt: "anything",
      conversationHistory: [],
      generate: async () => ({ object: { intent: "wat", reasoning: "" } as any })
    });
  } catch {
    threw = true;
  }
  assert.equal(threw, true, "malformed classifier output must throw");
}

console.log("Brokering route intent classifier tests passed");
