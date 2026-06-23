# Brokering Route Assistant — LLM-Based Intent Classifier

**Status:** Approved for implementation plan
**Date:** 2026-05-22
**Owners:** Order Routing PWA — Circuit / brokering route assistant

---

## 1. Problem

`/brokering-route-assistant` decides between two downstream paths — *inquiry* (read-only Q&A about the current draft) and *edit* (generate a draft change) — by running `classifyIntent` (`mastra/brokeringRouteAssistantRouting.ts`). That function is a hand-maintained verb dictionary: `EDIT_VERB_TOKENS`, `LEAD_EDIT_VERB_TOKENS`, `LEAD_SKIP_TOKENS`, and `EDIT_PHRASES`.

Recent bugs traced to dictionary gaps:

- *"allow partial allocation for B bucket"* — `allow` wasn't in the set; misrouted to inquiry. Fixed by adding `LEAD_EDIT_VERB_TOKENS` (`allow`, `permit`, `deny`, `forbid`) with politeness-prefix skip logic — itself a workaround because the same verbs appear inside inquiries ("Do both rules allow partial allocation?").
- Each fix adds more rules to keep the regression suite green. Coverage is bounded by the prompts the team happens to test.

The runs-list path (`/brokering-runs-list-inquiry`) already uses an LLM-based classifier (`mastra/brokeringRunsListIntent.ts`). This spec brings the route-assistant path to the same model and eliminates the verb dictionary as the primary classifier.

---

## 2. Goals

1. Replace the hand-tuned verb dictionary with an LLM call as the primary intent classifier.
2. Keep a tiny safety net so prompts continue to route correctly when the classifier is unavailable (network error, timeout, missing API key).
3. Preserve the existing inquiry-agent and draft-agent specialization downstream — only the classification step changes.
4. Match the structural pattern of `brokeringRunsListIntent.ts` so both paths are maintained the same way.

Non-goals:

- Expanding the intent taxonomy beyond `"edit" | "inquiry"`. Future intents (e.g., `"meta"`, `"help"`) are out of scope.
- Changing the inquiry or draft agents' instructions or schemas.
- Caching classifier results across turns.
- Adding a new model dependency — uses the same OpenAI provider already configured.

---

## 3. Architecture

```
POST /brokering-route-assistant
  │
  ├── 1. classifyBrokeringRouteIntent(prompt, conversationHistory)
  │        │
  │        ├─ success → { intent: "edit" | "inquiry", reasoning }
  │        │
  │        └─ throw / timeout / no-API-key
  │              ↓
  │        dictionaryIntentFallback(prompt) → "edit" | "inquiry"
  │
  ├── 2a. intent === "inquiry" → brokeringRouteInquiryAgent (unchanged)
  │
  └── 2b. intent === "edit"    → generateValidatedBrokeringRouteDraft (unchanged)
```

The classifier is a thin Mastra call with strict structured output. It runs *before* the existing fork in `generateBrokeringRouteAssistantResponse`. Downstream behavior is unchanged.

---

## 4. Classifier Specification

### 4.1 New module: `mastra/brokeringRouteIntent.ts`

Mirrors `brokeringRunsListIntent.ts` in shape so both classifiers are maintained the same way.

### 4.2 Agent

A new dedicated agent registered alongside the existing two:

```ts
const brokeringRouteIntentAgent = new Agent({
  id: "brokering-route-intent-agent",
  name: "Brokering Route Intent Agent",
  model: readEnv("VITE_MASTRA_INTENT_MODEL") || "openai/gpt-4.1-nano"
});
```

Smaller/faster model than the inquiry and draft agents (`gpt-4.1-mini`) because the task is a single classification token, not a multi-step response. Override via `VITE_MASTRA_INTENT_MODEL` env var for testing/tuning.

### 4.3 Input payload

Minimal — no manifest, no domain knowledge:

```ts
{
  userPrompt: string,
  conversationHistory: DraftConversationMessage[]   // last 6 turns, role + content only
}
```

Rationale: intent is a property of the user's language, not the page state. Excluding the manifest cuts token cost ~10×, makes the classifier deterministic across pages, and prevents the model from confusing intent with whether a target is editable (a separate validation concern downstream).

### 4.4 Structured output (strict Zod)

```ts
export const brokeringRouteIntentSchema = z.object({
  intent: z.enum(["edit", "inquiry"]),
  reasoning: z.string().min(1)   // one short sentence, logged only
}).strict();
```

`reasoning` is written to the dev debug dump (same pattern as `writeInquiryDebugDump`); never surfaced to the user.

### 4.5 Instructions (sketch — will be finalized in implementation)

```
Classify the user's latest message as either "edit" or "inquiry".

"edit" means the user wants to change a brokering route — toggle a flag,
add/remove a filter, change a sort, rename a rule, change status, allow
or deny a behavior. Examples: "allow partial allocation for B bucket",
"add a queue filter for backorders", "make stores fallback active",
"B bucket should ship within 50 miles".

"inquiry" means the user wants to read, understand, or compare. Examples:
"what does this route do?", "is partial allocation on for B bucket?",
"which rules ship from warehouses?".

If the message is genuinely ambiguous, return "inquiry". The user can
re-ask with an imperative if they wanted an edit. Never mutate state on
a guess.

Return only the structured output object.
```

### 4.6 Wiring into the route handler

`generateBrokeringRouteAssistantResponse` (`mastra/brokeringRouteAssistantRouting.ts`) gains a `classifyIntent` injected dependency:

```ts
type GenerateBrokeringRouteAssistantResponseParams = BrokeringRouteAssistantPayload & {
  classifyIntent: (payload: BrokeringRouteIntentPayload) => Promise<BrokeringRouteIntent>;
  generateInquiry: (payload: BrokeringRouteAssistantPayload) => Promise<BrokeringRouteInquiry>;
  generateDraft: (payload: BrokeringRouteAssistantPayload) => Promise<BrokeringRouteDraft>;
};
```

The `/brokering-route-assistant` handler in `mastra/index.ts` provides the real classifier (wrapping `brokeringRouteIntentAgent.generate(...)` and the fallback). Unit tests pass stubs.

---

## 5. Failure Handling

### 5.1 Dictionary fallback

`mastra/brokeringRouteIntentFallback.ts` (new):

```ts
const FALLBACK_EDIT_VERB_TOKENS = new Set([
  "add", "remove", "enable", "disable", "set", "clear", "delete", "create"
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

Eight unambiguous imperatives. None appear naturally in routing inquiries — unlike `allow` / `apply` / `make` / `change`, which the old dictionary kept tripping over. Conservative bias: when no verb hits, return `"inquiry"` (never mutate state).

### 5.2 Trigger conditions

The fallback runs only when the LLM classifier path fails:

1. The classifier call throws (network error, provider 5xx, abort).
2. The classifier exceeds its 5s timeout (separate `AbortController` so it can't eat the 30s route budget).
3. No API key is configured. The existing `buildProviderUnavailableAssistantResponse` continues to handle the no-key case for the inquiry/draft agents; for the classifier, fallback ensures the prompt at least routes to the right path before that handler runs.

### 5.3 Logging

Every fallback invocation logs:

```
[brokering-route-assistant] intent classifier unavailable; used dictionary fallback (reason=<error name or "timeout">)
```

Gives ops visibility into classifier health before users notice degradation.

### 5.4 Latency budget

- Classifier: 5s abort.
- Route handler: 30s overall (unchanged).
- Worst case: 5s classifier + 25s draft = 30s — still within existing route timeout.

---

## 6. Tests

### 6.1 Unit tests — `tests/brokeringRouteIntent.test.ts` (new)

Uses a fake classifier (`classify: (payload) => Promise<{intent, reasoning}>`) injected into `generateBrokeringRouteAssistantResponse`, mirroring the existing `generateInquiry` / `generateDraft` test pattern.

Cases:

- Classifier returns `edit` → dispatches to draft; fallback not called.
- Classifier returns `inquiry` → dispatches to inquiry; fallback not called.
- Classifier throws → fallback runs; verb-bearing prompt routes to edit; verb-less prompt routes to inquiry.
- Classifier hits abort signal (simulated 5s timeout) → fallback runs.
- Classifier returns a malformed object → strict structured output throws → fallback runs.
- Ambiguous prompt (e.g., `"the B bucket"`) → classifier returns `inquiry` per the "prefer inquiry when ambiguous" rule.

### 6.2 Existing test migration — `tests/brokeringRouteAssistantRouting.test.ts`

- Delete the `classifyIntent` regression block (verb-dictionary contract tests) — it tests a now-dead function.
- Keep the `generateBrokeringRouteAssistantResponse` integration tests, updated to pass a `classifyIntent` stub alongside `generateInquiry` / `generateDraft`.

### 6.3 Soak test — `tests/brokeringRouteIntentSoak.test.ts` (new, gated on `OPENAI_API_KEY`)

- Fixture file `tests/fixtures/brokeringRouteIntentCases.json` with ~30 labeled prompts (15 edit, 15 inquiry) drawn from real Circuit chats plus the verbs the old dictionary covered.
- Test calls the real classifier against each prompt, asserts ≥27/30 correct, logs every misclassification.
- Skipped when no API key configured — same gate as other provider-dependent tests.

---

## 7. Migration and Rollout

### 7.1 Code removed

Once the new path lands, delete from `mastra/brokeringRouteAssistantRouting.ts`:

- `EDIT_VERB_TOKENS`
- `LEAD_EDIT_VERB_TOKENS`
- `LEAD_SKIP_TOKENS`
- `EDIT_PHRASES`
- `classifyIntent` (replaced by the injected dependency)
- `normalizePrompt` if no longer referenced

The only verb list remaining in the codebase is `FALLBACK_EDIT_VERB_TOKENS` in `mastra/brokeringRouteIntentFallback.ts` (8 verbs).

### 7.2 Rollout

Single-shot. No feature flag:

- The new path is strictly more capable than the dictionary.
- The fallback handles the degenerate case (no API key, classifier down).
- Revert is one commit if anything goes wrong.

### 7.3 Files touched

| File | Change |
| --- | --- |
| `mastra/brokeringRouteIntent.ts` | New — classifier schema, payload type, instructions, entry function. |
| `mastra/brokeringRouteIntentFallback.ts` | New — 8-verb dictionary, `dictionaryIntentFallback`. |
| `mastra/brokeringRouteAssistantRouting.ts` | Remove verb dictionaries + `classifyIntent`; add `classifyIntent` to params type; dispatch on injected result. |
| `mastra/index.ts` | Register `brokeringRouteIntentAgent`; provide the real classifier (with 5s abort + fallback) to `generateBrokeringRouteAssistantResponse`. |
| `tests/brokeringRouteAssistantRouting.test.ts` | Drop `classifyIntent` block; update integration tests to pass classifier stub. |
| `tests/brokeringRouteIntent.test.ts` | New — unit coverage of dispatch + fallback paths. |
| `tests/brokeringRouteIntentSoak.test.ts` | New — gated real-classifier accuracy check. |
| `tests/fixtures/brokeringRouteIntentCases.json` | New — labeled prompts. |
