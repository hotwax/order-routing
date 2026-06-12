# Brokering Runs List Inquiry — Intent Engine + Diagnostic Knowledge Base

**Status:** Approved for implementation plan
**Date:** 2026-05-18
**Owners:** Order Routing PWA — Brokering Runs List assistant

---

## 1. Problem

The Brokering Runs list page assistant has four Mastra tools registered (`getFacilityChangeSummary`, `getBrokeringFacilityGroups`, `getProductStoreBrokeringSettings`, `getFacilityOrderLimits`) but the model only reliably calls the first one. For diagnostic and recommendation questions — e.g. *"How can I reduce unfillable orders?"* — the agent gives generic advice and lists the data it needs as open questions to the user instead of calling the tools that return that data.

Evidence from Mastra server logs (`bk812wvdw.output`, last three requests against the recommendation prompt):
- `getProductStoreBrokeringSettings` fires (then 404s — endpoint not deployed yet).
- `getBrokeringFacilityGroups` is **not** called, even though the backend endpoint **is** deployed (confirmed by the 404 error from the settings call: `"resources available are [shippingMethods, facilityGroups, brokeringFacilityGroups]"`).
- `getFacilityOrderLimits` is not called.
- The agent's open-questions array contains *"Which facility groups are configured with Brokering_Group subtype?"* — which is exactly what `getBrokeringFacilityGroups` returns.

Prompt-engineering alone (clearer instructions, higher `maxSteps`) has been insufficient. We need to remove the tool-calling choice from the model for the question classes that need the data.

---

## 2. Goals

1. **Guarantee** that diagnostic and recommendation questions get the environmental data fetched before the response agent generates an answer.
2. **Authoritatively constrain** which clarifying questions are appropriate per question class, so the agent stops asking the user for data the tools can return.
3. **Keep** the manifest-only fast path for pure config-lookup questions so latency doesn't regress.
4. **Surface** per-tool unavailability (404 / network error) to the agent as structured `{ unavailable: true, reason }` markers so the agent can be honest about gaps instead of hallucinating.

Non-goals: changing the route-assistant inquiry path (different page, different problem), tool result caching across turns, replacing the main agent's tool registration (it still has tools available for follow-up drill-downs the classifier didn't anticipate).

---

## 3. Architecture

```
POST /brokering-runs-list-inquiry
  │
  ├── 1. classifyRunsListIntent(prompt, conversationHistory, diagnosticPatterns)
  │       returns { intent, matchedPatternId?, reasoning }
  │
  ├── 2. resolveRequiredTools(intent, matchedPatternId, diagnosticPatterns)
  │       returns string[] of tool IDs to prefetch
  │
  ├── 3. prefetchToolContext(requiredTools, productStoreId, omsBaseUrl, authToken)
  │       runs requested tools in PARALLEL
  │       per tool: success → { ok: true, data } ; failure → { ok: false, unavailable: true, reason }
  │       returns a structured toolContext object keyed by tool ID
  │
  ├── 4. mainAgent.generate(messages, {
  │         maxSteps: 5,
  │         tools: { ...same four tools — kept registered for follow-up drill-downs },
  │         instructions: brokeringRunsListInquiryInstructions,
  │         structuredOutput: { schema, errorStrategy: "strict" }
  │       })
  │       The user message JSON now includes: { prompt, manifest, toolContext, intent,
  │                                              appropriateClarifyingQuestions,
  │                                              inappropriateClarifyingQuestions }
  │
  └── 5. Return structured response (existing schema + optional intent debug field)
```

### Why pre-fetch instead of trusting tool calls

Two model calls (classifier + main) are deterministic about *what data is loaded*. The model decides *how to use* the data, not *whether to load it*. This is the same pattern `brokeringRouteAssistantRouting.ts` uses for the route assistant (intent classification before agent dispatch); we are extending it to the runs-list flow.

### Why keep tools registered on the main agent

Some follow-up cases need parameterized calls the classifier can't predict — e.g. *"why is Brooklyn getting so many orders?"* needs a second `getFacilityChangeSummary` call with `facilityId="BROOKLYN_WH"`. Tools stay registered so the agent can drill down. `maxSteps: 5` is sufficient because the eager prefetch removes most tool-calling load.

---

## 4. Intent classes

| Intent | Definition | Trigger examples | Eager tools |
|---|---|---|---|
| `config_lookup` | Answerable from the manifest alone — schedule, filter setup, rule order, allocation settings | "what schedule does Morning use?", "which rules use queue X?", "show me the order filters on the Standard run" | (none) |
| `behavior_diagnostic` | Needs live routing-decision data; not asking for change recommendations | "how many orders are in unfillable?", "why are so many going to Brooklyn?", "which run sent the most orders today?" | `getFacilityChangeSummary` |
| `environmental_audit` | Asks specifically about brokering reference config — what groups exist, what settings are set, what caps exist | "what facility groups do I have?", "is the shipment threshold set?", "which facilities have order caps?" | `getBrokeringFacilityGroups`, `getProductStoreBrokeringSettings`, `getFacilityOrderLimits` |
| `recommendation` | Asks for advice or changes to improve outcomes | "how do I reduce unfillable?", "what should I change to ship faster?", "why is my fill rate low and what can I do?" | **all four** |

### Multi-turn handling

The classifier receives `conversationHistory` in the existing `DraftConversationMessage[]` shape (already passed through from the PWA). Follow-ups inherit context: *"how can I prevent this?"* immediately after *"how many orders are in unfillable?"* must classify as `recommendation`, not `config_lookup`. The classifier prompt explicitly tells it to consider the last 1–3 turns when the current prompt is a follow-up (pronoun-led, deictic, or short reply lacking subject).

### Mixed intents and pattern precedence

A question can carry traits of multiple intents (e.g. *"how many are in unfillable, and what should I do about it?"*). The classifier always returns exactly one intent and at most one `matchedPatternId`.

`resolveRequiredTools` has two cases, in order:
1. **Pattern matched** → use the matched pattern's `requires` list verbatim. The pattern is the source of truth for that question class.
2. **No pattern matched** → fall back to the intent's default tool list:
   - `config_lookup` → `[]`
   - `behavior_diagnostic` → `[facility_change_summary]`
   - `environmental_audit` → `[brokering_facility_groups, product_store_settings, facility_order_limits]`
   - `recommendation` → `[facility_change_summary, brokering_facility_groups, product_store_settings, facility_order_limits]`

This keeps the resolution rule simple and avoids unions/intersections that would be hard to reason about as patterns accumulate.

---

## 5. Diagnostic patterns (YAML knowledge base)

Add a `diagnostic_patterns` section to `mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml`. Each entry is a structured record consumable by both the classifier and the response agent.

### Schema

```yaml
diagnostic_patterns:
  - id: <stable-snake-case-id>
    user_question_examples:
      - "<example user phrasing>"
    intent: <one of: behavior_diagnostic | environmental_audit | recommendation>
    requires:
      # canonical tool IDs the classifier will eager-fetch
      - facility_change_summary
      - brokering_facility_groups
      - product_store_settings
      - facility_order_limits
    diagnostic_levers:
      # domain explanations the response agent can use when reasoning over results
      - lever: <short id>
        explanation: "<one-sentence why this matters>"
    appropriate_clarifying_questions:
      # ONLY ask the user these — they are NOT tool-fetchable
      - "<question text>"
    inappropriate_clarifying_questions:
      # NEVER ask the user these — they ARE tool-fetchable
      - "<question text>"
```

### Initial patterns (Phase 1)

Three patterns shipped with the design. Additional patterns can be added later without code changes — the loader treats the YAML as data.

#### `high_unfillable_rate`
```yaml
- id: high_unfillable_rate
  user_question_examples:
    - "how do I reduce unfillable orders"
    - "why are so many orders going to unfillable parking"
    - "what should I change to fix the unfillable problem"
  intent: recommendation
  requires:
    - facility_change_summary
    - brokering_facility_groups
    - product_store_settings
    - facility_order_limits
  diagnostic_levers:
    - lever: facility_group_breadth
      explanation: "If the rules' FACILITY_GROUP filter is restricted to a narrow set, broadening it surfaces more inventory."
    - lever: store_threshold
      explanation: "A high product-store-level brokeringShipmentThreshold can block allocation when no single facility carries the full quantity."
    - lever: per_rule_safety_stock
      explanation: "A high BRK_SAFETY_STOCK on early rules can starve them of allocation; check inventoryFilters in the manifest."
    - lever: facility_caps
      explanation: "Facilities at maximumOrderLimit are skipped — verify which facilities have caps and whether they're being hit."
    - lever: unavailable_action
      explanation: "Rules that route to UNFILLABLE_PARKING on no-match increase the queue size; a nextRule action with a broader fallback rule can reduce it."
  appropriate_clarifying_questions:
    - "Should the recommendation prioritize SLA compliance or minimizing shipping cost?"
  inappropriate_clarifying_questions:
    - "Which facility groups are configured for warehouses, stores, or all?"
    - "Is a Brokering Shipment Threshold set at the product store level?"
    - "Are there maximumOrderLimit values set on facilities?"
```

#### `facility_concentration`
```yaml
- id: facility_concentration
  user_question_examples:
    - "why is Brooklyn getting so many orders"
    - "why is one facility being assigned everything"
    - "how do I spread orders across facilities"
  intent: recommendation
  requires:
    - facility_change_summary
    - brokering_facility_groups
    - facility_order_limits
  diagnostic_levers:
    - lever: rule_ordering
      explanation: "If the first inventory rule's FACILITY_GROUP filter contains only the concentrated facility, every order qualifying for that rule goes there."
    - lever: missing_caps
      explanation: "Without maximumOrderLimit on the concentrated facility, no mechanism enforces distribution."
    - lever: proximity_sort
      explanation: "A PROXIMITY sort with a narrow customer geography concentrates orders on the closest facility."
  appropriate_clarifying_questions:
    - "Do you want orders distributed by capacity, by proximity to customer, or evenly across the group?"
  inappropriate_clarifying_questions:
    - "Which facility groups contain the concentrated facility?"
    - "Does the concentrated facility have a maximumOrderLimit set?"
```

#### `environmental_audit`
```yaml
- id: environmental_audit_overview
  user_question_examples:
    - "what facility groups do I have"
    - "what brokering settings are configured"
    - "is the shipment threshold set"
    - "which facilities have order caps"
  intent: environmental_audit
  requires:
    - brokering_facility_groups
    - product_store_settings
    - facility_order_limits
  diagnostic_levers: []
  appropriate_clarifying_questions: []
  inappropriate_clarifying_questions:
    - "Which facility groups are configured?"
    - "Is a Brokering Shipment Threshold set?"
    - "Are there maximumOrderLimit values?"
```

### Canonical tool IDs

The YAML uses these stable IDs (independent of the Mastra tool names so the YAML doesn't break if we rename a tool):

| Canonical ID | Mastra tool |
|---|---|
| `facility_change_summary` | `getFacilityChangeSummary` |
| `brokering_facility_groups` | `getBrokeringFacilityGroups` |
| `product_store_settings` | `getProductStoreBrokeringSettings` |
| `facility_order_limits` | `getFacilityOrderLimits` |

The mapping lives in `mastra/runsListInquiryContext.ts` alongside the prefetch logic.

---

## 6. `toolContext` payload shape

Injected into the main agent's user message JSON alongside the manifest:

```ts
type ToolContext = {
  facility_change_summary?: ToolResult<FacilityChangeSummaryResponse>;
  brokering_facility_groups?: ToolResult<BrokeringFacilityGroupsResponse>;
  product_store_settings?: ToolResult<ProductStoreBrokeringSettingsResponse>;
  facility_order_limits?: ToolResult<FacilityOrderLimitsResponse>;
};

type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; unavailable: true; reason: string };  // 404, network error, etc.
```

Only keys for tools that were requested by the classifier appear. The response agent's instructions are updated to:
- Read `toolContext.<id>.data` for known values.
- When `toolContext.<id>.unavailable === true`, mention the gap honestly (e.g. *"Brokering shipment threshold could not be retrieved (backend endpoint unavailable)"*) and proceed with the rest of the analysis.
- Never put a question in the response's `questions` array if its answer would come from a tool listed in `toolContext` (whether `ok` or `unavailable`).

---

## 7. Agent instruction updates

Replace the current four-tool guidance in `brokeringRunsListInquiryInstructions` with:

- "`toolContext` in the user message JSON contains the environmental data already fetched for this question. Read it before deciding whether to call any tool. If a key is `unavailable`, name the gap honestly in the answer — do not invent values and do not ask the user for that data."
- "`inappropriateClarifyingQuestions` in the user message JSON is an exhaustive list of questions you are forbidden from putting in the `questions` array. These all have tool-derived answers; if the data isn't in `toolContext`, the answer is 'unavailable', not a user question."
- "`appropriateClarifyingQuestions` lists questions you MAY ask only when their answer is genuinely needed and not derivable from `toolContext` or the manifest."
- "Tools remain available for follow-up calls (e.g. narrowing `getFacilityChangeSummary` by `facilityId` when the user asks about a specific facility). Do not re-call a tool whose result is already in `toolContext` for this turn."

The "for diagnostic or recommendation questions you MUST gather..." instruction from the previous iteration is **removed** — the responsibility moves to the prefetch layer.

---

## 8. File changes

| File | Status | Purpose |
|---|---|---|
| `mastra/brokeringRunsListIntent.ts` | **new** | Intent classifier. Schema, instructions, `classifyRunsListIntent(prompt, history, patterns)` fn. Mirrors `brokeringRouteAssistantRouting.classifyIntent` style. |
| `mastra/runsListInquiryContext.ts` | **new** | Canonical tool ID → tool factory mapping, `resolveRequiredTools(intent, patternId, patterns)`, `prefetchToolContext(requiredTools, productStoreId, oms, token)`. Handles per-tool errors → `unavailable` markers. |
| `mastra/orderRoutingDomainKnowledge.ts` | modified | Add typed loader for `diagnostic_patterns`. Returns a parsed `DiagnosticPattern[]` instead of opaque YAML text. Existing string-export path stays for backwards compat with the route assistant. |
| `mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml` | modified | Add `diagnostic_patterns` top-level section with the three Phase 1 patterns above. |
| `mastra/brokeringRunsListInquirySchema.ts` | modified | Add optional `intent` and `matchedPatternId` fields to the response schema so the FE can log/debug. Existing fields unchanged. |
| `mastra/index.ts` | modified | Refactor the `/brokering-runs-list-inquiry` handler to the 5-step pipeline above. Drop `maxSteps` back to 5. Remove the "you MUST gather environmental context" instruction. Add `toolContext`/`appropriateClarifyingQuestions`/`inappropriateClarifyingQuestions` to the user-message JSON. |
| `tests/brokeringRunsListIntent.test.ts` | **new** | `node:assert` + `tsx` tests covering: each intent class produces the right `requiredTools`; pattern matching binds the right `matchedPatternId`; multi-turn classification (follow-up after a `behavior_diagnostic` becomes `recommendation`); unknown question falls back to `config_lookup`. |
| `tests/runsListInquiryContext.test.ts` | **new** | Tests covering: prefetch runs requested tools in parallel; 404 from one tool yields `{ unavailable: true, reason }` without throwing; tools not in `requiredTools` are not invoked; canonical-ID → tool mapping is exhaustive. |

No frontend changes. The PWA continues to POST the same payload; the new fields in the response are optional.

---

## 9. Backend dependencies

Already deployed (verified from logs):
- `GET order-routing/productStores/{id}/brokeringFacilityGroups` ✓

Pending (block functional verification of the corresponding `unavailable` paths):
- `GET order-routing/productStores/{id}/brokeringSettings` — **404 in logs**
- `GET order-routing/facilities/order-limits?productStoreId=...` — not yet called by the model; deployment status unknown

The intent engine ships independently of these backend gaps. When a tool 404s, the agent will say so honestly (per the `unavailable` flow). Once the endpoints ship, no client change is needed.

---

## 10. Latency considerations

The new pipeline adds:
- **+1 classifier model call** (~0.5–1.5s with `gpt-4.1-mini`).
- **+0 sequential tool latency** (prefetched in parallel — happens during the classifier call's tail and can overlap).
- **−tool-loop steps** in the main agent (most requests now need 0–1 tool calls instead of 1–4).

Net: roughly neutral on `recommendation` questions (was already 2–4 tool round-trips serialized inside the agent loop), modestly slower on `config_lookup` questions (an extra classifier call where today there is none). If the latency hit on `config_lookup` is measurable, a heuristic fast-path can be added later (skip classifier when the prompt clearly matches manifest-only language) — out of scope for Phase 1.

---

## 11. Risks and rollback

| Risk | Mitigation |
|---|---|
| Classifier misclassifies a recommendation as `config_lookup` and the main agent gives generic advice again | YAML pattern matching is a second classification axis; the response agent's `inappropriateClarifyingQuestions` constraint still applies even if intent is wrong |
| YAML diagnostic_patterns drift out of sync with new tools added later | New tool registration must add an entry in the canonical-ID map and at least one diagnostic pattern that references it; covered by `runsListInquiryContext.test.ts`'s exhaustiveness check |
| Backend tool 404s confuse the agent into looping | Tools return structured `unavailable` markers, not exceptions; agent instructions explicitly cover the gap-honesty path; `maxSteps: 5` caps any pathological retry |
| Classifier latency on quick config questions feels sluggish | Phase 2 heuristic fast-path (out of scope here) |

Rollback: revert `mastra/index.ts` handler to the previous direct-generate path. The new files (`brokeringRunsListIntent.ts`, `runsListInquiryContext.ts`) are orphaned but harmless. YAML additions are inert if not consumed.

---

## 12. Out of scope (Phase 2+)

- Tool result caching across conversation turns within one assistant session
- Heuristic fast-path to skip the classifier on obvious `config_lookup` questions
- Surfacing intent classification in the chat UI (e.g. "Looking up your facility configuration…" progress messages)
- Adding diagnostic patterns beyond the three initial ones
- Generalizing this pattern to the route-assistant inquiry path

---

## 13. Definition of done

- [ ] All file changes in §8 implemented.
- [ ] `npx tsx tests/brokeringRunsListIntent.test.ts` and `npx tsx tests/runsListInquiryContext.test.ts` pass.
- [ ] Manual verification against running OMS dev instance: ask *"how can I prevent orders going to unfillable?"* → Mastra logs show classifier hit, four tool calls (or three + one `unavailable` for the still-404 endpoint), agent response references concrete facility group names and threshold value, `inappropriateClarifyingQuestions` content does **not** appear in the response's `questions` array.
- [ ] Manual verification of `config_lookup` path: ask *"what schedule does the Morning run use?"* → no tool calls in logs, answer derived from manifest.
- [ ] YAML knowledge base loads without error and the three Phase 1 patterns are parsed.
- [ ] No regressions in existing route-assistant tests (`tests/brokeringRouteAssistantRouting.test.ts` etc.).
