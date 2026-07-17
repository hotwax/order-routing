# Refactor Migration Plan

Aligns the codebase with the standard layer conventions used across other apps:
- **`services/`** — external API calls, payload preparation, response processing only
- **`store/`** — Pinia state management
- **`util/`** — pure functions, no side effects
- **`composables/`** — reactive logic tied to Vue refs
- **`types/`** — all TypeScript types and interfaces

---

## 1. Types — move to `src/types/`

### `types/simulation.ts` (expand existing)

| Type | Source file | Reason |
|---|---|---|
| `JobOutcome` | `services/SimulationService.ts` | Domain type, not service implementation |
| `SubmitBatchArgs` | `services/SimulationService.ts` | Domain type, not service implementation |
| `PastSimulationsFilters` | `services/SimulationService.ts` | Domain type, not service implementation |
| `StorageLike` | `services/SimulationHistoryCache.ts` AND `services/SimulationJobStore.ts` | Duplicated interface — one definition in types |
| `PastSimHeader` | `services/SimulationHistoryCache.ts` | Domain type |
| `DetailEntry` | `services/SimulationHistoryCache.ts` | Domain type |
| `SimJobRecord` | `services/SimulationJobStore.ts` | Domain type |

### `types/variation.ts` (expand existing)

| Type | Source file | Reason |
|---|---|---|
| `VariationConditionInput` | `services/VariationService.ts` | Input shape, belongs with other variation types |
| `VariationActionInput` | `services/VariationService.ts` | Input shape, belongs with other variation types |

### `types/circuit.ts` (expand existing — currently has only `BrokeringRunsListInquiryResult`)

| Type | Source file | Reason |
|---|---|---|
| `ChatThread` | `services/CircuitStorageService.ts` | Domain type |
| `ChatMessage` | `services/CircuitStorageService.ts` | Domain type |
| `DraftFeedbackRecord` | `services/CircuitStorageService.ts` | Domain type |
| `DraftFeedbackType` | `util/circuitFeedback.ts` | Type embedded in util file |
| `DraftFeedbackProposalSummary` | `util/circuitFeedback.ts` | Type embedded in util file |
| `KnowledgeFeedbackMessage` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `KnowledgeFeedbackContext` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `CorrectionCategory` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `EditOp` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `EditDescription` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `ProposalPayload` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `CarriedProposal` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `ProposalErrorStage` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `ProposalResult` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `ApproveErrorStage` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `ApproveResult` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `SuggestPromptErrorStage` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `SuggestPromptRequest` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `SuggestPromptResult` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `ProposeRequest` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `RefineRequest` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |
| `ApproveRequest` | `services/CircuitKnowledgeFeedbackService.ts` | Domain type |

### `types/draft.ts` (NEW file)

All from `services/DraftAssistantService.ts`. The service file is 1251 lines because it holds both the API call logic and all the type definitions. Extracting types alone will shrink it significantly.

| Type | Reason |
|---|---|
| `DraftValue` | Domain type |
| `DraftOperationReason` | Domain type |
| `DraftOperation` | Domain type |
| `DraftConversationMessage` | Domain type |
| `DraftOperationSet` | Domain type |
| `BrokeringRouteDraft` | Domain type |
| `DraftProposal` | Domain type |
| `DraftValueType` | Domain type |
| `DraftOption` | Domain type |
| `DraftTargetDependency` | Domain type |
| `DraftTargetCapability` | Domain type |
| `PageCapabilityManifest` | Domain type |
| `DraftValidationResult` | Domain type |
| `DraftApplyResult` | Domain type |
| `DraftTargetBinding` | Domain type |
| `DraftTargetBindings` | Domain type |
| `ApplyDraftProposalContext` | Domain type |

### `types/index.ts` (expand existing)

| Type | Source file | Reason |
|---|---|---|
| `RoutingRequest` | `services/RoutingGroupService.ts` | Type alias used across OMS and sim paths |

---

## 2. Pure functions — move to `src/util/`

### `util/simConfig.ts` (NEW file)

The same "read URL from env" function exists in three service files under three different names. This is the worst kind of duplication because they will silently drift.

| Function | Source file | Name there |
|---|---|---|
| `simApiName(env?)` | `services/SimulationService.ts` | `simApiName` |
| `simProductStoreId(env?)` | `services/SimulationService.ts` | `simProductStoreId` |
| `simBaseURL(env?)` | `services/SimulationService.ts` | `simBaseURL` |
| `simApiBaseUrl(env?)` | `services/SimulationService.ts` | `simApiBaseUrl` |
| `simRoutingApiBaseUrl(env?)` | `services/SimulationService.ts` | `simRoutingApiBaseUrl` |
| `simMoquiUrl(env?)` | `services/SimulationService.ts` | `simMoquiUrl` (since removed entirely; no successor in `simConfig.ts`) |
| `mastraUrl(env?)` | `services/CircuitKnowledgeFeedbackService.ts` | `resolveMastraUrl` |
| — | `services/BrokeringRunsAssistantService.ts` | `getMastraUrl` |

`resolveMastraUrl` and `getMastraUrl` are the same function. Consolidate to one `mastraUrl()` export in `simConfig.ts` and update all callers.

### `util/simulationCompute.ts` (NEW — merge of 3 files + additions)

**Merge these files in full:**
- `util/simulationDiff.ts` (`buildVariant`, `isNoOp`, `applyProductStoreId`)
- `util/simulationBatch.ts` (`chunkVariants`, `mergeVariationResults`)
- `util/progressBuffer.ts` (`mergeEvents` — 9-line file)

**Add from `services/SimulationService.ts`:**

| Function | Reason moved |
|---|---|
| `interpretJobStatus(resp)` | Pure switch-case, no API call. Already tested independently in tests/ |
| `pastSimulationsQuery(f)` | Pure function: builds `{url, params}` from a filter object. No network. |
| `isFilteredQuery(f)` | One-liner boolean check. Pure function. |

### `util/variationUtils.ts` (NEW — merge of 3 files)

**Merge these files in full:**
- `util/variationConfigAdapter.ts` (`toConfigPayload`, `fromVariationRoutings`)
- `util/variationTree.ts` (`buildRoutingNameMap`, `sortBySequence`)
- `util/routingResultJoin.ts` (`joinRoutingResults`)

### `util/simulationResults.ts` (NEW — merge of 3 files)

**Merge these files in full:**
- `util/outcomes.ts` (`classifyOutcome`, `scoreOutcome`, `formatOutcome`)
- `util/traceRollup.ts` (`rollupTrace` and helpers)
- `util/persistedSimulationAdapter.ts` (`persistedSimulationAdapter`)

### `util/draftUtils.ts` (NEW file)

`DraftAssistantService.ts` is 1251 lines. After moving types to `types/draft.ts`, the remaining bulk is pure conversion, validation, and formatting logic — none of it makes API calls. These all move to `util/draftUtils.ts`.

| Function | Reason moved |
|---|---|
| `buildDraftTarget(target)` | Pure object builder |
| `createDraftOutputContract()` | Pure object builder |
| `toDraftOptions(options, labelFields)` | Pure data transform |
| `createDraftTargetBindings(bindings)` | Pure index builder, no Vue reactivity |
| `validateDraftOperations(operations, manifest)` | Pure validation, no API |
| `convertBrokeringRouteDraftToOperations(draft, manifest)` | Pure conversion |
| `createDraftProposal(plan, manifest)` | Pure object builder |
| `applyDraftOperations(operations, manifest, bindings)` | Executes bindings, no API call |
| `summarizeDraftOperations(operations, manifest)` | Pure formatter |
| `formatDraftProposalSections(...)` | Pure formatter |
| All private helpers (`filterAnsweredQuestions`, `buildInquiryAnswerHints`, `humanizeStatus`, `questionIsAnsweredByOperation`, `answeredQuestionHints`, `targetSpecificAnsweredQuestionHints`, `addSelectedRuleOperations`, `addOptionSelectionOperations`, `addFacilityOrderLimitOperation`, `addUnavailableItemOperations`, `getRuleCurrentValue`, `buildOperationMetadata`, `valueForTarget`, `isEmptyDraftValue`, `normalizeConversationHistory`, and all others) | Support the above pure functions |

After this extraction, `DraftAssistantService.ts` retains only:
- `requestBrokeringRouteDraftOperations()` — POST to Mastra
- `applyDraftProposal()` — coordinates apply + feedback

### `util/brokeringRulesManifest.ts` (NEW — replaces draftTargets)

From `draftTargets/BrokeringRulesDraftTargets.ts`:
- `buildBrokeringRulesManifest(input)` + all private `summarize*` helpers

These are pure functions: input data in, `PageCapabilityManifest` JSON out. No Vue reactivity.

Also absorb `draftTargets/BrokeringAgentSnapshot.ts`:
- `buildBrokeringAgentSnapshot(refData?)` — reads Pinia stores, returns a plain object snapshot

### `util/brokeringRunsManifest.ts` (NEW — replaces draftTargets)

From `draftTargets/BrokeringRunsListTargets.ts`:
- `buildBrokeringRunsListManifest(input)` + all private helpers

Pure function: builds manifest for the BrokeringRuns list page.

---

## 3. Composables — move to `src/composables/`

### `composables/useBrokeringRulesDraft.ts` (NEW)

From `draftTargets/BrokeringRulesDraftTargets.ts`:
- `buildBrokeringRulesBindings(draft: BrokeringRulesDraftRefs)` + all private `apply*` helpers

This is reactive logic: it takes Vue `refs` and returns `setValue()` functions that write back to those refs when Circuit returns draft operations. It belongs in a composable, not a util (utils must be side-effect free).

---

## 4. Services — merge and slim

### `services/simulationStorage.ts` (NEW — merge of 2 files, then delete both)

**Merge:**
- `services/SimulationHistoryCache.ts` — localStorage cache for past simulation headers/details
- `services/SimulationJobStore.ts` — localStorage persistence for in-flight simulation jobs

**Why:** Both files define an identical `StorageLike` interface and an identical `defaultStorage()` function. Same concern (localStorage persistence for simulation data), same pattern, different TTLs.

After merge, `StorageLike` type goes to `types/simulation.ts` (one definition shared by both former files).

### `services/BrokeringRunsAssistantService.ts` — DELETE

Absorb its single function (`requestBrokeringRunsListInquiry`) into `services/DraftAssistantService.ts`. Both call the explicitly enabled Circuit origin with prompt + manifest data only. Browser OMS URLs and bearer tokens must never be forwarded; OMS tools require reviewed server-side authentication. Consolidate URL validation in `utils/simConfig.ts`.

### `services/CircuitDraftFeedbackService.ts` — DELETE

4-line re-export stub: `export * from "@/util/circuitFeedback"`. Was moved to util but the shim was left. Update any callers that still import from this path to import from `@/util/circuitFeedback` directly, then delete the file.

---

## 5. Stores — merge

### `store/simulationStore.ts` absorbs `store/variationStore.ts`

**Why:** Both import the same 5+ functions from `VariationService` (`listVariations`, `createVariation`, `getVariation`, `replaceVariationConfig`, `runVariation`). Both manage state for the Simulation view. Variation IDs and results flow between them — they are two halves of the same domain. After merge, use clearly named sections: `// --- Routing group ---`, `// --- Variations (H2 persisted what-if) ---`, `// --- Live batch run ---`.

**Delete:** `store/variationStore.ts` after absorption.

### `store/orderRoutingStore.ts` absorbs `store/product.ts`

**Why:** `store/product.ts` (100 lines) exists solely to fetch product info and stock for the **test routing** feature inside `orderRoutingStore`. It has no other consumers. It's one feature's data cache, not a standalone domain.

**Delete:** `store/product.ts` after absorption.

---

## 6. draftTargets/ — dissolve entire directory

The `draftTargets/` directory is not a standard layer. Its contents split cleanly across existing layers:

| File | What it contains | Where it goes |
|---|---|---|
| `BrokeringRulesDraftTargets.ts` | `buildBrokeringRulesManifest` + summarize* helpers | `util/brokeringRulesManifest.ts` |
| `BrokeringRulesDraftTargets.ts` | `buildBrokeringRulesBindings` + apply* helpers | `composables/useBrokeringRulesDraft.ts` |
| `BrokeringRunsListTargets.ts` | `buildBrokeringRunsListManifest` + all helpers | `util/brokeringRunsManifest.ts` |
| `BrokeringAgentSnapshot.ts` | `buildBrokeringAgentSnapshot` | `util/brokeringRulesManifest.ts` (used only by that manifest) |

**Delete:** all 3 files in `draftTargets/` after moving.

---

## 7. Files deleted in total

| File | Reason |
|---|---|
| `services/SimulationHistoryCache.ts` | Merged into `services/simulationStorage.ts` |
| `services/SimulationJobStore.ts` | Merged into `services/simulationStorage.ts` |
| `services/BrokeringRunsAssistantService.ts` | Absorbed into `services/DraftAssistantService.ts` |
| `services/CircuitDraftFeedbackService.ts` | 4-line re-export stub — dead shim |
| `util/simulationDiff.ts` | Merged into `util/simulationCompute.ts` |
| `util/simulationBatch.ts` | Merged into `util/simulationCompute.ts` |
| `util/progressBuffer.ts` | Merged into `util/simulationCompute.ts` |
| `util/variationConfigAdapter.ts` | Merged into `util/variationUtils.ts` |
| `util/variationTree.ts` | Merged into `util/variationUtils.ts` |
| `util/routingResultJoin.ts` | Merged into `util/variationUtils.ts` |
| `util/outcomes.ts` | Merged into `util/simulationResults.ts` |
| `util/traceRollup.ts` | Merged into `util/simulationResults.ts` |
| `util/persistedSimulationAdapter.ts` | Merged into `util/simulationResults.ts` |
| `store/variationStore.ts` | Absorbed into `store/simulationStore.ts` |
| `store/product.ts` | Absorbed into `store/orderRoutingStore.ts` |
| `draftTargets/BrokeringRulesDraftTargets.ts` | Split to `util/brokeringRulesManifest.ts` + `composables/useBrokeringRulesDraft.ts` |
| `draftTargets/BrokeringRunsListTargets.ts` | Moved to `util/brokeringRunsManifest.ts` |
| `draftTargets/BrokeringAgentSnapshot.ts` | Absorbed into `util/brokeringRulesManifest.ts` |

**Total files deleted: 19**

---

## 8. Final file count

| Layer | Before | After |
|---|---|---|
| `services/` | 11 | 7 |
| `util/` | 11 | 7 |
| `store/` | 14 | 12 |
| `types/` | 4 | 5 (+ new `draft.ts`) |
| `composables/` | 1 | 2 (+ new `useBrokeringRulesDraft.ts`) |
| `draftTargets/` | 3 | 0 (dissolved) |
| **Total** | **44** | **33** |

---

## 9. Migration order (safe sequence)

Do types first — they have no runtime behavior, imports just change paths.
Do utils second — pure functions, easy to verify.
Do services third — once types and utils are in place, services slim down naturally.
Do stores last — most likely to affect running app behavior.

1. Create `types/draft.ts` — move all Draft* types from `DraftAssistantService.ts`
2. Expand `types/circuit.ts` — move types from `CircuitStorageService`, `CircuitKnowledgeFeedbackService`, `circuitFeedback.ts`
3. Expand `types/simulation.ts` — move types from `SimulationService`, `SimulationHistoryCache`, `SimulationJobStore`
4. Expand `types/variation.ts` — move `VariationConditionInput`, `VariationActionInput` from `VariationService`
5. Expand `types/index.ts` — move `RoutingRequest` from `RoutingGroupService`
6. Create `util/simConfig.ts` — consolidate all env resolvers + mastraUrl
7. Create `util/simulationCompute.ts` — merge simulationDiff + simulationBatch + progressBuffer + add `interpretJobStatus`, `pastSimulationsQuery`, `isFilteredQuery`
8. Create `util/variationUtils.ts` — merge variationConfigAdapter + variationTree + routingResultJoin
9. Create `util/simulationResults.ts` — merge outcomes + traceRollup + persistedSimulationAdapter
10. Create `util/draftUtils.ts` — extract pure functions from `DraftAssistantService`
11. Create `util/brokeringRulesManifest.ts` — manifest builder + BrokeringAgentSnapshot
12. Create `util/brokeringRunsManifest.ts` — runs list manifest builder
13. Create `composables/useBrokeringRulesDraft.ts` — bindings + apply logic
14. Create `services/simulationStorage.ts` — merge SimulationHistoryCache + SimulationJobStore
15. Slim `services/SimulationService.ts` — remove moved functions and types
16. Slim `services/VariationService.ts` — remove moved types
17. Slim `services/RoutingGroupService.ts` — remove moved type
18. Slim `services/DraftAssistantService.ts` — remove moved types and functions; absorb BrokeringRunsAssistantService
19. Slim `services/CircuitKnowledgeFeedbackService.ts` — remove moved types
20. Slim `services/CircuitStorageService.ts` — remove moved types
21. Delete `services/BrokeringRunsAssistantService.ts`
22. Delete `services/CircuitDraftFeedbackService.ts`
23. Delete all source files that were fully merged (19 files listed in §7)
24. Merge `store/variationStore.ts` into `store/simulationStore.ts`
25. Absorb `store/product.ts` into `store/orderRoutingStore.ts`
26. Delete `draftTargets/` directory
