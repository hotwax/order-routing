import assert from "node:assert";
import { vi } from "vitest";

vi.mock("@common", () => ({
  client: async (config: any) => {
    const response = await globalThis.fetch(`${config.baseURL || ""}${config.url}`, {
      method: config.method,
      headers: config.headers,
      body: config.data === undefined ? undefined : JSON.stringify(config.data),
      signal: config.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}`);
      error.response = { status: response.status, data };
      throw error;
    }
    return { data };
  },
}));

import {
  proposeKnowledgeFeedback,
  refineKnowledgeFeedback,
  approveKnowledgeFeedback,
  suggestKnowledgeFeedbackPrompt
} from "../src/services/CircuitKnowledgeFeedbackService";

type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

function withMockFetch(impl: (url: string, init: FetchInit) => Promise<Response>) {
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = (url: string, init: FetchInit) => impl(url, init);
  return () => {
    (globalThis as any).fetch = original;
  };
}

const sampleProposal = {
  proposalId: "p-1",
  summary: "add example to no_route",
  rationale: "user said an example was missing",
  edits: [
    {
      op: "append" as const,
      path: "diagnostic_patterns[0].user_question_examples",
      value: "why didn't this order route?"
    }
  ],
  editDescriptions: [
    {
      op: "append" as const,
      path: "diagnostic_patterns[0].user_question_examples",
      text: 'Add example question to "no_route" pattern: "why didn\'t this order route?"'
    }
  ]
};

// proposeKnowledgeFeedback happy path
async function proposeHappy() {
  let capturedUrl = "";
  let capturedBody: any = null;
  const restore = withMockFetch(async (url, init) => {
    capturedUrl = url;
    capturedBody = JSON.parse(init.body || "{}");
    return new Response(JSON.stringify({ ok: true, proposal: sampleProposal }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
  try {
    const result = await proposeKnowledgeFeedback({
      messages: [{ role: "user", content: "hi" }],
      userCorrection: "should have done X",
      correctionCategory: "missed_clarifying_question",
      context: { routingGroupId: "rg-1" }
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.proposal.proposalId, "p-1");
      assert.equal(result.proposal.edits.length, 1);
      assert.equal(result.proposal.editDescriptions.length, 1);
    }
    assert.ok(capturedUrl.endsWith("/knowledge-feedback/propose"));
    assert.equal(capturedBody.userCorrection, "should have done X");
    assert.equal(capturedBody.correctionCategory, "missed_clarifying_question");
  } finally {
    restore();
  }
}

// refineKnowledgeFeedback happy path
async function refineHappy() {
  let capturedUrl = "";
  let capturedBody: any = null;
  const restore = withMockFetch(async (url, init) => {
    capturedUrl = url;
    capturedBody = JSON.parse(init.body || "{}");
    return new Response(JSON.stringify({ ok: true, proposal: sampleProposal }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
  try {
    const result = await refineKnowledgeFeedback({
      messages: [{ role: "user", content: "hi" }],
      userCorrection: "original feedback",
      previousProposal: {
        proposalId: "p-0",
        summary: "old",
        rationale: "old rationale",
        edits: []
      },
      refinementFeedback: "make it shorter"
    });
    assert.equal(result.ok, true);
    assert.ok(capturedUrl.endsWith("/knowledge-feedback/refine"));
    assert.equal(capturedBody.refinementFeedback, "make it shorter");
    assert.equal(capturedBody.previousProposal.proposalId, "p-0");
  } finally {
    restore();
  }
}

// approveKnowledgeFeedback happy path
async function approveHappy() {
  let capturedUrl = "";
  let capturedBody: any = null;
  const restore = withMockFetch(async (url, init) => {
    capturedUrl = url;
    capturedBody = JSON.parse(init.body || "{}");
    return new Response(
      JSON.stringify({
        ok: true,
        commitSha: "abc1234567890abc1234567890abc1234567890a",
        shortSha: "abc1234",
        summary: "add example",
        editCount: 1
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  });
  try {
    const result = await approveKnowledgeFeedback({
      proposal: {
        proposalId: "p-1",
        summary: "add example",
        rationale: "user wanted it",
        edits: sampleProposal.edits
      },
      userCorrection: "original feedback",
      refinementHistory: ["make it shorter"],
      messages: [{ role: "user", content: "hi" }]
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.shortSha, "abc1234");
      assert.equal(result.editCount, 1);
    }
    assert.ok(capturedUrl.endsWith("/knowledge-feedback/approve"));
    assert.equal(capturedBody.userCorrection, "original feedback");
    assert.deepEqual(capturedBody.refinementHistory, ["make it shorter"]);
  } finally {
    restore();
  }
}

// network rejection on propose
async function proposeNetworkRejection() {
  const restore = withMockFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  try {
    const result = await proposeKnowledgeFeedback({
      messages: [{ role: "user", content: "hi" }],
      userCorrection: "x"
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "network");
      assert.match(result.error, /ECONNREFUSED/);
    }
  } finally {
    restore();
  }
}

// non-2xx with stage from server on approve
async function approveValidationFailure() {
  const restore = withMockFetch(async () =>
    new Response(JSON.stringify({ ok: false, stage: "applier", error: "yaml changed" }), {
      status: 422,
      headers: { "content-type": "application/json" }
    })
  );
  try {
    const result = await approveKnowledgeFeedback({
      proposal: {
        proposalId: "p-1",
        summary: "x",
        rationale: "x",
        edits: []
      },
      userCorrection: "x",
      messages: [{ role: "user", content: "hi" }]
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "applier");
      assert.equal(result.error, "yaml changed");
    }
  } finally {
    restore();
  }
}

// suggestKnowledgeFeedbackPrompt happy path
async function suggestHappy() {
  let capturedUrl = "";
  let capturedBody: any = null;
  const restore = withMockFetch(async (url, init) => {
    capturedUrl = url;
    capturedBody = JSON.parse(init.body || "{}");
    return new Response(
      JSON.stringify({
        ok: true,
        suggestedPrompt: "Circuit should have asked which order id before answering."
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  });
  try {
    const result = await suggestKnowledgeFeedbackPrompt({
      messages: [
        { role: "user", content: "why didn't order route" },
        { role: "assistant", content: "could not find a matching rule" }
      ],
      correctionCategory: "missed_clarifying_question",
      context: { routingGroupId: "rg-1" }
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(
        result.suggestedPrompt,
        "Circuit should have asked which order id before answering."
      );
    }
    assert.ok(capturedUrl.endsWith("/knowledge-feedback/suggest-prompt"));
    assert.equal(capturedBody.correctionCategory, "missed_clarifying_question");
    assert.equal(capturedBody.messages.length, 2);
    assert.equal(capturedBody.context.routingGroupId, "rg-1");
  } finally {
    restore();
  }
}

// suggest network rejection
async function suggestNetworkRejection() {
  const restore = withMockFetch(async () => {
    throw new Error("offline");
  });
  try {
    const result = await suggestKnowledgeFeedbackPrompt({
      messages: [{ role: "user", content: "hi" }]
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "network");
      assert.match(result.error, /offline/);
    }
  } finally {
    restore();
  }
}

// suggest llm failure from server
async function suggestLlmFailure() {
  const restore = withMockFetch(async () =>
    new Response(JSON.stringify({ ok: false, stage: "llm", error: "model error" }), {
      status: 502,
      headers: { "content-type": "application/json" }
    })
  );
  try {
    const result = await suggestKnowledgeFeedbackPrompt({
      messages: [{ role: "user", content: "hi" }]
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "llm");
      assert.equal(result.error, "model error");
    }
  } finally {
    restore();
  }
}

async function malformedSuccessResponsesFailClosed() {
  const proposalRequest = {
    messages: [{ role: "user" as const, content: "hi" }],
    userCorrection: "x"
  };

  let restore = withMockFetch(async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
  try {
    const result = await proposeKnowledgeFeedback(proposalRequest);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "validation");
      assert.match(result.error, /invalid feedback proposal/i);
    }
  } finally {
    restore();
  }

  restore = withMockFetch(async () =>
    new Response(JSON.stringify({ ok: true, shortSha: "abc1234", summary: "done", editCount: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
  try {
    const result = await approveKnowledgeFeedback({
      proposal: {
        proposalId: "p-1",
        summary: "x",
        rationale: "x",
        edits: []
      },
      userCorrection: "x",
      messages: proposalRequest.messages
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "validation");
      assert.match(result.error, /invalid feedback approval/i);
    }
  } finally {
    restore();
  }

  restore = withMockFetch(async () =>
    new Response(JSON.stringify({ ok: true, suggestedPrompt: "" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
  try {
    const result = await suggestKnowledgeFeedbackPrompt({ messages: proposalRequest.messages });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "validation");
      assert.match(result.error, /invalid feedback suggestion/i);
    }
  } finally {
    restore();
  }
}

async function disabledConfigMakesNoRequest() {
  vi.stubEnv("VITE_DRAFT_ASSISTANT_ENABLED", "false");
  const fetchSpy = vi.fn();
  const restore = withMockFetch(fetchSpy as any);
  try {
    const request = {
      messages: [{ role: "user", content: "hi" }],
      userCorrection: "x"
    };
    const result = await proposeKnowledgeFeedback(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "validation");
      assert.match(result.error, /VITE_DRAFT_ASSISTANT_ENABLED/);
    }

    vi.stubEnv("VITE_DRAFT_ASSISTANT_ENABLED", "true");
    vi.stubEnv("VITE_MASTRA_URL", "");
    const unsetUrlResult = await proposeKnowledgeFeedback(request);
    assert.equal(unsetUrlResult.ok, false);
    if (!unsetUrlResult.ok) {
      assert.equal(unsetUrlResult.stage, "validation");
      assert.match(unsetUrlResult.error, /VITE_MASTRA_URL/);
    }

    vi.stubEnv("VITE_MASTRA_URL", "http://circuit.example.test");
    const insecureUrlResult = await suggestKnowledgeFeedbackPrompt({ messages: request.messages });
    assert.equal(insecureUrlResult.ok, false);
    if (!insecureUrlResult.ok) {
      assert.equal(insecureUrlResult.stage, "validation");
      assert.match(insecureUrlResult.error, /must use HTTPS/);
    }

    assert.equal(fetchSpy.mock.calls.length, 0, "disabled or invalid feedback config must never reach a network origin");
  } finally {
    restore();
  }
}

async function main() {
  vi.stubEnv("VITE_DRAFT_ASSISTANT_ENABLED", "true");
  vi.stubEnv("VITE_MASTRA_URL", "https://circuit.example.test");
  try {
    await proposeHappy();
    await refineHappy();
    await approveHappy();
    await proposeNetworkRejection();
    await approveValidationFailure();
    await suggestHappy();
    await suggestNetworkRejection();
    await suggestLlmFailure();
    await malformedSuccessResponsesFailClosed();
    await disabledConfigMakesNoRequest();
    console.log("circuitKnowledgeFeedbackService tests passed");
  } finally {
    vi.unstubAllEnvs();
  }
}

it("validates Circuit knowledge feedback service requests", async () => {
  await main();
});
