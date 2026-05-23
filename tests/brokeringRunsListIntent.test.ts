import assert from "assert";
import {
  classifyRunsListIntent,
  type RunsListIntentResult
} from "../mastra/brokeringRunsListIntent";
import type { DiagnosticPattern } from "../mastra/orderRoutingDomainKnowledge";
import type { DraftConversationMessage } from "../mastra/pageCapabilitySchema";

type GenerateCall = {
  messages: Array<{ role: string; content: string }>;
  options: Record<string, any>;
};

function makeMockAgent(returnValueOrFn: RunsListIntentResult | ((call: GenerateCall) => RunsListIntentResult)): {
  agent: any;
  calls: GenerateCall[];
} {
  const calls: GenerateCall[] = [];
  const agent = {
    generate: async (messages: any, options: any) => {
      const call: GenerateCall = { messages, options };
      calls.push(call);
      const value = typeof returnValueOrFn === "function" ? (returnValueOrFn as any)(call) : returnValueOrFn;
      const parsed = options?.structuredOutput?.schema?.parse
        ? options.structuredOutput.schema.parse(value)
        : value;
      return { object: parsed };
    }
  };
  return { agent, calls };
}

const patterns: DiagnosticPattern[] = [
  {
    id: "high_unfillable_rate",
    userQuestionExamples: [
      "how do I reduce unfillable orders",
      "why are so many orders going to unfillable parking",
      "what should I change to fix the unfillable problem"
    ],
    intent: "recommendation",
    requires: ["facility_change_summary", "brokering_facility_groups", "product_store_settings", "facility_order_limits"],
    diagnosticLevers: [{ lever: "facility_group_breadth", explanation: "narrow filters block allocation." }],
    appropriateClarifyingQuestions: ["Should the recommendation prioritize SLA compliance or minimizing shipping cost?"],
    inappropriateClarifyingQuestions: ["Which facility groups are configured?"]
  },
  {
    id: "environmental_audit_overview",
    userQuestionExamples: ["what facility groups do I have", "is the shipment threshold set"],
    intent: "environmental_audit",
    requires: ["brokering_facility_groups", "product_store_settings", "facility_order_limits"],
    diagnosticLevers: [],
    appropriateClarifyingQuestions: [],
    inappropriateClarifyingQuestions: []
  }
];

const abortSignal = new AbortController().signal;

(async () => {
  // 1. config_lookup intent — no pattern match.
  {
    const { agent, calls } = makeMockAgent({
      intent: "config_lookup",
      matchedPatternId: null,
      reasoning: "Asks about run schedule which is in the manifest."
    });

    const result = await classifyRunsListIntent({
      prompt: "what schedule does the Morning run use?",
      conversationHistory: [],
      patterns,
      agent,
      abortSignal
    });

    assert.equal(result.intent, "config_lookup");
    assert.equal(result.matchedPatternId, null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.maxSteps, 1, "classifier must use maxSteps=1");
    assert.equal(calls[0].options.structuredOutput.errorStrategy, "strict");

    // The user-message JSON must include the prompt and pruned patterns (id, examples, intent only).
    const userMessage = calls[0].messages[0];
    assert.equal(userMessage.role, "user");
    const payload = JSON.parse(userMessage.content);
    assert.equal(payload.prompt, "what schedule does the Morning run use?");
    assert.ok(Array.isArray(payload.patterns), "patterns must be in payload");
    assert.equal(payload.patterns.length, 2);
    for (const p of payload.patterns) {
      assert.ok("id" in p, "pattern entry must have id");
      assert.ok("userQuestionExamples" in p, "pattern entry must have userQuestionExamples");
      assert.ok("intent" in p, "pattern entry must have intent");
      // Heavy fields stripped to keep classifier prompt compact.
      assert.ok(!("requires" in p), "pattern entry must NOT include requires");
      assert.ok(!("diagnosticLevers" in p), "pattern entry must NOT include diagnosticLevers");
    }
  }

  // 2. behavior_diagnostic intent.
  {
    const { agent } = makeMockAgent({
      intent: "behavior_diagnostic",
      matchedPatternId: null,
      reasoning: "Asks for live counts in unfillable parking."
    });

    const result = await classifyRunsListIntent({
      prompt: "how many orders are in unfillable?",
      conversationHistory: [],
      patterns,
      agent,
      abortSignal
    });

    assert.equal(result.intent, "behavior_diagnostic");
    assert.equal(result.matchedPatternId, null);
  }

  // 3. environmental_audit intent.
  {
    const { agent } = makeMockAgent({
      intent: "environmental_audit",
      matchedPatternId: null,
      reasoning: "Asks whether the shipment threshold is set."
    });

    const result = await classifyRunsListIntent({
      prompt: "is the shipment threshold set?",
      conversationHistory: [],
      patterns,
      agent,
      abortSignal
    });

    assert.equal(result.intent, "environmental_audit");
  }

  // 4. recommendation intent with pattern match.
  {
    const { agent } = makeMockAgent({
      intent: "recommendation",
      matchedPatternId: "high_unfillable_rate",
      reasoning: "Matches the high_unfillable_rate pattern phrasing."
    });

    const result = await classifyRunsListIntent({
      prompt: "how do I reduce unfillable orders?",
      conversationHistory: [],
      patterns,
      agent,
      abortSignal
    });

    assert.equal(result.intent, "recommendation");
    assert.equal(result.matchedPatternId, "high_unfillable_rate");
    assert.ok(result.reasoning.length > 0, "reasoning must be present");
  }

  // 5. Multi-turn: short follow-up after a behavior_diagnostic should classify as recommendation,
  //    and the classifier's user message must include the conversation history (last 3 turns).
  {
    const conversationHistory: DraftConversationMessage[] = [
      { role: "user", content: "how many in unfillable?" },
      { role: "assistant", content: "980 orders are in unfillable parking." }
    ];

    const { agent, calls } = makeMockAgent({
      intent: "recommendation",
      matchedPatternId: "high_unfillable_rate",
      reasoning: "Follow-up to a behavior_diagnostic question asks how to prevent it."
    });

    const result = await classifyRunsListIntent({
      prompt: "how can I prevent this?",
      conversationHistory,
      patterns,
      agent,
      abortSignal
    });

    assert.equal(result.intent, "recommendation");

    const payload = JSON.parse(calls[0].messages[0].content);
    assert.ok(Array.isArray(payload.conversationHistory), "conversationHistory must be in payload");
    assert.equal(payload.conversationHistory.length, 2);
    assert.equal(payload.conversationHistory[0].content, "how many in unfillable?");
    assert.equal(payload.conversationHistory[1].content, "980 orders are in unfillable parking.");
  }

  // 6. Multi-turn: history trimmed to last 3 turns when longer.
  {
    const conversationHistory: DraftConversationMessage[] = [
      { role: "user", content: "old turn 1" },
      { role: "assistant", content: "old turn 2" },
      { role: "user", content: "old turn 3" },
      { role: "assistant", content: "old turn 4" },
      { role: "user", content: "recent turn 5" }
    ];

    const { agent, calls } = makeMockAgent({
      intent: "config_lookup",
      matchedPatternId: null,
      reasoning: "ok."
    });

    await classifyRunsListIntent({
      prompt: "what's the schedule?",
      conversationHistory,
      patterns,
      agent,
      abortSignal
    });

    const payload = JSON.parse(calls[0].messages[0].content);
    assert.equal(payload.conversationHistory.length, 3, "history must be trimmed to last 3 turns");
    assert.equal(payload.conversationHistory[0].content, "old turn 3");
    assert.equal(payload.conversationHistory[2].content, "recent turn 5");
  }

  // 7. Pattern absent → fallback: matchedPatternId stays null in the consumer-facing result.
  {
    const { agent } = makeMockAgent({
      intent: "behavior_diagnostic",
      matchedPatternId: null,
      reasoning: "No diagnostic pattern matched."
    });

    const result = await classifyRunsListIntent({
      prompt: "why are so many orders going to Brooklyn?",
      conversationHistory: [],
      patterns,
      agent,
      abortSignal
    });

    assert.strictEqual(result.matchedPatternId, null);
    // Type-checks: intent is one of the four union members.
    const intentValues = ["config_lookup", "behavior_diagnostic", "environmental_audit", "recommendation"];
    assert.ok(intentValues.includes(result.intent));
  }

  // 8. Schema enforcement: an invalid intent value must cause the function to throw.
  //    With structuredOutput.errorStrategy: "strict", schema.parse() in our mock surfaces a ZodError;
  //    classifyRunsListIntent should let that bubble up.
  {
    const { agent } = makeMockAgent({
      // @ts-expect-error invalid intent on purpose
      intent: "totally_made_up",
      matchedPatternId: null,
      reasoning: "invalid"
    });

    let threw = false;
    try {
      await classifyRunsListIntent({
        prompt: "anything",
        conversationHistory: [],
        patterns,
        agent,
        abortSignal
      });
    } catch (err: any) {
      threw = true;
    }
    assert.ok(threw, "invalid intent must cause classifyRunsListIntent to throw");
  }

  // 9. abortSignal is forwarded to the agent call.
  {
    const controller = new AbortController();
    const { agent, calls } = makeMockAgent({
      intent: "config_lookup",
      matchedPatternId: null,
      reasoning: "ok."
    });

    await classifyRunsListIntent({
      prompt: "anything",
      conversationHistory: [],
      patterns,
      agent,
      abortSignal: controller.signal
    });

    assert.strictEqual(calls[0].options.abortSignal, controller.signal);
  }

  // 10. Instructions are passed at call time, not stored on the agent.
  {
    const { agent, calls } = makeMockAgent({
      intent: "config_lookup",
      matchedPatternId: null,
      reasoning: "ok."
    });

    await classifyRunsListIntent({
      prompt: "anything",
      conversationHistory: [],
      patterns,
      agent,
      abortSignal
    });

    assert.equal(typeof calls[0].options.instructions, "string");
    assert.ok(calls[0].options.instructions.length > 0, "instructions must be a non-empty string");
  }

  console.log("Brokering runs list intent tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
