# Route Assistant Intent Classifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-maintained verb dictionary in `mastra/brokeringRouteAssistantRouting.ts` with a dedicated LLM classifier agent, falling back to a small 8-verb dictionary only when the model is unavailable.

**Architecture:** A new Mastra agent (`brokeringRouteIntentAgent`, model `openai/gpt-4.1-nano`) is called by `/brokering-route-assistant` before the inquiry/draft fork. Its output (`{intent, reasoning}`) decides which downstream agent runs. The `generateBrokeringRouteAssistantResponse` function gains an injected `classifyIntent` dependency, so unit tests can pass stubs and the route handler in `mastra/index.ts` wires the real classifier wrapped with a 5s `AbortController` and an `dictionaryIntentFallback` safety net for error paths.

**Tech Stack:** TypeScript, Mastra `@mastra/core` agents with `structuredOutput`, Zod v4 strict schemas, `node:assert` + `tsx` for tests.

**Spec:** `docs/superpowers/specs/2026-05-22-route-assistant-intent-classifier-design.md`

**Working directory:** `/Users/aditipatel/sandbox/accxui/apps/order-routing` (all paths below are relative to this directory).

---

## File Structure

| File | Status | Responsibility |
| --- | --- | --- |
| `mastra/brokeringRouteIntentFallback.ts` | new | Pure-function 8-verb dictionary fallback. No Mastra deps. |
| `mastra/brokeringRouteIntent.ts` | new | Zod schema for `{intent, reasoning}`, payload type, instructions, and `classifyBrokeringRouteIntent({...,generate})` that takes an injected `generate` callback so it's unit-testable. |
| `mastra/brokeringRouteAssistantRouting.ts` | modify | Remove `EDIT_VERB_TOKENS` / `LEAD_EDIT_VERB_TOKENS` / `LEAD_SKIP_TOKENS` / `EDIT_PHRASES` / `classifyIntent` / `normalizePrompt`. Add `classifyIntent` to the params type. Replace inline `classifyIntent(prompt)` with `await params.classifyIntent(...)`. |
| `mastra/index.ts` | modify | Register `brokeringRouteIntentAgent`. In the `/brokering-route-assistant` route handler, build the real classifier (5s abort + fallback on any error) and pass it to `generateBrokeringRouteAssistantResponse`. |
| `tests/brokeringRouteIntentFallback.test.ts` | new | Unit tests for the 8-verb dictionary. |
| `tests/brokeringRouteIntent.test.ts` | new | Unit tests for `classifyBrokeringRouteIntent` with stub `generate`. |
| `tests/brokeringRouteAssistantRouting.test.ts` | modify | Drop the dead `classifyIntent` regression block. Add `classifyIntent` stub to every `generateBrokeringRouteAssistantResponse` call site. |
| `tests/fixtures/brokeringRouteIntentCases.json` | new | ~30 labeled prompts for the soak test. |
| `tests/brokeringRouteIntentSoak.test.ts` | new | Real-classifier accuracy test, gated on `OPENAI_API_KEY`. |

---

## Task 1: Dictionary fallback module

**Files:**
- Create: `mastra/brokeringRouteIntentFallback.ts`
- Test: `tests/brokeringRouteIntentFallback.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/brokeringRouteIntentFallback.test.ts`:

```ts
import assert from "assert";
import { dictionaryIntentFallback } from "../mastra/brokeringRouteIntentFallback";

assert.equal(dictionaryIntentFallback("add a queue filter for backorders"), "edit");
assert.equal(dictionaryIntentFallback("remove the warehouse rule"), "edit");
assert.equal(dictionaryIntentFallback("enable partial allocation"), "edit");
assert.equal(dictionaryIntentFallback("disable the safety stock filter"), "edit");
assert.equal(dictionaryIntentFallback("set shipment threshold to 50"), "edit");
assert.equal(dictionaryIntentFallback("clear the auto cancel days"), "edit");
assert.equal(dictionaryIntentFallback("delete the second rule"), "edit");
assert.equal(dictionaryIntentFallback("create a new fallback rule"), "edit");

// Inquiries — no fallback verb present
assert.equal(dictionaryIntentFallback("what does this route do?"), "inquiry");
assert.equal(dictionaryIntentFallback("is partial allocation on for B bucket?"), "inquiry");
assert.equal(dictionaryIntentFallback("which rules ship from warehouses?"), "inquiry");

// Ambiguous / verb-less prompts default to inquiry (never mutate on a guess)
assert.equal(dictionaryIntentFallback("the B bucket"), "inquiry");
assert.equal(dictionaryIntentFallback(""), "inquiry");
assert.equal(dictionaryIntentFallback("   "), "inquiry");

// Soft verbs the LLM would catch but fallback intentionally does NOT —
// the fallback is a safety net for unambiguous cases only.
assert.equal(dictionaryIntentFallback("allow partial allocation for B bucket"), "inquiry");
assert.equal(dictionaryIntentFallback("make the stores fallback active"), "inquiry");

console.log("Brokering route intent fallback tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/brokeringRouteIntentFallback.test.ts`
Expected: `ERR_MODULE_NOT_FOUND` for `../mastra/brokeringRouteIntentFallback`.

- [ ] **Step 3: Write minimal implementation**

Create `mastra/brokeringRouteIntentFallback.ts`:

```ts
// Safety net used only when the LLM intent classifier is unavailable
// (network error, timeout, missing API key). Keep this list short and
// unambiguous — every entry must be an imperative that virtually never
// appears inside a routing inquiry. Soft verbs like "allow", "make",
// "change" are intentionally excluded: they appear in inquiries too
// ("Do both rules allow partial allocation?") and the LLM handles them.
// When no token matches, return "inquiry" — never mutate state on a
// guess.
const FALLBACK_EDIT_VERB_TOKENS = new Set([
  "add",
  "remove",
  "enable",
  "disable",
  "set",
  "clear",
  "delete",
  "create"
]);

export function dictionaryIntentFallback(prompt: string): "edit" | "inquiry" {
  const tokens = String(prompt || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ");
  return tokens.some((token) => FALLBACK_EDIT_VERB_TOKENS.has(token)) ? "edit" : "inquiry";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/brokeringRouteIntentFallback.test.ts`
Expected: `Brokering route intent fallback tests passed`.

- [ ] **Step 5: Commit**

```bash
git add mastra/brokeringRouteIntentFallback.ts tests/brokeringRouteIntentFallback.test.ts
git commit -m "Added: dictionary fallback for route assistant intent classifier"
```

---

## Task 2: LLM classifier module

**Files:**
- Create: `mastra/brokeringRouteIntent.ts`
- Test: `tests/brokeringRouteIntent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/brokeringRouteIntent.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx tests/brokeringRouteIntent.test.ts`
Expected: `ERR_MODULE_NOT_FOUND` for `../mastra/brokeringRouteIntent`.

- [ ] **Step 3: Write minimal implementation**

Create `mastra/brokeringRouteIntent.ts`:

```ts
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
// supplies `agent.generate.bind(agent)` as the callback in production.
export async function classifyBrokeringRouteIntent(params: ClassifyParams): Promise<BrokeringRouteIntent> {
  const payload: BrokeringRouteIntentPayload = {
    userPrompt: params.userPrompt,
    conversationHistory: params.conversationHistory.slice(-6)
  };

  const result = await params.generate(
    [{ role: "user", content: JSON.stringify(payload) }],
    {
      maxSteps: 1,
      abortSignal: params.abortSignal,
      instructions: brokeringRouteIntentInstructions,
      structuredOutput: { schema: brokeringRouteIntentSchema, errorStrategy: "strict" }
    }
  );

  return brokeringRouteIntentSchema.parse(result.object);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx tests/brokeringRouteIntent.test.ts`
Expected: `Brokering route intent classifier tests passed`.

- [ ] **Step 5: Commit**

```bash
git add mastra/brokeringRouteIntent.ts tests/brokeringRouteIntent.test.ts
git commit -m "Added: LLM-based intent classifier module for route assistant"
```

---

## Task 3: Inject classifier into `generateBrokeringRouteAssistantResponse`

**Files:**
- Modify: `mastra/brokeringRouteAssistantRouting.ts:49-100`
- Modify: `tests/brokeringRouteAssistantRouting.test.ts`

- [ ] **Step 1: Update the existing test to require an injected classifyIntent**

Open `tests/brokeringRouteAssistantRouting.test.ts`. In each of the three `generateBrokeringRouteAssistantResponse({...})` call sites, add a `classifyIntent` stub returning the intent the test expects. The test currently has three blocks (broad inquiry, specific inquiry, edit). Replace each as follows.

First block (broad inquiry, around line 83):

```ts
const response = await generateBrokeringRouteAssistantResponse({
  prompt: "What does this route do?",
  conversationHistory: [],
  orderRoutingDomainKnowledge: "domain knowledge",
  pageCapabilityManifest: manifest,
  outputContract: manifest.outputContract,
  classifyIntent: async () => ({ intent: "inquiry", reasoning: "broad question" }),
  generateInquiry: async (payload) => {
```

Second block (specific inquiry, around line 125):

```ts
const response = await generateBrokeringRouteAssistantResponse({
  prompt: "Do both inventory rules allow partial allocation?",
  conversationHistory: [],
  orderRoutingDomainKnowledge: "domain knowledge",
  pageCapabilityManifest: manifest,
  outputContract: manifest.outputContract,
  classifyIntent: async () => ({ intent: "inquiry", reasoning: "yes/no question" }),
  generateInquiry: async (payload) => {
```

Third block (edit, around line 155):

```ts
const response = await generateBrokeringRouteAssistantResponse({
  prompt: "Make the stores fallback active.",
  conversationHistory: [...],
  orderRoutingDomainKnowledge: "domain knowledge",
  pageCapabilityManifest: manifest,
  outputContract: manifest.outputContract,
  classifyIntent: async () => ({ intent: "edit", reasoning: "imperative make" }),
  generateInquiry: async () => {
```

Also add a NEW block at the end of the async IIFE body, before `console.log(...)`, that asserts the classifier's intent overrides any token heuristics:

```ts
  // Classifier-driven dispatch — even a "soft" prompt the old dictionary
  // would have called inquiry (e.g. "allow partial allocation for B bucket")
  // must route to draft when the classifier returns edit, and vice versa.
  {
    let draftCalls = 0;
    const response = await generateBrokeringRouteAssistantResponse({
      prompt: "the B bucket",
      conversationHistory: [],
      orderRoutingDomainKnowledge: "domain knowledge",
      pageCapabilityManifest: manifest,
      outputContract: manifest.outputContract,
      classifyIntent: async () => ({ intent: "edit", reasoning: "stub" }),
      generateInquiry: async () => {
        throw new Error("classifier said edit; inquiry agent must not run");
      },
      generateDraft: async () => {
        draftCalls += 1;
        return { ...emptyDraft, summary: "Stub edit dispatched by classifier." };
      }
    });

    assert.equal(response.intent, "edit");
    assert.equal(draftCalls, 1);
  }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx tests/brokeringRouteAssistantRouting.test.ts`
Expected: TypeScript or runtime error because `classifyIntent` is not yet on the params type and `generateBrokeringRouteAssistantResponse` still calls the inline dictionary `classifyIntent(prompt)`.

- [ ] **Step 3: Add `classifyIntent` to the params type and dispatch on it**

Open `mastra/brokeringRouteAssistantRouting.ts`. Find the existing type definition at lines 49-52:

```ts
type GenerateBrokeringRouteAssistantResponseParams = BrokeringRouteAssistantPayload & {
  generateInquiry: (payload: BrokeringRouteAssistantPayload) => Promise<BrokeringRouteInquiry>;
  generateDraft: (payload: BrokeringRouteAssistantPayload) => Promise<BrokeringRouteDraft>;
};
```

Replace with:

```ts
import type { BrokeringRouteIntent, BrokeringRouteIntentPayload } from "./brokeringRouteIntent";

type GenerateBrokeringRouteAssistantResponseParams = BrokeringRouteAssistantPayload & {
  classifyIntent: (payload: BrokeringRouteIntentPayload) => Promise<BrokeringRouteIntent>;
  generateInquiry: (payload: BrokeringRouteAssistantPayload) => Promise<BrokeringRouteInquiry>;
  generateDraft: (payload: BrokeringRouteAssistantPayload) => Promise<BrokeringRouteDraft>;
};
```

(Place the `import type` near the existing imports at the top of the file.)

Then find the body of `generateBrokeringRouteAssistantResponse` (around line 96):

```ts
export async function generateBrokeringRouteAssistantResponse(
  params: GenerateBrokeringRouteAssistantResponseParams
): Promise<BrokeringRouteAssistantResponse> {
  const payload = buildPayload(params);
  const intent = classifyIntent(params.prompt);
  ...
```

Replace the `const intent = classifyIntent(params.prompt);` line with:

```ts
  const { intent } = await params.classifyIntent({
    userPrompt: params.prompt,
    conversationHistory: params.conversationHistory
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx tests/brokeringRouteAssistantRouting.test.ts`
Expected: `Brokering route assistant routing tests passed`.

- [ ] **Step 5: Commit**

```bash
git add mastra/brokeringRouteAssistantRouting.ts tests/brokeringRouteAssistantRouting.test.ts
git commit -m "Changed: generateBrokeringRouteAssistantResponse takes injected classifyIntent"
```

---

## Task 4: Remove the old verb dictionaries

**Files:**
- Modify: `mastra/brokeringRouteAssistantRouting.ts`
- Modify: `tests/brokeringRouteAssistantRouting.test.ts`

After Task 3, the inline `classifyIntent` function and its supporting dictionaries are dead code; the existing in-test regression block for `classifyIntent` is testing a now-private (about-to-be-deleted) function.

- [ ] **Step 1: Delete the dead `classifyIntent` regression block from the test**

Open `tests/brokeringRouteAssistantRouting.test.ts`. Find and DELETE the entire block that begins with the comment `// classifyIntent — regression coverage for the substring-vs-token bug.` and ends with the assertion `assert.equal(classifyIntent("Which rules allow partial allocation?"), "inquiry");`. This block currently sits at lines 64-87 (approximate; verify locally).

Also remove `classifyIntent` from the import statement at the top of the test file. The new import should be:

```ts
import {
  generateBrokeringRouteAssistantResponse
} from "../mastra/brokeringRouteAssistantRouting";
```

- [ ] **Step 2: Run the test to verify it still passes**

Run: `npx tsx tests/brokeringRouteAssistantRouting.test.ts`
Expected: `Brokering route assistant routing tests passed`. (The other assertions from Task 3 still cover dispatch behavior.)

- [ ] **Step 3: Delete the dictionaries and `classifyIntent` function from the source**

Open `mastra/brokeringRouteAssistantRouting.ts`. Delete all of:

- `EDIT_VERB_TOKENS` constant (and its comment block).
- `LEAD_EDIT_VERB_TOKENS` constant (and its comment block).
- `LEAD_SKIP_TOKENS` constant.
- `EDIT_PHRASES` constant.
- The exported `classifyIntent` function.
- The `normalizePrompt` function IF it is no longer referenced (it is still used by `isBroadInquiry`, so keep it in that case).

Run `grep -n "normalizePrompt" mastra/brokeringRouteAssistantRouting.ts` after editing to confirm whether `normalizePrompt` is still referenced. If it has no remaining references, delete it too.

- [ ] **Step 4: Run the full test suite to verify nothing else broke**

Run:

```bash
for t in tests/*.test.ts; do
  out=$(npx tsx "$t" 2>&1)
  if echo "$out" | grep -qi "tests passed"; then
    echo "PASS $t"
  else
    echo "FAIL $t"; echo "$out" | tail -5
  fi
done
```

Expected: all 13 test files (the existing 12 plus `brokeringRouteIntentFallback.test.ts` and `brokeringRouteIntent.test.ts` from Tasks 1-2 — but counting the new ones, 14) print PASS. If any file logs FAIL, fix before committing.

- [ ] **Step 5: Commit**

```bash
git add mastra/brokeringRouteAssistantRouting.ts tests/brokeringRouteAssistantRouting.test.ts
git commit -m "Removed: hand-maintained verb dictionaries from route assistant intent classification"
```

---

## Task 5: Wire the real classifier in `mastra/index.ts`

**Files:**
- Modify: `mastra/index.ts`

The new agent must be registered and the route handler must supply the real `classifyIntent` (wrapping `agent.generate` with a 5s abort + dictionary fallback). This task has no new unit test — coverage is provided by Tasks 1-3 (unit) and Task 7 (soak). Verification is a manual restart + curl smoke check at the end.

- [ ] **Step 1: Add the new imports near the top of `mastra/index.ts`**

Open `mastra/index.ts`. Find the existing imports for `mastra/brokeringRouteAssistantRouting`. Below them, add:

```ts
import {
  brokeringRouteIntentSchema,
  classifyBrokeringRouteIntent
} from "./brokeringRouteIntent";
import { dictionaryIntentFallback } from "./brokeringRouteIntentFallback";
```

- [ ] **Step 2: Register the new agent**

Below the existing agent declarations (after `brokeringRunsListInquiryAgent`):

```ts
const brokeringRouteIntentAgent = new Agent({
  id: "brokering-route-intent-agent",
  name: "Brokering Route Intent Agent",
  model: readEnv("VITE_MASTRA_INTENT_MODEL") || "openai/gpt-4.1-nano"
});
```

Then add it to the `agents` registry in the `new Mastra({...})` call:

```ts
agents: {
  brokeringRouteInquiryAgent,
  brokeringRouteDraftAgent,
  brokeringRunsListInquiryAgent,
  brokeringRouteIntentAgent
},
```

- [ ] **Step 3: Build the real classifier in the route handler**

Find the `/brokering-route-assistant` route handler. Inside the `try { ... }` block, BEFORE the existing `const assistantResponse = await generateBrokeringRouteAssistantResponse({...})` call, get the intent agent and build the classifier function:

```ts
const intentAgent = mastraInstance.getAgent("brokeringRouteIntentAgent");

const classifyIntent = async (payload: { userPrompt: string; conversationHistory: any[] }) => {
  const classifierAbort = new AbortController();
  const classifierTimeout = setTimeout(() => classifierAbort.abort(), 5000);
  try {
    return await classifyBrokeringRouteIntent({
      userPrompt: payload.userPrompt,
      conversationHistory: payload.conversationHistory,
      abortSignal: classifierAbort.signal,
      generate: intentAgent.generate.bind(intentAgent) as any
    });
  } catch (error: any) {
    console.warn(
      `[brokering-route-assistant] intent classifier unavailable; used dictionary fallback (reason=${error?.name || "error"})`
    );
    return {
      intent: dictionaryIntentFallback(payload.userPrompt),
      reasoning: `fallback (${error?.name || "error"})`
    };
  } finally {
    clearTimeout(classifierTimeout);
  }
};
```

Then add `classifyIntent` to the call:

```ts
const assistantResponse = await generateBrokeringRouteAssistantResponse({
  prompt: parsedBody.prompt,
  conversationHistory: parsedBody.conversationHistory,
  orderRoutingDomainKnowledge,
  pageCapabilityManifest: parsedBody.pageCapabilityManifest,
  outputContract: parsedBody.outputContract || parsedBody.pageCapabilityManifest.outputContract,
  classifyIntent,
  generateInquiry: async (payload) => { /* existing */ },
  generateDraft: async (payload) => { /* existing */ }
});
```

(Only the `classifyIntent` line is new; leave the existing `generateInquiry` and `generateDraft` blocks unchanged.)

- [ ] **Step 4: Verify the bundle builds cleanly**

Run: `npx tsc --noEmit mastra/index.ts mastra/brokeringRouteIntent.ts mastra/brokeringRouteIntentFallback.ts mastra/brokeringRouteAssistantRouting.ts 2>&1 | grep -v "node_modules" | head -20`

Expected: no errors from our source files. Ignore any zod/lib errors (pre-existing TS-version-mismatch noise — confirmed by `git status` showing those files weren't changed).

- [ ] **Step 5: Restart Mastra and smoke-test the endpoint**

Stop the running Mastra:

```bash
pid=$(lsof -t -i:4111); [ -n "$pid" ] && kill $pid; sleep 2
```

Start it in dev mode:

```bash
npm run mastra:dev &
```

Wait for it to listen:

```bash
until lsof -i:4111 -P -n 2>/dev/null | grep -q LISTEN; do sleep 1; done
```

Smoke-test classification of an edit prompt with a minimal manifest (use a real one from `.mastra-debug/last-inquiry.json` if available; otherwise this curl validates the route accepts the new shape and the classifier runs without error — actual draft generation needs a valid `pageCapabilityManifest`):

```bash
curl -s -X POST http://localhost:4111/brokering-route-assistant \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "allow partial allocation for B bucket",
    "conversationHistory": [],
    "pageCapabilityManifest": {
      "pageId": "order-routing.rules",
      "route": "/tabs/circuit",
      "visibleEntities": { "route": { "availableInventoryRules": [] } },
      "editableTargets": [],
      "outputContract": { "operations": ["set"], "operationShape": {}, "responseShape": {} }
    }
  }' | head -200
```

Expected: a JSON response with `"schemaVersion": "brokering-route-assistant.v1"` and either `"intent": "edit"` (with a `draft` object) or a validation error mentioning the empty `editableTargets`. Either is acceptable for the smoke test — the key is that the classifier runs without throwing into the route handler.

Also tail the Mastra log briefly and confirm there is NO `intent classifier unavailable` warning. The classifier should succeed on its own.

- [ ] **Step 6: Commit**

```bash
git add mastra/index.ts
git commit -m "Added: brokering route intent agent wired into /brokering-route-assistant"
```

---

## Task 6: Soak-test fixture + gated real-classifier test

**Files:**
- Create: `tests/fixtures/brokeringRouteIntentCases.json`
- Create: `tests/brokeringRouteIntentSoak.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/brokeringRouteIntentSoak.test.ts`:

```ts
import assert from "assert";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Agent } from "@mastra/core/agent";
import { classifyBrokeringRouteIntent } from "../mastra/brokeringRouteIntent";

const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
if (!apiKey) {
  console.log("Brokering route intent soak test SKIPPED (no OPENAI_API_KEY)");
  process.exit(0);
}

type Case = { prompt: string; expected: "edit" | "inquiry"; note?: string };

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "brokeringRouteIntentCases.json");
const cases: Case[] = JSON.parse(await readFile(fixturePath, "utf-8"));
assert.ok(cases.length >= 30, `expected at least 30 fixture cases, got ${cases.length}`);

const agent = new Agent({
  id: "brokering-route-intent-soak-agent",
  name: "Brokering Route Intent Soak Agent",
  model: process.env.VITE_MASTRA_INTENT_MODEL || "openai/gpt-4.1-nano"
});

let correct = 0;
const misclassifications: Array<{ prompt: string; expected: string; got: string; reasoning: string }> = [];

for (const testCase of cases) {
  const result = await classifyBrokeringRouteIntent({
    userPrompt: testCase.prompt,
    conversationHistory: [],
    generate: agent.generate.bind(agent) as any
  });
  if (result.intent === testCase.expected) {
    correct += 1;
  } else {
    misclassifications.push({
      prompt: testCase.prompt,
      expected: testCase.expected,
      got: result.intent,
      reasoning: result.reasoning
    });
  }
}

if (misclassifications.length) {
  console.log("Misclassifications:");
  for (const miss of misclassifications) {
    console.log(`  prompt: ${JSON.stringify(miss.prompt)}`);
    console.log(`    expected: ${miss.expected}, got: ${miss.got} — reasoning: ${miss.reasoning}`);
  }
}

const threshold = Math.ceil(cases.length * 0.9);
assert.ok(correct >= threshold, `expected at least ${threshold}/${cases.length} correct; got ${correct}`);

console.log(`Brokering route intent soak test passed (${correct}/${cases.length} correct)`);
```

- [ ] **Step 2: Run it to verify it fails because the fixture is missing**

Run (with `OPENAI_API_KEY` set): `npx tsx tests/brokeringRouteIntentSoak.test.ts`
Expected: ENOENT or "fixture not found" error from `readFile`.

If you don't have `OPENAI_API_KEY` set locally, the test should print SKIPPED and exit 0 — that means the gate works, and you can confirm the fixture failure on a machine that has the key.

- [ ] **Step 3: Create the fixture file**

Create `tests/fixtures/brokeringRouteIntentCases.json`. 15 edits + 15 inquiries minimum. Each entry: `{prompt, expected, note?}`.

```json
[
  { "prompt": "allow partial allocation for B bucket", "expected": "edit", "note": "soft verb 'allow' as imperative — the original bug" },
  { "prompt": "add a queue filter for backorders", "expected": "edit" },
  { "prompt": "remove the warehouse rule", "expected": "edit" },
  { "prompt": "make the stores fallback active", "expected": "edit" },
  { "prompt": "B bucket should ship within 50 miles", "expected": "edit", "note": "no imperative verb at all" },
  { "prompt": "set safety stock to 3 on the warehouse rule", "expected": "edit" },
  { "prompt": "enable partial allocation", "expected": "edit" },
  { "prompt": "disable the auto cancel days", "expected": "edit" },
  { "prompt": "change schedule to weekdays only", "expected": "edit" },
  { "prompt": "sort inventory by proximity", "expected": "edit" },
  { "prompt": "move unfillable items to the unfillable parking queue", "expected": "edit" },
  { "prompt": "create a new fallback rule for stores", "expected": "edit" },
  { "prompt": "rename the warehouse rule to 'priority warehouse'", "expected": "edit" },
  { "prompt": "archive the stores fallback rule", "expected": "edit" },
  { "prompt": "switch the action on unavailable items to next rule", "expected": "edit" },
  { "prompt": "what does this route do?", "expected": "inquiry" },
  { "prompt": "is partial allocation on for B bucket?", "expected": "inquiry" },
  { "prompt": "which rules ship from warehouses?", "expected": "inquiry" },
  { "prompt": "tell me about the broker logic", "expected": "inquiry" },
  { "prompt": "how do these rules apply?", "expected": "inquiry" },
  { "prompt": "where do you put orders that fail?", "expected": "inquiry" },
  { "prompt": "do both inventory rules allow partial allocation?", "expected": "inquiry", "note": "soft verb embedded inside a question" },
  { "prompt": "which queue does unfillable inventory go to?", "expected": "inquiry" },
  { "prompt": "summarize the current routing", "expected": "inquiry" },
  { "prompt": "explain why this route is in draft", "expected": "inquiry" },
  { "prompt": "is there a safety stock filter?", "expected": "inquiry" },
  { "prompt": "what's the schedule for this run?", "expected": "inquiry" },
  { "prompt": "compare warehouse and stores rules", "expected": "inquiry" },
  { "prompt": "does the warehouse rule respect facility order limits?", "expected": "inquiry" },
  { "prompt": "give me an overview of brokering for B bucket", "expected": "inquiry" }
]
```

- [ ] **Step 4: Run the soak test**

With `OPENAI_API_KEY` set:

```bash
OPENAI_API_KEY=<key> npx tsx tests/brokeringRouteIntentSoak.test.ts
```

Expected: `Brokering route intent soak test passed (30/30 correct)` — or at minimum `>=27/30`. If a case fails, inspect the printed reasoning. Two responses:
- Genuine misclassification → tighten the instruction in `mastra/brokeringRouteIntent.ts` and re-run. Commit instruction fix as a follow-up step in this task.
- Disagreement with the fixture label → fix the fixture. Comment in the JSON entry why.

Without an API key: the test prints SKIPPED and exits 0 — that's also a passing run.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/brokeringRouteIntentCases.json tests/brokeringRouteIntentSoak.test.ts
git commit -m "Added: soak test for LLM-based route assistant intent classifier"
```

---

## Task 7: Final verification and Mastra restart

**Files:** (none — verification only)

- [ ] **Step 1: Run the full test suite one more time**

```bash
pass=0; fail=0
for t in tests/*.test.ts; do
  out=$(npx tsx "$t" 2>&1)
  if echo "$out" | grep -qiE "tests passed|SKIPPED"; then
    pass=$((pass+1))
  else
    echo "FAIL $t"; echo "$out" | tail -5
    fail=$((fail+1))
  fi
done
echo "passed: $pass  failed: $fail"
```

Expected: `failed: 0` and `passed` equal to the count of `.test.ts` files in `tests/` (14 after this plan).

- [ ] **Step 2: Restart Mastra so the new agent is loaded**

```bash
pid=$(lsof -t -i:4111); [ -n "$pid" ] && kill $pid; sleep 2
npm run mastra:dev &
until lsof -i:4111 -P -n 2>/dev/null | grep -q LISTEN; do sleep 1; done
echo "mastra ready"
```

- [ ] **Step 3: End-to-end smoke check in Circuit chat**

In the Order Routing PWA, open Circuit and type:

```
allow partial allocation for B bucket
```

Expected: a "Proposed draft changes" response containing only the partial-allocation flip (no question response, no full-rule readout). This validates the classifier + the operations-filtering fix from earlier turns together.

Also try an inquiry:

```
what does this route do?
```

Expected: a Q&A-style answer, not a draft.

- [ ] **Step 4: Confirm no fallback warnings during smoke test**

Check Mastra log output for any `intent classifier unavailable` lines during the two test prompts. There should be none — the classifier should answer both correctly without falling back.

If a fallback warning appears, capture the reason from the log, file a follow-up to investigate, but the implementation can still land — the fallback exists exactly for this kind of degradation.

- [ ] **Step 5: Final summary commit (if any cleanup needed)**

If any small cleanup edits are still pending (typo in a comment, missed import), commit them now:

```bash
git status
# only commit cleanup if there are leftover changes
```

If nothing is pending, this step is a no-op. The plan is complete.

---

## Self-Review Notes

- **Spec coverage:** Every section of the spec maps to a task.
  - Spec §3 Architecture → Tasks 2, 3, 5
  - Spec §4 Classifier specification → Task 2 (module) + Task 5 (agent registration & instructions)
  - Spec §5 Failure handling → Task 1 (fallback) + Task 5 (5s abort + fallback wiring)
  - Spec §6 Tests → Tasks 1 unit, 2 unit, 3 dispatch tests, 6 soak
  - Spec §7 Migration → Task 4 (code removal) + Task 7 (verification)
- **Placeholders:** None — every code step shows real code and every command shows expected output.
- **Type consistency:** `BrokeringRouteIntent`, `BrokeringRouteIntentPayload`, `brokeringRouteIntentSchema`, `classifyBrokeringRouteIntent`, `dictionaryIntentFallback` — used consistently across Tasks 1, 2, 3, 5.
- **Test runner consistency:** All tests use `npx tsx` (matches `tests/package.json` ESM scope from earlier work).
