import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join as joinPath } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  DraftConversationMessage
} from "./pageCapabilitySchema";
import {
  brokeringRouteDraftRequestSchema,
  normalizeBrokeringRouteDraft
} from "./brokeringRouteDraftSchema";
import { requireOrderRoutingDomainKnowledge, getDiagnosticPatterns } from "./orderRoutingDomainKnowledge";
import { classifyRunsListIntent } from "./brokeringRunsListIntent";
import { resolveRequiredTools, prefetchToolContext } from "./runsListInquiryContext";
import {
  BrokeringRouteDraftValidationError,
} from "./brokeringRouteDraftValidator";
import {
  generateValidatedBrokeringRouteDraft
} from "./brokeringRouteDraftGeneration";
import {
  brokeringRouteInquirySchema,
  generateBrokeringRouteAssistantResponse
} from "./brokeringRouteAssistantRouting";
import {
  classifyBrokeringRouteIntent
} from "./brokeringRouteIntent";
import { dictionaryIntentFallback } from "./brokeringRouteIntentFallback";
import { pruneManifestForInquiry } from "./manifestUtils";
import {
  brokeringRunsListInquirySchema,
  brokeringRunsListInquiryRequestSchema,
  type BrokeringRunsListInquiry,
  type BrokeringRunsListInquiryResponse
} from "./brokeringRunsListInquirySchema";
import { createFacilityChangeSummaryTool } from "./tools/getFacilityChangeSummary";
import { createBrokeringFacilityGroupsTool } from "./tools/getBrokeringFacilityGroups";
import { createProductStoreBrokeringSettingsTool } from "./tools/getProductStoreBrokeringSettings";
import { createFacilityOrderLimitsTool } from "./tools/getFacilityOrderLimits";
import { createRunBrokeringSimulationTool } from "./tools/runBrokeringSimulation";
import { createSubmitBrokeringSimulationTool } from "./tools/submitBrokeringSimulation";
import { createGetBrokeringSimulationStatusTool } from "./tools/getBrokeringSimulationStatus";
import { readEnv } from "./env";

// Instructions live here only — agents are model configs, not instruction holders.
// callStructured() passes instructions at call time so there is exactly one copy.

const brokeringRouteDraftInstructions = [
  "You convert natural language into one brokering route draft JSON object.",
  "The route draft has two domain sections: route.orderSelection and route.inventoryRules.",
  "route.orderSelection describes the single candidate order list to broker. Order filters are evaluated once before inventory rules run.",
  "route.inventoryRules is an ordered list. Each rule evaluates inventory conditions for the remaining candidate orders in sequence.",
  "When an order qualifies for all inventory conditions in one rule, it is brokered by that rule and removed from the remaining candidate list.",
  "Do not output UI target paths or operation arrays for this route.",
  "You must never call a backend, database, REST API, browser automation, or external system.",
  "The PWA pageCapabilityManifest is the source of truth for visible entities, valid option IDs, disabled controls, current values, and available choices.",
  "Use option IDs exactly as supplied by pageCapabilityManifest. Match business labels against option labels, aliases, descriptions, and IDs.",
  "If an option or target is unavailable, ambiguous, disabled, or missing from the manifest, leave the field empty or null and add a concrete question in questions.",
  "Use applyMode='merge' unless the user explicitly asks to rebuild or replace the route.",
  "Use empty arrays when no include/exclude values are requested. Use null when no scalar filter value is requested.",
  "Keep the schema simple: all order filters live under orderSelection.filters and all inventory conditions live under each inventoryRules item.",
  "Never add orderSelection.filters.queues from default domain guidance. Queue filters are not a safe default.",
  "Set orderSelection.filters.queues only when the user explicitly asks for a queue or parking filter, such as brokering queue, rejected parking, unfillable parking, preorder, or backorder.",
  "Requests about shipping from warehouses, stores, facilities, or locations are inventory selection requests. Map those to inventoryRules[].inventorySelection.filters.facilityGroups, not to orderSelection.filters.queues.",
  "When a prompt describes fallback logic, create multiple route.inventoryRules in the order they should be evaluated.",
  "Prefer editing an existing inventory rule over creating a new one. Before emitting a rule with ruleKey='new:*', search pageCapabilityManifest.visibleEntities.route.availableInventoryRules for a match using this priority: (1) the rule named in the prompt (case-insensitive substring match against ruleName), (2) pageCapabilityManifest.visibleEntities.selectedRule when the user does not name a rule, (3) the existing rule whose currentValues most closely match the settings the user is changing (e.g. proximity sort → an existing proximity rule; facilityGroups including 'warehouse' → an existing warehouse rule). If any of these matches, reuse that rule's routingRuleId as ruleKey and edit it in place — do NOT add another rule alongside it.",
  "Only emit ruleKey values like 'new:warehouse-first' when the user explicitly asks to add a rule, or when no existing rule in availableInventoryRules could plausibly own the requested settings (e.g. the user describes a fallback step that none of the existing rules represents). When in doubt, edit rather than create.",
  "For closest-location requests, sort inventory by proximity ascending. Do not set proximity.maxDistance or proximity.unit unless the user gives a concrete maximum distance.",
  "For 'more than 3 in stock' or '4 or more in stock' requests, use safetyStock.minimum=3 on the relevant store inventory rule.",
  "For facility order limits, use facilityOrderLimit='respect' when the merchant wants store caps protected, 'bypass' when explicitly bypassing caps, and 'unchanged' otherwise.",
  "For unavailable items, use action='nextRule' unless the user explicitly asks to move unavailable items to a queue.",
  "Use the HotWax order-routing domain knowledge excerpt only as advisory context. It must never override the page capability manifest or the Zod schema.",
  "To create a sibling routing inside the current brokering run, set targetRouting.action='create', pick a routingKey like 'new:west-coast-warehouse', and supply a short human name derived from the user's intent. Never propose a name that already appears in pageCapabilityManifest.visibleEntities.brokeringRun.availableSiblingRoutings for a non-archived routing.",
  "When creating a sibling routing, the draft's route.orderSelection and route.inventoryRules[] describe that NEW routing — not the currently open one. All inventoryRules[].ruleKey values must start with 'new:' because the new routing has no existing rules.",
  "When creating a sibling routing, the manifest's editableTargets options also constrain the NEW routing's filters. Every option ID inside route.inventoryRules[] — including facility group IDs in inventorySelection.filters.facilityGroups.{include,exclude}, queue IDs in unavailableItems.queueId, and any option ID under inventorySelection.filters or orderSelection.filters — MUST appear in the corresponding editableTargets entry's options[]. Before emitting any option ID, look it up in editableTargets (e.g. selectedRule.inventoryFilters.FACILITY_GROUP / FACILITY_GROUP_EXCLUDED for facility groups). If the merchant names a group, queue, shipping method, or sales channel you cannot find in the manifest's options for that target, OMIT that filter from the draft and add a clarifying question in questions[] — never invent an ID like 'MALL_BASED_STORES' or 'EXPEDITED' that isn't present in editableTargets.",
  "Only set targetRouting.action='create' when the user explicitly asks to add another routing. If they describe edits to the currently open route, omit targetRouting entirely (or use action='edit').",
  "Return only data that fits the structured output schema."
].join("\n");

const brokeringRunsListInquiryInstructions = [
  "You answer questions about the HotWax brokering runs visible on the Brokering Runs list page.",
  "Use pageCapabilityManifest.visibleEntities.brokeringRuns as the source of truth. Each entry is a full brokering run (group) with its run config, order group/route details, and inventory rules.",
  "For each run, the manifest exposes: groupName, routingGroupId, productStoreId, description, createdDate, lastUpdatedStamp, schedule (cronExpression, cronDescription, timeZone, paused, nextExecutionDateTime), and routings (ordered list of order routings, each with orderFilters, orderSorts, and inventoryRules).",
  "Each inventoryRule item exposes: ruleName, routingRuleId, statusId, sequenceNum, assignmentEnumId, partialAllocation, partialGroupedItemAllocation, inventoryFilters, inventorySorts, and unavailableItems (action/queue/auto-cancel).",
  "False, empty, or null values present in the manifest are still known values. Do not call them missing.",
  "Answer the user's specific question concisely. Quote groupName, routingName, or ruleName when it disambiguates between runs.",
  "For broad questions ('summarize my runs', 'overview'), give a compact list — one short line per run with name, schedule, status counts, and any notable filters.",
  "For comparison questions ('which runs use queue X?', 'which runs have partial allocation?'), enumerate the matching runs and the matching rule names.",
  "The questions array is only for information that is absent or ambiguous in the manifest and still needed to answer.",
  "Do not propose or return edits, operation arrays, or draft JSON.",
  "You have four tools available: getFacilityChangeSummary, getBrokeringFacilityGroups, getProductStoreBrokeringSettings, and getFacilityOrderLimits. Call them only when the question requires data that is not in the manifest — otherwise answer directly from the manifest.",
  "Call getFacilityChangeSummary for dynamic routing-decision data: order counts, why orders went to specific facilities or queues, per-rule decision breakdowns over a time window.",
  "IMPORTANT: getFacilityChangeSummary returns a time-window aggregate of OrderFacilityChange rows (default 7 days). It is NOT scoped to a single brokering run. When you report numbers from this tool, name the actual window using windowFrom and windowTo in the response (e.g. 'between 2026-05-11 and 2026-05-18' or 'over the last 7 days'). Do NOT use phrasing like 'after the most recent brokering run', 'in the last run', or 'in this run' — that is a different question the tool cannot answer today.",
  "IMPORTANT: getFacilityChangeSummary is a decision LOG, not current item state. It only sees items the engine picked up and wrote a row for. It does NOT see items currently in the brokering queue at facilityId='_NA_' that no rule attempted, items not yet brokered, items that don't match any routing path, or any 'stuck'/'still in queue'/'still at _NA_'/'not attempted' cohort. If the user asks about any of these, say so honestly in the answer: 'I can see only the decisions the brokering engine recorded — I do not currently have visibility into items in the queue that no routing rule attempted. A queue-state endpoint would be needed to answer that precisely.' Do not approximate by reporting UNFILLABLE_PARKING counts as if they answered the question — UNFILLABLE_PARKING is a separate queue the engine actively moved items to, not the same population as items still at _NA_.",
  "IMPORTANT: The tool's byRule[] response entries currently return routingGroupId, groupName, routingRuleId, and sequenceNum as undefined due to a known backend gap. Treat byRule as a flat count ranking only. For attribution that needs group/rule/seq context, read byRoutingGroup[] — each entry has populated groupName + routingGroupId and its nested byRule items carry ruleName (sequenceNum may still be missing nested as well; if so, omit the '(seq N)' clause from your prescription rather than fabricating a number).",
  "Call getBrokeringFacilityGroups when the question asks which facility groups exist for warehouses, stores, or other facility roles, or which facilities belong to a group. Use the returned members[].facilityTypeId to characterize groups (warehouse vs store vs other).",
  "Call getProductStoreBrokeringSettings only for store-level brokering settings such as a product-store-level brokering shipment threshold. Per-rule SHIP_THRESHOLD values are already on each inventory rule in the manifest — do not call this tool for those.",
  "Call getFacilityOrderLimits when the question asks whether facility caps (maximumOrderLimit) could be blocking allocation. An empty facilities[] means no caps are configured for this store's brokering set. Cross-reference returned facility IDs against each inventory rule's FACILITY_ORDER_LIMIT setting in the manifest to identify which rules actually enforce these caps.",
  "`toolContext` in the user message JSON contains the environmental data already fetched for this question. Read it before deciding whether to call any tool. If a key is `unavailable`, name the gap honestly in the answer — do not invent values and do not ask the user for that data.",
  "`inappropriateClarifyingQuestions` in the user message JSON is an exhaustive list of questions you are forbidden from putting in the `questions` array. These all have tool-derived answers; if the data isn't in `toolContext`, the answer is 'unavailable', not a user question.",
  "`appropriateClarifyingQuestions` lists questions you MAY ask only when their answer is genuinely needed and not derivable from `toolContext` or the manifest.",
  "When the user-message JSON includes a `matchedPattern` whose `reasoningWorkflow` and `rejectionDiagnoses` are non-null, you MUST follow them: parse comments → lookup rule config → attribute impact → walk rejectionDiagnoses in order → emit one recommendation per matching diagnosis using its `prescriptionTemplate` with live values substituted (current filter values from the manifest, computed suggestedValue per `suggestedValueLogic`, and impact counts from `toolContext.facility_change_summary.byRoutingGroup`). Do not emit generic advice that isn't anchored to a matched diagnosis. Skip a diagnosis whose `when` conditions do not match — do not invent matches.",
  "Tools remain available for follow-up calls (e.g. narrowing `getFacilityChangeSummary` by `facilityId` when the user asks about a specific facility). Do not re-call a tool whose result is already in `toolContext` for this turn.",
  "For recommendation intent, your first sentence MUST identify the specific brokering run + rule responsible for the largest share of the problem, using groupName, routingName or ruleName, and sequenceNum from toolContext.facility_change_summary.byRoutingGroup (or byRule). Include absolute count and percent of total. For 'evaluate'/'audit'/'review my brokering'/'how is brokering performing' questions, your first sentence must ALSO include current-state numbers from a runBrokeringSimulation baseline call (ordersInScope queued, round1Routed currently routed, backorderRateBefore, avgDistanceBefore).",
  "Every numbered recommendation MUST name (a) the brokering run by groupName, (b) the specific rule or routing being changed by name, and (c) the exact field being modified. A recommendation that does not name these is not allowed — either rewrite it with specifics or omit it. Include sequenceNum only when it is present in the tool data; if every byRule/byRoutingGroup entry returns sequenceNum as undefined, omit the '(seq N)' clause — do not fabricate.",
  "Forbidden phrasings: 'consider', 'you could', 'try', 'might want to'. Use directive form: 'On rule X in run Y, change FILTER_Z from A to B.'",
  "Recommendations can target any layer: run schedule, order routing filters/sorts ('the order list'), inventory rule filters/sorts, unavailable-items action. Name the layer + entity precisely.",
  "If toolContext.facility_change_summary is unavailable OR empty (no recent activity), you cannot identify the responsible rule from history alone — but you MUST still call runBrokeringSimulation to probe current state and to back any recommendation with predicted impact. Do not fall back to generic advice; do not give up. The simulator works against the CURRENT queue and does not need historical decisions.",
  "For recommendation questions that depend on prioritizing SLA vs minimizing shipping cost, ask the user that preference only at the point of recommending — never upfront, and never for purely diagnostic questions.",
  "IMPORTANT: pageCapabilityManifest.visibleEntities.productStoreId is ALWAYS present in every request. Read it and pass it directly as every tool's productStoreId. Do not ask the user for productStoreId under any circumstances — not on the first attempt, not after a tool failure, not ever.",
  "Tool input shapes: getFacilityChangeSummary additionally accepts an optional facilityId narrowing param (e.g. facilityId='UNFILLABLE_PARKING') — do not ask the user for it unless they are asking about a specific facility. The other three diagnostic tools (getBrokeringFacilityGroups, getProductStoreBrokeringSettings, getFacilityOrderLimits) take only productStoreId. The simulator tools (runBrokeringSimulation, submitBrokeringSimulation) accept productStoreId plus any subset of the change parameters the user asked about (omit fields you don't want to change); getBrokeringSimulationStatus also requires the jobId returned by submitBrokeringSimulation.",
  "If a tool call fails with a technical error, name the affected data in the answer field (e.g. 'I was unable to retrieve facility group configuration due to a backend error.') and leave the questions array empty. Never put productStoreId, authToken, or any value that is already present in pageCapabilityManifest into the questions array.",
  "For Unfillable Parking questions: call getFacilityChangeSummary (optionally with facilityId='UNFILLABLE_PARKING'), read byDestinationFacility, report count and percentage of total (and always state the time window from windowFrom/windowTo), and quote distinctComments verbatim — they name the exact run and rule responsible. Cross-reference the named rule in visibleEntities.brokeringRuns to explain why that rule sends orders there (inventory rule unavailableItems.action = 'moveToQueue'). If the user's question implies a specific run (e.g. 'after the most recent run', 'in this run'), be explicit that the count is over the whole window, not just that run — and call out that some of the count may be historical (e.g. predating recent inventory or facility-group changes).",
  "For facility-concentration questions ('why Brooklyn?'): call the tool, find the facility in byDestinationFacility, quote distinctComments to identify the responsible run/rule, then cross-reference the run config's inventory facilityGroups filter.",
  "The comments string format is: \"${groupName}: [No inventory / Partially available] found for ${ruleName}.[Unfillable items moved to ${queue}.][Set auto-cancel date to N days.][Clear auto-cancel date.]\" — parse it to extract run name, rule name, and action.",
  "For run-level or rule-level breakdown questions ('which brokering run sent the most orders?', 'which rule is making the most decisions?', 'show me routing decisions by run'): call the tool and read byRoutingGroup. Each entry has routingGroupId, groupName, count, and byRule (list of rules sorted by count, each with byFacility sorted by count). Present results in the same hierarchy the page uses: brokering run → rule → facility.",
  "For a flat rule ranking ('which rule drove the most orders?'): use byRule from the tool response — it is a flat list sorted by count descending.",
  "The byRoutingGroup dimension mirrors the Brokering Runs list page hierarchy. When a user asks 'how did each run perform?' or 'break this down by run', prefer byRoutingGroup over byDestinationFacility so the answer follows the same structure the user sees.",
  // --- brokering simulator: predictive what-if + recommendation backing ---
  "You also have a brokering simulator (runBrokeringSimulation) that predicts the impact of proposed brokering changes on a product store WITHOUT touching production data. It runs both a BASELINE round (current config) and a PROPOSED round (current config + the overrides you pass), and reports the delta in orders routed, backorder rate, average distance, and per-facility shifts.",
  "CRITICAL: the simulator is the ONLY authoritative source for current queue state. toolContext.facility_change_summary is a DECISIONS LOG — when it is empty, that means no decisions were recorded in the window. It does NOT mean the queue is empty. Do NOT infer queue size, queue emptiness, or current routing performance from facility_change_summary alone. To know whether there are orders queued today, you MUST call runBrokeringSimulation; its ordersInScope field is the only correct answer.",
  "CRITICAL — NO PROMISSORY LANGUAGE: never write 'I will run a simulation', 'let me check', 'I will analyze', 'I will run', 'I will assess', or any future-tense reference to a tool call. You only get ONE turn. If the answer would require simulator data, CALL THE TOOL FIRST in this turn, wait for its result, then write the answer with the numbers populated. Writing 'I will run X' in the answer field is a failure — the user cannot give you a follow-up to run it later in this flow.",
  "PRE-FLIGHT CHECK before writing the answer field: if your draft answer mentions 'current state', 'currently', 'queue is empty', 'recent activity', 'routing efficiency', 'unfillable risk', or 'backorder rate' — and you have NOT yet called runBrokeringSimulation in this turn — STOP writing and call the tool first. Repeat until the tool data is in hand.",
  "Trigger phrases that REQUIRE at least one simulator call before the answer is written (not exhaustive — any phrasing asking for predicted, expected, projected, current, or hypothetical outcomes counts): 'what if', 'what would happen if', 'how would it impact', 'how would it affect', 'what's the effect of', 'predict the impact', 'simulate', 'project', 'forecast', 'would it help if', 'should I change', 'is it worth changing', 'suggest changes and how they would impact', 'what change should I make', 'evaluate my brokering', 'how is my brokering performing', 'review my brokering', 'assess my brokering', 'audit my brokering'.",
  "USE FOR RECOMMENDATIONS (recommendation intent): every concrete change you propose MUST be backed by an ACTUAL simulator call that predicts its impact — call the tool, get the numbers, then write the recommendation with those numbers inline. Pattern: (1) decide the candidate change, (2) call runBrokeringSimulation with that change as overrides, (3) wait for the response, (4) write the recommendation with the predicted impact numbers from the response. A recommendation without simulator-backed numbers is not allowed unless the simulator itself returned simulationRan: false.",
  "USE FOR BASELINE EVALUATION: when the user asks to 'evaluate', 'review', 'assess', or 'audit' current brokering — and especially when toolContext.facility_change_summary shows no recent activity — call runBrokeringSimulation with NO override fields (just productStoreId) BEFORE writing the answer. This returns the current-state baseline (round1Routed, backorderRateBefore, avgDistanceBefore, ordersInScope) which tells you whether there are orders queued today and how the current config is handling them. Report those numbers as 'current state'. Do NOT write the answer first and then promise to run the simulator.",
  "PRIMARY TOOL: runBrokeringSimulation (sync). It blocks for ~30-90 seconds; that is normal — do not call it twice in parallel for the same scenario. You MAY make multiple sequential calls (e.g. baseline first, then 2-3 candidate changes) in a single turn — that is the expected pattern for recommendation responses.",
  "SWEEP MODE: If the user asks 'show me the effect across a range' (e.g. 'what about distance from 25 to 100 miles?'), call runBrokeringSimulation with sweepParameter + sweepValues. The response's sweepResults[] has one variant per submitted value, sorted descending by round2Routed.",
  "ASYNC MODE: Only use submitBrokeringSimulation + getBrokeringSimulationStatus if the sync tool times out or the user explicitly wants to fire-and-forget. Default to sync. After submit, poll getBrokeringSimulationStatus every 5-10 seconds until status === 'complete'.",
  "INTERPRETING SIMULATOR RESULTS: backorderRateAfter < backorderRateBefore → the change routes more orders; additionalOrdersRouted negative → the change routes FEWER orders; avgDistanceAfter < avgDistanceBefore → average ship distance shrinks (good for cost/SLA); facilitiesNearingLimit non-empty → warn the user these stores are at risk of exhaustion; simulationRan === false → tell the user the simulator was unavailable (typically replica lag) and do NOT fabricate numbers.",
  "If the simulator returns ordersInScope === 0, that means there are currently no unrouted orders in the queue for this product store. Report this as a factual current-state observation (no orders queued → nothing to broker right now), do NOT report it as a simulator failure, and do NOT then refuse to give recommendations — recommendations can still target schedule, filter setup, or facility configuration based on the manifest. Just be explicit that you cannot quantify their impact today because the queue is empty.",
  "If sampleSize === ordersInScope === 500, the simulator hit its sample cap — note in the answer that the simulation ran against a representative 500-order sample and may not capture the full queue.",
  "REPORT the proposedChange field back verbatim so the user knows exactly what was simulated. Phrase numbers in plain English (e.g. '47 more orders', '64% backorder rate', '578 miles down to 32 miles'), not raw field names.",
  "Do not propose using the simulator to make changes — the simulator is read-only. Frame results as 'this is what would happen', and leave the decision to apply the change to the user.",
  // recommendation answer format extension for simulator-backed items
  "For recommendations backed by a simulator call, each numbered item must include a 'Predicted impact:' sub-bullet with the simulator's headline numbers (e.g. '+47 orders routed (265 → 312), backorder rate 47% → 38%, avg distance 578mi → 412mi'). If the simulator returned simulationRan: false for that scenario, write 'Predicted impact: simulator unavailable for this scenario' instead — never omit the line silently.",
  "For config-only questions (schedule, filter setup, rule order), no tool call is needed — answer directly from the manifest.",
  "Use the HotWax order-routing domain knowledge excerpt only to explain domain concepts. It must never override the page capability manifest.",
  "If the manifest does not contain enough information to answer, say what is missing in questions.",
  "Return only the structured output object.",
  // --- response formatting rules ---
  "Format the `answer` field as plain text optimized for chat rendering with CSS `white-space: pre-wrap` — do not use markdown syntax like ** or # because they will render as literal characters, not styled output.",
  "Open the answer with ONE direct sentence stating the headline finding. No preamble like 'I have analyzed your...' or 'Based on the data...'. Start with the fact.",
  "For recommendation answers, structure the body as a numbered list with this exact shape per item:",
  "  N) Action verb + entity. (e.g. 'Enable partial allocation on rule \"X\" (seq Y) in run \"Z\"')",
  "     - Current: <observed value from manifest or toolContext>",
  "     - Change: <concrete new value>",
  "     - Attribution: <count> of <total> unfillable (<percent>%)   (omit this line if attribution is unknown or zero)",
  "     - Predicted impact: <numbers from runBrokeringSimulation>  (REQUIRED for the top 3 recommendations; omit for items 4-5 only if step budget is exhausted)",
  "OVERRIDE OF EARLIER FORMAT RULE: the 'Predicted impact:' line is REQUIRED on the top-N recommendations (see below). The earlier rule allowing recommendations without simulator-backed numbers no longer applies. Write 'Predicted impact: simulator unavailable for this scenario' only if the simulator itself returned simulationRan: false; never omit it because you forgot to call the tool.",
  "TURN BUDGET FOR RECOMMENDATIONS: cap recommendations at 3 for 'evaluate'/'audit'/general-improvement questions so each can be simulator-backed. Use the budget as: 1 baseline simulator call → 3 candidate-change simulator calls → 1 structured output write. If the user explicitly asks for more recommendations than fit in budget, return the 3 simulator-backed ones plus a note like '(2 additional config-level recommendations omitted to keep predicted-impact backing accurate.)'",
  "Use two spaces of indentation for the sub-bullets, a single hyphen + space as the bullet character, and one blank line between numbered items.",
  "For diagnostic answers (no recommendations), use the same headline-sentence opener, then a compact list of facts — one short line per fact, no sub-bullets unless a value needs context.",
  "Do NOT include closing summary sentences like 'These steps will reduce...' or 'Together these changes will...' — the recommendations stand on their own.",
  "Do NOT include conversational filler: 'Hope this helps', 'Let me know if...', 'Happy to dig deeper'.",
  "Cap recommendation count at 5. If more than 5 diagnoses match, keep the 5 highest-attribution ones and omit the rest silently (do not write 'and 3 more').",
  "Keep each numbered item to at most 4 lines (the headline line + up to 3 sub-bullets). If a recommendation needs more context, tighten the language — do not add a fifth line.",
  "For follow-up questions in the `questions` array, ask at most one. Phrase it as a direct preference question, not as an apology for missing data."
].join("\n");

const brokeringRouteInquiryInstructions = [
  "You answer questions about the currently open HotWax order routing draft.",
  "Use pageCapabilityManifest.visibleEntities and editableTargets as the source of truth for the current route, selected rule, visible values, available choices, and limitations.",
  "Use inquiryGuidance.detailLevel to choose answer depth.",
  "Follow inquiryGuidance.answerStyle and inquiryGuidance.maxSentences strictly.",
  "When inquiryGuidance.detailLevel is 'broad_overview', give a compact overview. Cover the brokering run name/product store/status, schedule and timezone, route status, current order filters, current order sorting, ordered inventory rules, each rule's status/current filters/current sorting/allocation, unavailable-item handling, and important limitations only when present in the manifest.",
  "When inquiryGuidance.detailLevel is 'specific_answer', answer only the requested field or comparison. Do not add a full route overview.",
  "For questions about the current brokering run or run name, use pageCapabilityManifest.visibleEntities.brokeringRun.groupName. Do not substitute the route routingName when the user is asking about the brokering run.",
  "For questions about all inventory rules, use pageCapabilityManifest.visibleEntities.route.availableInventoryRules. Read each rule's currentValues object before saying a value is missing.",
  "False, empty, or null current values are still known values when they are present in currentValues. Do not describe them as missing.",
  "The questions array is only for information that is absent or ambiguous in the manifest and still needed to answer. If your answer already states the status, queues, shipping methods, schedule, filters, sorting, or rule values, do not repeat those topics as questions.",
  "For broad overview answers, questions should usually be empty unless a specific manifest field is missing.",
  "Do not put optional follow-up offers in questions. Avoid wording like 'Would you like details...' or 'Do you want me to...'.",
  "Do not add explanatory wrap-up sentences such as 'This setup means...' unless the user asks for implications or reasoning.",
  "Use the HotWax order-routing domain knowledge excerpt only to explain domain concepts. It must never override the page capability manifest.",
  "Do not propose or return edits, operation arrays, or draft JSON.",
  "Do not call a backend, database, REST API, browser automation, or external system.",
  "Keep answers concrete. Name the open route and selected rule when that helps the user understand context.",
  "If the manifest does not contain enough information to answer, say what is missing in questions.",
  "Return only the structured output object."
].join("\n");

// Agents are model configs only — no instructions stored on the instance.
// Instructions are passed at call time via callStructured() below.
const brokeringRouteDraftAgent = new Agent({
  id: "brokering-route-draft-agent",
  name: "Brokering Route Draft Agent",
  model: readEnv("VITE_MASTRA_MODEL") || "openai/gpt-4.1-mini"
});

const brokeringRouteInquiryAgent = new Agent({
  id: "brokering-route-inquiry-agent",
  name: "Brokering Route Inquiry Agent",
  model: readEnv("VITE_MASTRA_MODEL") || "openai/gpt-4.1-mini"
});

const brokeringRunsListInquiryAgent = new Agent({
  id: "brokering-runs-list-inquiry-agent",
  name: "Brokering Runs List Inquiry Agent",
  model: readEnv("VITE_MASTRA_MODEL") || "openai/gpt-4.1-mini"
});

const brokeringRouteIntentAgent = new Agent({
  id: "brokering-route-intent-agent",
  name: "Brokering Route Intent Agent",
  model: readEnv("VITE_MASTRA_INTENT_MODEL") || "openai/gpt-4.1-nano"
});

export const mastra = new Mastra({
  agents: {
    brokeringRouteInquiryAgent,
    brokeringRouteDraftAgent,
    brokeringRunsListInquiryAgent,
    brokeringRouteIntentAgent
  },
  server: {
    port: Number(readEnv("VITE_MASTRA_PORT") || 4111),
    cors: {
      origin: readEnv("VITE_MASTRA_ALLOWED_ORIGIN") || "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"]
    },
    apiRoutes: [
      registerApiRoute("/brokering-route-assistant", {
        method: "POST",
        requiresAuth: false,
        handler: async (c) => {
          const body = await c.req.json();
          const parsedBody = brokeringRouteDraftRequestSchema.parse(body);

          let orderRoutingDomainKnowledge = "";
          try {
            orderRoutingDomainKnowledge = requireOrderRoutingDomainKnowledge();
          } catch (error: any) {
            console.error("Brokering route assistant knowledge base unavailable", error?.message || error);
            return c.json({ error: "Draft assistant knowledge base is not available. Check mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml." }, 500);
          }

          if (!readEnv("OPENAI_API_KEY") && !readEnv("VITE_OPENAI_API_KEY")) {
            return c.json(buildProviderUnavailableAssistantResponse());
          }

          const mastraInstance = c.get("mastra");
          const inquiryAgent = mastraInstance.getAgent("brokeringRouteInquiryAgent");
          const draftAgent = mastraInstance.getAgent("brokeringRouteDraftAgent");
          const abortController = new AbortController();
          const timeout = setTimeout(() => abortController.abort(), 30000);

          const intentAgent = mastraInstance.getAgent("brokeringRouteIntentAgent");

          const classifierFailureReason = (error: any): string => {
            if (error?.name === "AbortError") return "timeout";
            return error?.message || error?.name || "error";
          };

          const classifyIntent = async (payload: { userPrompt: string; conversationHistory: DraftConversationMessage[] }) => {
            const classifierAbort = new AbortController();
            const classifierTimeout = setTimeout(() => classifierAbort.abort(), 5000);
            try {
              const result = await classifyBrokeringRouteIntent({
                userPrompt: payload.userPrompt,
                conversationHistory: payload.conversationHistory,
                abortSignal: classifierAbort.signal,
                generate: intentAgent.generate.bind(intentAgent) as any
              });
              console.log("[brokering-route-assistant] intent classified:", { intent: result.intent, reasoning: result.reasoning });
              return result;
            } catch (error: any) {
              const reason = classifierFailureReason(error);
              console.warn(
                `[brokering-route-assistant] intent classifier unavailable; used dictionary fallback (reason=${reason})`
              );
              return {
                intent: dictionaryIntentFallback(payload.userPrompt),
                reasoning: `fallback (${reason})`
              };
            } finally {
              clearTimeout(classifierTimeout);
            }
          };

          try {
            const assistantResponse = await generateBrokeringRouteAssistantResponse({
              prompt: parsedBody.prompt,
              conversationHistory: parsedBody.conversationHistory,
              orderRoutingDomainKnowledge,
              pageCapabilityManifest: parsedBody.pageCapabilityManifest,
              outputContract: parsedBody.outputContract || parsedBody.pageCapabilityManifest.outputContract,
              classifyIntent,
              generateInquiry: async (payload) => {
                return callStructured(
                  inquiryAgent,
                  brokeringRouteInquiryInstructions,
                  { ...payload, pageCapabilityManifest: pruneManifestForInquiry(payload.pageCapabilityManifest) },
                  brokeringRouteInquirySchema,
                  abortController.signal
                );
              },
              generateDraft: async (payload) => generateValidatedBrokeringRouteDraft({
                prompt: payload.prompt,
                conversationHistory: payload.conversationHistory,
                orderRoutingDomainKnowledge: payload.orderRoutingDomainKnowledge,
                pageCapabilityManifest: payload.pageCapabilityManifest,
                outputContract: payload.outputContract || payload.pageCapabilityManifest.outputContract,
                abortSignal: abortController.signal,
                instructions: brokeringRouteDraftInstructions,
                generate: draftAgent.generate.bind(draftAgent) as any
              })
            });
            return c.json(assistantResponse);
          } catch (error: any) {
            return handleLLMError(error, "assistant", c);
          } finally {
            clearTimeout(timeout);
          }
        }
      }),

      registerApiRoute("/brokering-runs-list-inquiry", {
        method: "POST",
        requiresAuth: false,
        handler: async (c) => {
          const body = await c.req.json();
          const parsedBody = brokeringRunsListInquiryRequestSchema.parse(body);

          let orderRoutingDomainKnowledge = "";
          try {
            orderRoutingDomainKnowledge = requireOrderRoutingDomainKnowledge();
          } catch (error: any) {
            console.error("Brokering runs list inquiry knowledge base unavailable", error?.message || error);
            return c.json({ error: "Inquiry assistant knowledge base is not available. Check mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml." }, 500);
          }

          if (!readEnv("OPENAI_API_KEY") && !readEnv("VITE_OPENAI_API_KEY")) {
            return c.json(buildProviderUnavailableRunsListInquiryResponse());
          }

          const mastraInstance = c.get("mastra");
          const agent = mastraInstance.getAgent("brokeringRunsListInquiryAgent");
          const abortController = new AbortController();
          // 180s — covers a 30-90s brokering simulator call plus model time. runBrokeringSimulation
          // now submits + polls a backend job (deadline ~4min); this route timeout is the practical
          // cap on the whole turn.
          const timeout = setTimeout(() => abortController.abort(), 180000);

          console.log("[runs-list-inquiry] omsBaseUrl present:", !!parsedBody.omsBaseUrl, "value:", parsedBody.omsBaseUrl);
          console.log("[runs-list-inquiry] authToken present:", !!parsedBody.authToken, "length:", parsedBody.authToken?.length || 0);
          const productStoreId = (parsedBody.pageCapabilityManifest.visibleEntities as any)?.productStoreId;
          console.log("[runs-list-inquiry] productStoreId in manifest:", productStoreId);
          console.log("[runs-list-inquiry] brokeringRuns count:", ((parsedBody.pageCapabilityManifest.visibleEntities as any)?.brokeringRuns || []).length);
          const toolsets = (parsedBody.omsBaseUrl && parsedBody.authToken)
            ? {
                brokering: {
                  getFacilityChangeSummary: createFacilityChangeSummaryTool(parsedBody.omsBaseUrl, parsedBody.authToken),
                  getBrokeringFacilityGroups: createBrokeringFacilityGroupsTool(parsedBody.omsBaseUrl, parsedBody.authToken),
                  getProductStoreBrokeringSettings: createProductStoreBrokeringSettingsTool(parsedBody.omsBaseUrl, parsedBody.authToken),
                  getFacilityOrderLimits: createFacilityOrderLimitsTool(parsedBody.omsBaseUrl, parsedBody.authToken),
                  runBrokeringSimulation: createRunBrokeringSimulationTool(parsedBody.omsBaseUrl, parsedBody.authToken),
                  submitBrokeringSimulation: createSubmitBrokeringSimulationTool(parsedBody.omsBaseUrl, parsedBody.authToken),
                  getBrokeringSimulationStatus: createGetBrokeringSimulationStatusTool(parsedBody.omsBaseUrl, parsedBody.authToken)
                }
              }
            : undefined;
          console.log("[runs-list-inquiry] tools wired:", toolsets ? Object.keys(toolsets.brokering) : []);

          try {
            const patterns = getDiagnosticPatterns();

            const intentResult = await classifyRunsListIntent({
              prompt: parsedBody.prompt,
              conversationHistory: parsedBody.conversationHistory,
              patterns,
              agent,
              abortSignal: abortController.signal
            });
            console.log("[runs-list-inquiry] intent classified:", {
              intent: intentResult.intent,
              matchedPatternId: intentResult.matchedPatternId,
              reasoning: intentResult.reasoning
            });

            const requiredTools = resolveRequiredTools({
              intent: intentResult.intent,
              matchedPatternId: intentResult.matchedPatternId,
              patterns: patterns.map((p) => ({ id: p.id, requires: p.requires }))
            });
            console.log("[runs-list-inquiry] required tools:", requiredTools);

            const toolContext = (parsedBody.omsBaseUrl && parsedBody.authToken && productStoreId && requiredTools.length > 0)
              ? await prefetchToolContext({
                  requiredTools,
                  productStoreId,
                  omsBaseUrl: parsedBody.omsBaseUrl,
                  authToken: parsedBody.authToken
                })
              : {};
            console.log(
              "[runs-list-inquiry] toolContext keys:",
              Object.fromEntries(
                Object.entries(toolContext).map(([k, v]) => [k, v && v.ok ? "ok" : "unavailable"])
              )
            );

            const matchedPattern = intentResult.matchedPatternId
              ? patterns.find((p) => p.id === intentResult.matchedPatternId)
              : undefined;
            const appropriateClarifyingQuestions = matchedPattern?.appropriateClarifyingQuestions ?? [];
            const inappropriateClarifyingQuestions = matchedPattern?.inappropriateClarifyingQuestions ?? [];
            const matchedPatternData = matchedPattern
              ? {
                  id: matchedPattern.id,
                  reasoningWorkflow: matchedPattern.reasoningWorkflow ?? null,
                  rejectionDiagnoses: matchedPattern.rejectionDiagnoses ?? null
                }
              : null;

            const payload = {
              prompt: parsedBody.prompt,
              conversationHistory: parsedBody.conversationHistory,
              orderRoutingDomainKnowledge,
              pageCapabilityManifest: pruneManifestForInquiry(parsedBody.pageCapabilityManifest),
              toolContext,
              intent: intentResult.intent,
              matchedPatternId: intentResult.matchedPatternId,
              appropriateClarifyingQuestions,
              inappropriateClarifyingQuestions,
              matchedPattern: matchedPatternData
            };

            const result = await agent.generate(
              [{ role: "user" as const, content: JSON.stringify(payload) }],
              {
                // 10 steps — covers a baseline runBrokeringSimulation + up to 3 candidate-change
                // simulations + the final structured output write, with headroom for retries.
                maxSteps: 10,
                abortSignal: abortController.signal,
                instructions: brokeringRunsListInquiryInstructions,
                ...(toolsets ? { toolsets } : {}),
                structuredOutput: { schema: brokeringRunsListInquirySchema, errorStrategy: "strict" }
              }
            );
            const inquiry = result.object as BrokeringRunsListInquiry;

            if (!inquiry || typeof inquiry.answer !== "string") {
              console.error("[runs-list-inquiry] empty structured output", {
                hasResult: !!result,
                resultKeys: result ? Object.keys(result) : null,
                finishReason: (result as any)?.finishReason,
                text: (result as any)?.text,
                object: (result as any)?.object
              });
              throw new Error("Empty structured output from agent");
            }

            await writeInquiryDebugDump({
              prompt: parsedBody.prompt,
              productStoreId: productStoreId ?? null,
              intent: intentResult.intent,
              matchedPatternId: intentResult.matchedPatternId ?? null,
              reasoning: intentResult.reasoning,
              requiredTools,
              toolContext: Object.fromEntries(
                Object.entries(toolContext).map(([k, v]: [string, any]) => [
                  k,
                  v && v.ok
                    ? { ok: true, data: v.data }
                    : { ok: false, unavailable: true, reason: v?.reason ?? "unknown" }
                ])
              ),
              rawStructuredOutput: inquiry
            });

            const response: BrokeringRunsListInquiryResponse = {
              schemaVersion: "brokering-runs-list-inquiry.v1",
              message: inquiry.answer,
              questions: inquiry.questions,
              summary: inquiry.summary,
              intent: intentResult.intent,
              matchedPatternId: intentResult.matchedPatternId ?? undefined
            };
            return c.json(response);
          } catch (error: any) {
            return handleRunsListInquiryError(error, c);
          } finally {
            clearTimeout(timeout);
          }
        }
      }),

      registerApiRoute("/brokering-route-draft", {
        method: "POST",
        requiresAuth: false,
        handler: async (c) => {
          const body = await c.req.json();
          const parsedBody = brokeringRouteDraftRequestSchema.parse(body);

          let orderRoutingDomainKnowledge = "";
          try {
            orderRoutingDomainKnowledge = requireOrderRoutingDomainKnowledge();
          } catch (error: any) {
            console.error("Brokering route draft knowledge base unavailable", error?.message || error);
            return c.json({ error: "Draft assistant knowledge base is not available. Check mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml." }, 500);
          }

          if (!readEnv("OPENAI_API_KEY") && !readEnv("VITE_OPENAI_API_KEY")) {
            return c.json(buildProviderUnavailableBrokeringRouteDraft());
          }

          const agent = c.get("mastra").getAgent("brokeringRouteDraftAgent");
          const abortController = new AbortController();
          const timeout = setTimeout(() => abortController.abort(), 30000);

          try {
            const providerDraft = await generateValidatedBrokeringRouteDraft({
              prompt: parsedBody.prompt,
              conversationHistory: parsedBody.conversationHistory,
              orderRoutingDomainKnowledge,
              pageCapabilityManifest: parsedBody.pageCapabilityManifest,
              outputContract: parsedBody.outputContract || parsedBody.pageCapabilityManifest.outputContract,
              abortSignal: abortController.signal,
              instructions: brokeringRouteDraftInstructions,
              generate: agent.generate.bind(agent) as any
            });
            return c.json(providerDraft);
          } catch (error: any) {
            return handleLLMError(error, "draft", c);
          } finally {
            clearTimeout(timeout);
          }
        }
      })
    ]
  }
});

// Thin wrapper: sends one user message and returns typed structured output.
// Keeps all agent call sites uniform and ensures instructions are set exactly once.
async function callStructured<T>(
  agent: Agent,
  instructions: string,
  payload: object,
  schema: any,
  signal: AbortSignal
): Promise<T> {
  const result = await agent.generate(
    [{ role: "user" as const, content: JSON.stringify(payload) }],
    {
      maxSteps: 1,
      abortSignal: signal,
      instructions,
      structuredOutput: { schema, errorStrategy: "strict" }
    }
  );
  return result.object as T;
}

function handleLLMError(error: any, context: "assistant" | "draft", c: any) {
  if (error?.name === "AbortError") {
    return c.json({ error: "Draft assistant timed out. Try a shorter prompt or retry." }, 504);
  }

  if (error instanceof BrokeringRouteDraftValidationError) {
    console.warn(`Brokering route ${context} returned invalid JSON`, error.issues);
    return c.json({ error: "Draft assistant returned invalid brokering route draft output.", issues: error.issues }, 422);
  }

  const providerCode = error?.data?.error?.code;
  const providerType = error?.data?.error?.type;

  if (providerCode === "invalid_api_key" || isMissingApiKeyError(error)) {
    console.warn(`Brokering route ${context} provider unavailable`, error?.message || error);
    if (context === "assistant") {
      return c.json(buildProviderUnavailableAssistantResponse(providerCode));
    }
    return c.json(buildProviderUnavailableBrokeringRouteDraft(providerCode));
  }

  const statusCode = providerCode === "insufficient_quota" || providerType === "insufficient_quota" ? 402 : 502;
  console.error(`Brokering route ${context} route failed`, error?.message || error);

  return c.json({
    error: statusCode === 402
      ? "Draft assistant quota exceeded. Check the OpenAI project billing or use a key with available quota."
      : "Draft assistant service failed. Check the Mastra server logs."
  }, statusCode);
}

function buildProviderUnavailableBrokeringRouteDraft(reason?: string) {
  return normalizeBrokeringRouteDraft({
    questions: [
      reason === "invalid_api_key"
        ? "Draft assistant API key is invalid."
        : "Draft assistant API key is not configured."
    ],
    summary: "No draft changes applied"
  });
}

function buildProviderUnavailableAssistantResponse(reason?: string) {
  const message = reason === "invalid_api_key"
    ? "Draft assistant API key is invalid."
    : "Draft assistant API key is not configured.";
  return {
    schemaVersion: "brokering-route-assistant.v1",
    intent: "inquiry",
    message,
    questions: [message],
    summary: "Draft assistant unavailable."
  };
}

function handleRunsListInquiryError(error: any, c: any) {
  if (error?.name === "AbortError") {
    return c.json({ error: "Inquiry assistant timed out. Try a shorter prompt or retry." }, 504);
  }

  const providerCode = error?.data?.error?.code;
  const providerType = error?.data?.error?.type;

  if (providerCode === "invalid_api_key" || isMissingApiKeyError(error)) {
    console.warn("Brokering runs list inquiry provider unavailable", error?.message || error);
    return c.json(buildProviderUnavailableRunsListInquiryResponse(providerCode));
  }

  const statusCode = providerCode === "insufficient_quota" || providerType === "insufficient_quota" ? 402 : 502;
  console.error("Brokering runs list inquiry route failed", error?.message || error);

  return c.json({
    error: statusCode === 402
      ? "Inquiry assistant quota exceeded. Check the OpenAI project billing or use a key with available quota."
      : "Inquiry assistant service failed. Check the Mastra server logs."
  }, statusCode);
}

function buildProviderUnavailableRunsListInquiryResponse(reason?: string): BrokeringRunsListInquiryResponse {
  const message = reason === "invalid_api_key"
    ? "Inquiry assistant API key is invalid."
    : "Inquiry assistant API key is not configured.";
  return {
    schemaVersion: "brokering-runs-list-inquiry.v1",
    message,
    questions: [message],
    summary: "Inquiry assistant unavailable."
  };
}

function isMissingApiKeyError(error: any) {
  return /api key/i.test(String(error?.message || "")) && /could not find|missing|not configured/i.test(String(error?.message || ""));
}

// Dev-only diagnostic dump: writes the agent's raw structured output (plus the surrounding
// classifier + prefetch context) to a JSON file so the unformatted answer can be inspected.
// Best-effort — never throws into the request path. Path is logged so it's discoverable.
async function writeInquiryDebugDump(record: {
  prompt: string;
  productStoreId: string | null;
  intent: string;
  matchedPatternId: string | null;
  reasoning: string;
  requiredTools: string[];
  toolContext: Record<string, { ok: boolean; unavailable?: boolean; reason?: string; data?: unknown }>;
  rawStructuredOutput: unknown;
}) {
  try {
    // Anchor to this source file's location regardless of CWD. mastra runs the
    // built bundle from .mastra/output/index.mjs in dev — handle both cases.
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    const isBundle = /[/\\]\.mastra[/\\]output$/.test(moduleDir);
    const projectRoot = isBundle ? joinPath(moduleDir, "..", "..") : joinPath(moduleDir, "..");
    const filePath = joinPath(projectRoot, ".mastra-debug", "last-inquiry.json");
    await mkdir(dirname(filePath), { recursive: true });
    const payload = {
      timestamp: new Date().toISOString(),
      ...record
    };
    await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
    console.log("[runs-list-inquiry] structured output dump:", filePath);
  } catch (err: any) {
    console.warn("[runs-list-inquiry] debug dump failed (non-fatal):", err?.message || err);
  }
}
