import assert from "node:assert";
import {
  proposeKnowledgeFeedback,
  refineKnowledgeFeedback,
  approveKnowledgeFeedback
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

async function main() {
  await proposeHappy();
  await refineHappy();
  await approveHappy();
  await proposeNetworkRejection();
  await approveValidationFailure();
  console.log("circuitKnowledgeFeedbackService tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
