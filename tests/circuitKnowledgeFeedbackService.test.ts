import assert from "node:assert";
import { submitKnowledgeFeedback } from "../src/services/CircuitKnowledgeFeedbackService";

type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

function withMockFetch(impl: (url: string, init: FetchInit) => Promise<Response>) {
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = (url: string, init: FetchInit) => impl(url, init);
  return () => {
    (globalThis as any).fetch = original;
  };
}

// happy path: forwards body shape and returns the parsed JSON verbatim
async function happyPath() {
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
    const result = await submitKnowledgeFeedback({
      messages: [{ role: "user", content: "hi" }],
      userCorrection: "should have done X",
      context: { routingGroupId: "rg-1" }
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.shortSha, "abc1234");
      assert.equal(result.editCount, 1);
    }
    assert.ok(capturedUrl.endsWith("/knowledge-feedback"));
    assert.deepEqual(capturedBody.messages, [{ role: "user", content: "hi" }]);
    assert.equal(capturedBody.userCorrection, "should have done X");
    assert.equal(capturedBody.context.routingGroupId, "rg-1");
  } finally {
    restore();
  }
}

// non-2xx response with structured error body
async function structuredError() {
  const restore = withMockFetch(async () =>
    new Response(JSON.stringify({ ok: false, error: "bad request", stage: "validation" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    })
  );
  try {
    const result = await submitKnowledgeFeedback({
      messages: [{ role: "user", content: "hi" }],
      userCorrection: "x"
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "validation");
      assert.equal(result.error, "bad request");
    }
  } finally {
    restore();
  }
}

// fetch rejection -> network stage
async function networkRejection() {
  const restore = withMockFetch(async () => {
    throw new Error("ECONNREFUSED");
  });
  try {
    const result = await submitKnowledgeFeedback({
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

// non-JSON success body -> network stage
async function malformedJson() {
  const restore = withMockFetch(async () =>
    new Response("<html>not json</html>", { status: 200, headers: { "content-type": "text/html" } })
  );
  try {
    const result = await submitKnowledgeFeedback({
      messages: [{ role: "user", content: "hi" }],
      userCorrection: "x"
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.stage, "network");
    }
  } finally {
    restore();
  }
}

async function main() {
  await happyPath();
  await structuredError();
  await networkRejection();
  await malformedJson();
  console.log("circuitKnowledgeFeedbackService tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
