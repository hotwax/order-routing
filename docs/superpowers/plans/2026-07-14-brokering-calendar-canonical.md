# Routing Page Consolidation — Brokering Calendar & Circuit Detail Page

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to work either part task-by-task via its checkboxes (`- [ ]`). Both Part 1 and Part 2 are now implementation-ready.

This document covers two related routing-page consolidation efforts:

- **Part 1** (implementation-ready): replace the brokering list page with the calendar page as the canonical runs entry point, and finish the abandoned `/tabs/*` router migration uncovered while investigating it.
- **Part 2** (implementation-ready): build one canonical routing *detail* page — replacing `BrokeringRoute.vue` and `BrokeringQuery.vue`'s two-page flow, plus the standalone "Circuit" experience, with a single scrollable page that genuinely integrates live group management, AI-assisted drafting, and simulation/variation testing.

They're tracked together because both are "merge the routing pages down to fewer canonical entry points" efforts, and Part 1's investigation directly surfaced several of the facts Part 2 relies on (e.g. the `/tabs` cruft, `CircuitCanvas.vue`'s existing feature overlap with `BrokeringRoute.vue`). **Part 2 depends on Part 1 being done first** — it reuses Part 1's `useBrokeringRuns.ts` composable's `redirect(group)` target and the cleaned-up `/tabs`-free navigation.

---

## Part 1: Brokering Calendar as Canonical Runs Page — Implementation Plan

**Goal:** Make `/brokering-calendar` (`BrokeringRunsCalendar.vue`) the single canonical entry point for brokering runs, replacing `/brokering` (`BrokeringRuns.vue`), without breaking navigation into the shared detail page (`BrokeringRoute.vue`) and without losing the AI assistant feature currently only wired into the list page.

**Scope:** The list-vs-calendar consolidation, plus finishing the abandoned `/tabs/*` → non-tabs router migration that this work touches anyway. `BrokeringRunTest.vue` and `BrokeringQuery.vue` are only touched for their `/tabs`-prefixed navigation strings, not otherwise modified. `FacilityGroups.vue` and `Circuit.vue` are fully out of scope for Part 1 — see Non-Goals (Part 2 covers Circuit separately).

**Architecture:** Extract the duplicated view-layer logic (filtering, sorting, cadence labels, create-run flow, redirect-to-detail) into a shared composable first, wire it into both pages with no behavior change, then port the assistant modal onto the calendar page, then fix every place that hardcodes the list page as the canonical parent/home, then delete the list page and route.

**Tech Stack:** Vue 3, Ionic Vue, Pinia, TypeScript, Vue Router, existing `orderRoutingStore`, existing `BrokeringRunsAssistantModal` + `src/utils/brokeringRunsManifest.ts`.

### Ground Truth (validated this session)

- `/brokering` → `BrokeringRuns.vue` (548 lines), route meta at `src/router/index.ts:202-213`: `title: "Brokering"`, `icon: shuffleOutline`, `menuIndex: 10`, `childRoutes: ["/brokering/"]`.
- `/brokering-calendar` → `BrokeringRunsCalendar.vue` (777 lines), route meta at `src/router/index.ts:214-225`: `title: "Brokering calendar"`, `icon: calendarOutline`, `menuIndex: 11`, **no `childRoutes`**.
- Both pages navigate to the exact same detail route/component: `/brokering/:routingGroupId/routes` → `BrokeringRoute.vue` (`src/router/index.ts:226-231`). There is no separate detail view to merge — this is already unified.
- Both pages already share the same store layer (`orderRoutingStore.fetchOrderRoutingGroups`, `getRoutingGroups`, `createRoutingGroup`) but duplicate view-layer logic near-identically with no shared composable: `isActive`, `sortGroups`, `displayedGroups`, cadence-label formatting, the `addNewRun` alert-controller flow, and `redirect(group)`.
- `BrokeringRoute.vue:8` hardcodes `<ion-back-button default-href="/tabs/brokering" />` — assumes list page is always the parent.
- `menuIndex: 11` is also used by `/simulate` (`:253`, feature-flagged) and `/facility-groups` (`:281`) — a pre-existing nav-ordering collision, unrelated to this plan; not in scope to fix here.
- Other hardcoded references to `/brokering`/`/tabs/brokering` found via repo-wide grep:
  - `src/router/index.ts:47` — root fallback redirect when the `simulation` feature flag is off: `next("/brokering")`.
  - `src/router/index.ts:316-317` — legacy redirects `/tabs` → `/brokering` and `/tabs/brokering` → `/brokering`.
  - `src/components/DashboardSummary.vue:4` — dashboard card `router-link="/brokering"`.
  - `src/components/BrokeringRunsAssistantModal.vue:153` — `pageRoute: "/tabs/brokering"` fed into the assistant's manifest/navigation context.
  - `src/views/BrokeringQuery.vue:6` and `src/views/BrokeringRunTest.vue:9` already back-link to the detail page (`/tabs/brokering/${routingGroupId}/routes`), not to the list — these do **not** need to change for the calendar swap itself, but do get cleaned up in Task 5 below.
- `BrokeringRuns.vue` has ~150 lines of dead calendar-grid CSS (`.calendar-wrapper`, `.hour-row`, `.run-block`, etc., `:373-522`) with no matching template markup — leftover from an early prototype. Confirms the calendar page is the more actively developed of the two (git history: calendar added later, in `2a6a134` + 8 follow-up commits; list page only received minor fixes since).
- No existing doc proposes this consolidation. `docs/calendar-view.md` only pitches the calendar's value; `docs/refactor-migration.md` and the two intent-classifier plans/specs under `docs/superpowers/` are scoped to the assistant's intent engine, not page consolidation.
- **`/tabs/*` is stale, half-migrated router cruft, not a real tabs shell.** There is no `Tabs.vue` file and no `<ion-tabs>` usage anywhere in `src/` — CLAUDE.md's description of routing being "built around `Tabs.vue`" is outdated. Every `/tabs/*` router entry (`src/router/index.ts:315-336`) is a pure redirect to a canonical non-tabs path; nothing renders directly under `/tabs`. However, several view files still actively construct `/tabs/`-prefixed navigation internally (not just old external bookmarks), which means each of those navigations does a pointless extra redirect hop today:
  - `src/views/BrokeringRoute.vue:8` — back-button `default-href="/tabs/brokering"`.
  - `src/views/BrokeringRoute.vue:89` — `router.push('/tabs/brokering/${id}/routes/test')`.
  - `src/views/BrokeringQuery.vue:6` — back-button `default-href` built from `/tabs/brokering/${id}/routes`.
  - `src/views/BrokeringRunTest.vue:9` — back-button `default-href` built from `/tabs/brokering/${id}/routes`.
  - `src/components/BrokeringRunsAssistantModal.vue:153` — `pageRoute: "/tabs/brokering"` (informational manifest context for the AI assistant, not real navigation).
  - `src/components/circuit/CircuitCanvas.vue:856` and `src/components/simulation/SimulationCanvas.vue:779` — both set `pageRoute: "/tabs/circuit"`. This one is a latent bug: no `/tabs/circuit` redirect exists anywhere in the router, so this string doesn't even resolve to anything — it's just stale metadata sent to the assistant.

### File Changes

Create:

- `src/composables/useBrokeringRuns.ts`

Modify:

- `src/views/BrokeringRunsCalendar.vue`
- `src/views/BrokeringRoute.vue`
- `src/views/BrokeringQuery.vue`
- `src/views/BrokeringRunTest.vue`
- `src/router/index.ts`
- `src/components/DashboardSummary.vue`
- `src/components/BrokeringRunsAssistantModal.vue`
- `src/components/circuit/CircuitCanvas.vue`
- `src/components/simulation/SimulationCanvas.vue`
- `src/utils/brokeringRunsManifest.ts` (if it reads page-specific state from the list page)

Delete (final step only, after everything else is verified working):

- `src/views/BrokeringRuns.vue`

### Implementation Tasks

#### 1. Extract Shared Composable (no behavior change)

- [ ] Create `src/composables/useBrokeringRuns.ts`.
- [ ] Move in, unchanged in behavior: `isActive(group)`, `sortGroups(list)`, `displayedGroups` (status-filtered + sorted computed), cadence-label formatting (`cronstrue` + `VITE_CRON_EXPRESSIONS` lookup), the `addNewRun()` alert-controller flow, `redirect(group)`, and the `selectedFilter` ref.
- [ ] Wire both `BrokeringRuns.vue` and `BrokeringRunsCalendar.vue` to use the composable in place of their local copies.
- [ ] Manually verify both pages behave identically to before (filter segment, create-run flow, click-through to detail) — this step should produce zero visible change.

#### 2. Port the AI Assistant to the Calendar Page

- [ ] Add the "assistant" trigger button and `BrokeringRunsAssistantModal` to `BrokeringRunsCalendar.vue`'s header, mirroring `BrokeringRuns.vue`'s current wiring.
- [ ] Update `BrokeringRunsAssistantModal.vue:153` `pageRoute` from `"/tabs/brokering"` to `"/brokering-calendar"` (no `/tabs` prefix — see Task 5) so the manifest's page context matches the page it's now launched from.
- [ ] Check `src/utils/brokeringRunsManifest.ts` for any assumptions tied to list-page-only state (e.g. `displayedGroups` shape, `selectedFilter`) and confirm the calendar page now provides the same manifest inputs via the shared composable from Task 1.
- [ ] Manually verify the assistant modal opens from the calendar page and produces a working draft/inquiry round-trip identical to the list page's current behavior.

#### 3. Fix Parent-Page Assumptions

- [ ] `src/views/BrokeringRoute.vue:8` — change `default-href="/tabs/brokering"` directly to `default-href="/brokering-calendar"` (no `/tabs` prefix — see Task 5).
- [ ] `src/router/index.ts` — move `childRoutes: ["/brokering/"]` from the `/brokering` route meta (`:211`) onto the `/brokering-calendar` route meta (`:214-225`), so the nav item stays highlighted while drilled into `/brokering/:routingGroupId/routes`, `/routes/test`, and `/rules`.
- [ ] `src/router/index.ts` — decide and apply the calendar route's nav identity now that it's canonical. Recommended default: keep the path `/brokering-calendar` (existing bookmarks/links keep working), but set `title: "Brokering"` and `menuIndex: 10` (taking over the list page's old nav slot) so the nav label and position don't change for existing users. Keep `icon: calendarOutline`. Flag this specific choice to the user before landing if a different label/position is preferred.
- [ ] `src/router/index.ts:47` — change the feature-flag fallback redirect from `next("/brokering")` to `next("/brokering-calendar")`.
- [ ] `src/router/index.ts:316-317` — repoint the legacy `/tabs` and `/tabs/brokering` redirects to `/brokering-calendar`.
- [ ] `src/components/DashboardSummary.vue:4` — change `router-link="/brokering"` to `router-link="/brokering-calendar"`.
- [ ] Re-grep the repo for `/brokering"` and `/tabs/brokering"` (exact list-page path, not the calendar or detail sub-paths) to confirm nothing was missed before deleting the route.

#### 4. Remove the List Page

- [ ] Remove the `/brokering` route block from `src/router/index.ts` (`:201-213`).
- [ ] Delete `src/views/BrokeringRuns.vue`.
- [ ] Confirm no remaining imports of `BrokeringRuns.vue` (route-level or otherwise).

#### 5. Finish the `/tabs` Migration Cleanup

- [ ] `src/views/BrokeringRoute.vue:89` — change `router.push('/tabs/brokering/${id}/routes/test')` to `router.push('/brokering/${id}/routes/test')`.
- [ ] `src/views/BrokeringQuery.vue:6` — change back-button `default-href` from `` `/tabs/brokering/${routingGroupId}/routes` `` to `` `/brokering/${routingGroupId}/routes` ``.
- [ ] `src/views/BrokeringRunTest.vue:9` — change back-button `default-href` from `'/tabs/brokering/'+routingGroupId+'/routes'` to `'/brokering/'+routingGroupId+'/routes'`.
- [ ] `src/components/circuit/CircuitCanvas.vue:856` — change `pageRoute: "/tabs/circuit"` to `pageRoute: "/circuit"` (fixes the dead-string bug — no `/tabs/circuit` route/redirect exists today).
- [ ] `src/components/simulation/SimulationCanvas.vue:779` — same fix, `pageRoute: "/tabs/circuit"` → `pageRoute: "/circuit"`.
- [ ] Re-grep the repo for `/tabs/` (case-insensitive, all file types) to confirm every internal reference is gone before touching the router.
- [ ] Remove the entire `// -------------------- Legacy /tabs/* redirects --------------------` block from `src/router/index.ts` (`:315-336`), all 8 entries.
- [ ] Confirm this is genuinely safe to remove outright (no known external bookmarks/deep-links depend on `/tabs/...` for this internal enterprise tool) rather than keeping it as a compatibility shim — flag to the user if there's any doubt before deleting.

Note: `BrokeringQuery.vue`'s fix here is short-lived — Part 2 replaces `BrokeringQuery.vue` entirely — but it's still worth doing now since Part 2 lands separately (see Part 2 decision §0.1.11).

#### 6. Manual Validation

- [ ] Start the dev server and confirm `/brokering` now 404s or redirects (per Task 3's redirect updates) rather than rendering a broken page.
- [ ] Confirm `/brokering-calendar` is reachable from the nav menu at its expected position/label.
- [ ] From the calendar page, click through to a run's detail page, then tap back — confirm it returns to the calendar, not a broken/removed route.
- [ ] Confirm the nav item stays highlighted while on the detail, test-drive, and rules pages reached from the calendar.
- [ ] Confirm the dashboard's brokering summary card navigates to the calendar page.
- [ ] Confirm the assistant modal works end-to-end from the calendar page (open, submit a prompt, apply a draft).
- [ ] Confirm the feature-flag fallback (`simulation` off) lands on the calendar page, not a dead list route.
- [ ] Confirm navigating detail → test-drive → back, and detail → rules → back, land on the right pages with no `/tabs/...` hop in the URL bar.
- [ ] Confirm any `/tabs/...` URL typed directly now 404s cleanly (expected, since the redirect block is gone) rather than crashing.
- [ ] Run `npm run build` and confirm it still succeeds.

### Execution Order

1. Shared composable extraction (Task 1) — safe, no behavior change, do this first so Task 2 has less to duplicate.
2. Assistant port (Task 2) — the highest-effort, highest-risk step; do it while the list page still exists as a working reference/fallback.
3. Parent-page and router fixes (Task 3).
4. Delete the list page and route (Task 4) — only after Tasks 1-3 are verified working.
5. `/tabs` migration cleanup (Task 5) — do this last among the code changes, since Task 3 already touches `BrokeringRoute.vue:8` and it's cheaper to finish the job in the same pass than to touch that file twice.
6. Manual validation (Task 6).

### Non-Goals

- Do not touch `BrokeringRunTest.vue`, `BrokeringQuery.vue`, `FacilityGroups.vue`, or `Circuit.vue` beyond the specific `/tabs` string fixes in Task 5 — otherwise out of scope for Part 1 (Circuit is separately covered in Part 2).
- Do not fix the pre-existing `menuIndex: 11` collision between `/simulate` and `/facility-groups` — unrelated bug, separate task.
- Do not redesign the calendar page's heatmap/stats UI.
- Do not attempt to merge `BrokeringRoute.vue` with anything — it is already the single shared detail page for both entry points (Part 2 handles its eventual replacement).

---

## Part 2: The Canonical Routing Detail Page (formerly "Circuit") — Implementation Plan

> **PROGRESS & CORRECTED APPROACH (2026-07-14).** Ground-truth re-verification against the actual branch corrected several plan premises (the earlier scan was unreliable — it missed `VariationRail`):
> - **The canvas already contains the full routing+rule/filter/sort/action editor** — `CircuitCanvas.vue` is a *drifted duplicate* of `BrokeringQuery.vue`, not a delegate. So Task 2 is **reconcile + repoint + delete**, not a from-scratch merge of a 1,840-line editor.
> - `CircuitCanvas` drift gaps to close before deleting `BrokeringQuery`: missing routing filters `PROD_CATEGORY`/`PROMISE_DATE`(+`_EXCLUDED`) and rule filter `WOS`; no test-drive harness (`BrokeringRouteTest`) or `ROUTING_TEST_DRIVE_VIEW` gate; read-only description.
> - `BrokeringQuery` **cannot be embedded** (full `ion-page`, route-coupled lifecycle) — confirms reconcile-the-canvas over embed.
> - The `/circuit` route **is** linked (side-nav item), contrary to the plan's "nothing links to it".
> - **Save model decided (2026-07-14): the canvas's immediate-persist model** (group actions persist per-action; rule edits via the canvas's existing save pipeline). Batched-Save is not being reintroduced.
> - Variation-aware draft-apply: the working-copy write already exists in `SimulationCanvas`; the genuinely net-new part is a single unified component + an explicit "active variation" signal in the manifest.
>
> **Status of work (uncommitted, on `codex/routing-page-consolidation`):**
> - ✅ **Part 1** — done, adversarially reviewed (2 findings fixed), builds clean, verified live.
> - ✅ **Task 1 (variation management)** — done as *enhance `VariationRail`* (not a new modal): inline create + update/save-as-new + dirty chip + unsaved-changes guard; inline `SimulationCanvas` card removed; store flush-hook so rail-triggered saves capture editor edits. Adversarially reviewed (4 findings fixed). Builds clean.
> - ✅ **Task 2 CORE — canvas is now the canonical detail page.** `/brokering/:routingGroupId/routes` → new `RoutingDetail.vue` (seeds group context from the route param, renders `CircuitChatCanvas` = chat + canvas); `BrokeringRoute.vue` deleted; back-button added. Verified live (calendar→detail→back, no stuck loader).
> - ✅ **Task 2 CLEANUP (this session):**
>   - Closed the drift-gap filters — ported `PROD_CATEGORY`(+`_EXCLUDED`), `PROMISE_DATE`(+`_EXCLUDED`), and `WOS` into the canvas (they were missing → making the canvas the detail page had silently *regressed* those real filters). Added `catalogCategories`, `selectPromiseFilterValue`, and a non-blocking `fetchCategories()`.
>   - Deleted `BrokeringQuery.vue` + its `/rules` route (canvas now carries the full editor incl. the restored filters).
>   - Removed the `/circuit` route + side-nav item; deleted `Circuit.vue`, `CircuitIntro.vue`, `CircuitStart.vue`.
>   - Hardened `App.vue`'s global loader against BOTH present/dismiss races (dismiss-during-create AND dismiss-during-present) — the latter surfaced as a stuck overlay when `fetchCategories` shifted fetch timing. Verified live: detail page loads clean, loader clears, nav shows no "Circuit".
> - ✅ **Description edit** added to the canvas group card (Edit/Add/Save-description, immediate-persist via `updateRoutingGroup`, mirroring the existing rename). Verified live (toggle + save round-trip, no error).
> - ✅ **Test-drive entry restored** — added `BrokeringRoute`'s test-drive card to the canvas (permission-gated `!hasPermission('ROUTING_TEST_DRIVE_VIEW')`, disabled on unsaved changes) with a button to the existing run-level test page (`/brokering/:id/routes/test` → `BrokeringRunTest`, which embeds `BrokeringRouteTest`). Verified live (navigates cleanly). NOTE: the permission gate is INVERTED (shows when the user LACKS the permission) — replicated verbatim from `BrokeringRoute`/`BrokeringQuery` for parity; flagged as a likely pre-existing bug for the team to confirm.
> - ⏳ **Task 2 REMAINING:** the deeper IN-EDITOR rule/routing test mode (embedding `BrokeringRouteTest` inline in the rule editor with test-mode disabling the whole editor + unmatched-filter highlighting, per old `BrokeringQuery`) is NOT ported — large, deeply-woven, backend-dependent (can't be verified in the demo env), best done in an app-runnable session. Also: the pause-scheduled-brokering toggle from `BrokeringRoute`'s test card (reservation subsystem) is not ported. Delete `RoutingRuleSelectionModal.vue` (still used by `CircuitChatCanvas`'s "add context"); optional rename `CircuitCanvas`→`RoutingDetailCanvas`. NOTE: the add-filter picker modal (`AddOrderRouteFilterOptions`) shows "Failed to fetch filters options" in the demo env — a backend/env issue, unrelated to these changes (component untouched).
> - **Task 3 (manifest group-level draftable + variation-aware) — investigated, NOT implemented.** The AI chat flow is confirmed working live against the dev Mastra server (`VITE_MASTRA_URL=https://circuit-app-dev.hotwax.io`; inquiry round-trips verified). BLOCKER: making group-level fields chat-*draftable* almost certainly requires extending the Mastra **draft output schema** (`brokeringRouteDraftSchema`) to express group-level targets — the manifest is the authority for *what may be touched*, but the server schema decides what it can *emit*, and it's shaped around route/rule edits. Per decision §0.1.10 the server is out of scope and its source isn't in this repo, so the client-only half (`brokeringRun.description` target + apply branch + binding) could sit non-functional until the server is extended. Group fields ARE fully editable via the traditional controls (rename, description-edit, schedule), so only the chat-draftable aspect is server-gated. The variation-aware half is coupled to Task 4's active-variation state.
> - ✅ **Task 4 (simulation integrated into the canonical page) — DONE, then UNIFIED into ONE component (live-verified).** The canonical detail page hosts variation editing alongside the live group + chat, and the two forked canvases are now a single component (decision §0.1.2 / decision 8 satisfied — no `CircuitCanvas`/`SimulationCanvas` fork remains):
>   - **`SimulationCanvas.vue` DELETED.** Its sandbox behavior was folded into `CircuitCanvas.vue` behind a `sandbox` prop (`const isSandbox = computed(() => props.sandbox)`), treating the circuit canvas as the base and *adding* the sim features to it (not a merge-conflict resolution). Hosts flipped: `CircuitChatCanvas` renders one `<CircuitCanvas :sandbox="!!activeVariationId" :key="activeVariationId || 'live'">`; `Simulation.vue` renders `<CircuitCanvas :sandbox="true">`.
>   - **Guard-first merge (behavior-preserving).** All sandbox branches + write-guards were added while `sandbox` stayed `false` everywhere, so intermediate builds could not corrupt live data; hosts were flipped only after review. Sandbox behavior: live-write functions (`save`/`persistLocalInventoryRules`, `updateRoutingGroup`, `updateRuleName`, `updateRouteName`, `updateRoutingStatus`, `cloneGroup`/`cloneRule`/`cloneRouting`, `createNewRouting`, `saveSchedule`, `updateGroupStatus`, `runNow`, `openRoutingHistoryModal`, `applyCircuitDraftProposal`'s `createSiblingRouting`, archived-modal re-fetches) are no-op'd or made in-memory; `addInventoryRule` adds a `_tempId` rule in-memory; `selectRouting`/`selectRule` read the working copy and skip `setCurrentOrderRouting`/live rule fetch; a registered flush hook (`flushWorking`) commits editor state into `sim.working` for rail-triggered saves. Dual-shape adapters (`buildOptionMap`/`buildActionMap`/`initializeInventoryRule`/`syncActiveRuleDraft`/`syncWorkingFromLocalState`) bridge the flat-array working copy ⇄ keyed live shape; `ruleKey` used for template keys + reorder matching. Live-only controls are hidden via `v-if="!isSandbox"` (scheduler, group/routing status, run-now, clone, history, test-drive, "New" routing, save FAB).
>   - **Adversarial "missed-guard hunt" (4 lenses → per-finding verify):** 44 observations, 13 suspects, **1 confirmed gap** — `openRoutingHistoryModal` was guarded only by the template hide; added a function-level `if (isSandbox.value) return`. Every other live-write path held.
>   - **Verified live in-browser (network-instrumented; live backend = `demo-maarg.hotwax.io`, sim backend = `demo-sim-uat.hotwax.io`):** live page load = GETs only; create variation = sim `POST`/`PUT` only, **0 `demo-maarg` writes**; sandbox rule edit + rail commit = sim `PUT` only, **0 `demo-maarg` writes**; edit round-trips (toggle persisted); switch back to Baseline restores all live controls, GETs only. The no-live-write invariant holds across create/edit/commit/switch.
>   - **Known pre-existing quirk (NOT a merge regression):** after an `updateVariation` save, switching variation shows a spurious "discard unsaved changes?" prompt — `simulationStore.updateVariation` stores the server-round-tripped shape into `v.group` while `isDirty` re-flushes the editor's locally-derived shape and the two serializations aren't byte-identical. Lives in `simulationStore` + the ported flush (behavior unchanged from old `SimulationCanvas`); cosmetic, no data impact. Candidate follow-up.
>   - **Deferred (Task 3, server-gated):** chat *drafting against a variation* needs the variation-aware manifest, which needs the Mastra draft schema extended — out of scope (§0.1.10). Chat inquiry works in either mode today.
> - ✅ **Legacy-circuit cleanup (later session) — DONE (build green, browser-verified via JS/DOM).**
>   - **Context lifecycle bug fixed:** `circuit.ts` `switchThread()` no longer nulls `activeContext` (removed the `preserveContext` opt-in), so starting a new chat / opening a thread no longer strands the detail page with no routing group. Context is now derived SOLELY from the route (RoutingDetail seeds it). `persist` → `{ omit: ['activeContext'] }` so a stale persisted context can't fight the URL. Dead `resetCircuit`/`isIntroDone`/`setIntroDone` removed. Verified: after new-chat, `activeContext` stays the group; `activeContext` absent from persisted localStorage while threads persist.
>   - **Manual context picker removed (§0.1.3):** `RoutingRuleSelectionModal.vue` deleted; `addContext`/`removeContext` + `CircuitPromptArea` chip block/props/emits removed; detail toolbar title bound to the group name (not "Circuit"); stray `console.log` + unreachable "Ask Circuit"/"Select a routing context" copy neutralized. "Circuit" branding kept ONLY on Mastra-facing surfaces (chat transcript label, dev prompt inspector, feedback modal) per §0.1.1.
>   - **Chat threads stay GLOBAL (user decision):** not scoped to a routing group; only the context-drop bug was fixed. (Thread↔group scoping would need server-side thread storage — deferred.)
>   - **Standalone sim EDITOR page deleted:** `Simulation.vue` + `/simulate/:routingGroupId` route removed (its editor was byte-identical to the canonical `<CircuitCanvas :sandbox>`). `SimulationHome.vue` repurposed to a Past-simulations-only history view; nav renamed "Simulation history". `/simulate`, `/simulate/history/:id`, `PastSimulationDetail`, `PastSimulationsList`, `pastSimulationStore` KEPT (user chose "delete page, keep Past sims"). `simulationStore.resumeInFlight` is now dead (left in place). This lands the previously-deferred "surface results" half; running/compare now reachable from the detail page.
>   - **Variation results in the rail:** `VariationRail` gained a "Results" fab opening `SimulationResults` in a modal (`:embedded=true` hides the Simulation-only "Back to editor"); `simulationStore.clearRunResults()` (from `resetWorkingToBaseline`/`loadVariation`/`saveAsVariation`) prevents a prior variation's numbers showing for another. Verified live: run round-trips, modal shows per-routing results, failed-run shows its error (not blank), save-as-new clears stale results.
>   - **Adversarial review (3 lenses → verify):** 2 confirmed bugs, both in the new results-modal, FIXED — (a) failed run rendered a blank modal (runCompareError note was gated behind the result/running template) → widened the template condition; (b) `saveAsVariation` didn't `clearRunResults()` → added the call.
>   - **KNOWN follow-up (spawned task):** the `VariationRail` sheet modal (`:is-open="true"`, mounted in the Ionic-cached detail page, teleports to app root) stays visible on every other page after visiting a detail page. `v-if` leaks zombie modals; sheet `is-open=false` doesn't tear down; imperative present/dismiss races/hangs. Left at stable original behavior; needs a rearchitecture (modalController tied to `RoutingDetail`'s ionView lifecycle, or an in-page panel).

**Goal:** Replace `BrokeringRoute.vue`, `BrokeringQuery.vue`, and the standalone `Circuit.vue`/`/circuit` experience with one canonical routing-group detail page — still living at `/brokering/:routingGroupId/routes` — that houses traditional group/routing management, embedded AI-chat drafting, and simulation/variation testing on a single scrollable page, reachable directly from the list/calendar page with no second route for rule editing and no separate "Circuit" destination.

**Scope:** Everything decided in §0, §0.1, and §5 below. Explicitly excludes: backend rename/delete endpoints for variations (external "routing sim component" dependency), any Mastra/circuit-server-side changes, and simulation running/results/comparison (deferred to a future planning round).

**Architecture:** Four phases, in dependency order. (1) Build the Variations modal as a decoupled component/composable inside the current Simulation page first — fully specified, lowest risk, ships independent value. (2) Merge `BrokeringRoute.vue` + `BrokeringQuery.vue` + `CircuitCanvas.vue` into one renamed canonical component with accordion-based routing/rule selection, closing the description/permission-gate gaps, and removing Circuit's onboarding, context-picker, and standalone route. (3) Extend the manifest to cover group-level fields and make it variation-aware. (4) Fold the Variations modal and variation-aware drafting into the canonical page so live-group editing and simulation genuinely share one screen. Each phase is manually verified before the next begins, since phase 4 depends on phases 1-3 all existing.

**Tech Stack:** Vue 3, Ionic Vue, Pinia, TypeScript, Vue Router, `orderRoutingStore`, `simulationStore.ts`, `VariationService.ts`, `useCircuitStore()` (`src/store/circuit.ts`), `src/utils/brokeringRulesManifest.ts`, `DraftAssistantService.ts`.

### 0. Decisions (2026-07-14)

These override the earlier framing of this section ("should Circuit replace BrokeringRoute") with a settled direction. Each decision's implications are carried through the rest of this section.

1. **Enter directly from the list/calendar page — no separate "Circuit" destination.** The routing-group card's click target (`redirect(group)` in both `BrokeringRuns.vue` and `BrokeringRunsCalendar.vue`, and after Part 1, the shared `useBrokeringRuns.ts` composable) should navigate straight into this page with the group already loaded — not into a cold-start chat experience that then requires manually picking the group. The product no longer calls this destination "Circuit" — it's simply **the routing detail page**.
2. **One canonical page, not two forks.** There will not be a `CircuitCanvas.vue` / `SimulationCanvas.vue` split going forward. The end state is a single component/page that does everything — live group management, AI drafting, and simulation.
3. **Variation rename needs real backend persistence**, not the current client-only `renameVariation()` mutation. That backend work most likely belongs in "the routing sim component" — a separate service/repo the user doesn't have checked out locally right now, so it can't be scoped precisely from this repo. Treat it as an **external, cross-repo dependency** to track.
4. **Warn about unsaved changes** before switching the canvas to a different variation (or back to baseline) if the working copy is dirty (`sim.isDirty`).
5. **The Variations modal should fully house variation management for now** — list, create (inline name input), switch/load, delete, and the update-vs-save-as-new save workflow all live in the modal. The inline chip/buttons currently in `SimulationCanvas.vue:11-29` are replaced outright, not kept alongside it.
6. **The modal is being built with its eventual home in mind**: it's expected to migrate into the new canonical routing detail page once that page exists, at which point the standalone Simulation page (`/simulate/:routingGroupId`, `Simulation.vue`) is left behind. Build it decoupled enough from `Simulation.vue`-specific plumbing that the move is plausible later, without over-engineering for a migration that hasn't been scoped yet.
7. **The new canonical page fully replaces both `BrokeringRoute.vue` and `BrokeringQuery.vue`.** Today, group management (`BrokeringRoute.vue`) and rule/filter/sort/action editing for one `orderRoutingId` (`BrokeringQuery.vue`) are two separate routes/pages with a navigation hop between them (`/brokering/:routingGroupId/routes` → `/brokering/:routingGroupId/:orderRoutingId/rules`). The new page collapses this into **one continuous scrollable page** — no second route, no navigation hop to edit a routing's rules.
8. **Simulation and the AI-chat experience are genuinely integrated, not parameterized modes of one component.** The goal is that a user can use both *at the same time* in the same screen (e.g., iterate on a variation while asking the assistant questions about it), not toggle between a "live" mode and a "simulation" mode that hide each other.

### 0.1 Round 2 Decisions (2026-07-14, resolving the previous round's open questions)

1. **Naming scope: split by what actually touches Mastra.** "Circuit" branding stays only on the pieces that directly manage the chat/Mastra connection — the chat UI itself (`CircuitChatCanvas.vue`: history, threads, prompt input) and the store backing it (`useCircuitStore()` / `src/store/circuit.ts`). Everything else loses the branding: the page shell (`Circuit.vue`), the route (`/circuit`, nav entry), and — since it renders group/rule management, not just chat — `CircuitCanvas.vue` itself should be renamed away from "Circuit" (e.g. to something like `RoutingDetailCanvas.vue`) once it becomes the canonical page's main content. Exact final names are a small implementation detail, not decided here.
2. **Circuit's onboarding is deleted, not preserved as a fallback.** `CircuitIntro.vue`/`CircuitStart.vue` and the `isIntroDone`/`isChatStarted` state machine in `Circuit.vue` are removed outright — per the user, "that was a farce to begin with." No secondary cold-start entry point is being kept.
3. **`RoutingRuleSelectionModal.vue` ("add context" picker) is deleted, not repurposed.** Direct navigation from the list/calendar (decision 1) replaces its job entirely.
4. **Routing/rule selection within the merged page is pure in-page component state — no URL reflection.** The page keeps living at `/brokering/:routingGroupId/routes` (reusing Part 1's fixes to that path); selecting a routing to view/edit its rules does not add a query param, hash, or second route. This also means no deep-linking directly to one routing's rules section for now.
5. **Decided at §5:** one active routing at a time (accordion/expand-on-select), not every routing's rule editor expanded simultaneously.
6. **Running, results, and comparison are explicitly deferred to a future planning round.** Only variation *management* (create, switch, rename, delete) is in scope for the Variations-modal work planned here. `runActiveVariation()`, `PastSimulationDetail.vue`, and any results/comparison UI stay out of scope until that later round.
7. **Chat/assistant works against whichever context is currently open — live group or an active variation.** This means the manifest-building layer needs to become variation-aware: it must know whether a variation is active and, if so, which one, and reflect that in what's sent to the model. The draft-apply logic correspondingly needs to write proposed changes into the right target — the live group's store when nothing's active, or the active variation's working copy when one is — rather than always assuming the live group. This is a materially bigger implementation item than originally scoped and should be called out explicitly during implementation.
8. **Delete is in scope for variations**, alongside rename. Like rename (decision 3), there is no delete endpoint in `VariationService` or the backend today — this is the same external "routing sim component" dependency.
9. **Group-level fields become real, chat-draftable manifest `editableTargets`.** Confirmed with routing description as the explicit example, but the principle applies generally — rename, schedule, clone, reorder, and run-now are all candidates to follow the same pattern as they get built out, not just description.
10. **No Mastra/circuit-server-side changes are in scope, and locating that server source is not a blocker for this plan.** Whatever new client-side manifest targets get defined (per decision 9 above and decision 7's variation-awareness) are this repo's concern only; server-side handling is explicitly not something to worry about here.
11. **The `BrokeringQuery.vue` `/tabs`-prefixed back-button fix stays in Part 1**, as already planned there (Part 1, Task 5) — do it now rather than skip it, since `BrokeringQuery.vue` won't be deleted until Part 2 lands.

### 1. Problem

Today there are three separate, non-cross-linked experiences that all need to collapse into one, per the decisions above:

- `src/views/BrokeringRoute.vue` — the traditional Ionic group-detail page, reached from `/brokering/:routingGroupId/routes`.
- `src/views/BrokeringQuery.vue` — the rule/filter/sort/action editor for a single routing within a group, reached one navigation hop deeper at `/brokering/:routingGroupId/:orderRoutingId/rules`.
- `CircuitCanvas.vue`, rendered only inside `Circuit.vue` at the standalone `/circuit` route — an AI-chat-first experience that, perhaps surprisingly, **already re-implements most of `BrokeringRoute.vue`'s traditional UI** (rename, clone, scheduler, run-now, history, reorderable routings list) alongside the chat/draft functionality.

Plus a fourth, `SimulationCanvas.vue` (a code-commented fork of `CircuitCanvas.vue`), which per decision 8 needs to genuinely integrate into the same flow rather than staying separate.

This section catalogs the concrete feature gaps and facts relevant to building that single page, ending with the rendering-strategy decision for multiple routings (§5), followed by the phased implementation tasks.

### 2. Current State (validated this session)

- `/circuit` (`src/router/index.ts:284-295`) is a single global route with **no route params** — contrast with `/brokering/:routingGroupId/routes` or `/simulate/:routingGroupId`, which both take an id. `Circuit.vue` gets its working context entirely from `useCircuitStore().activeContext`, set only via a manual "add context" picker inside the chat itself (`CircuitChatCanvas.vue` → `RoutingRuleSelectionModal.vue`, which — despite its name — lets you pick a routing **group**, not a rule). Per decisions §0.1.2–§0.1.3, both the onboarding sequence and this picker are being deleted.
- `CircuitCanvas.vue` (2494 lines) independently renders: group rename, clone-group, a scheduler card (edit/add schedule, run-now, history), a reorderable routings list with an "Archived" entry point, and per-routing rename/clone/status/history — reusing the *same* `ArchivedRoutingModal`, `ScheduleModal`, `GroupHistoryModal`, and `RoutingHistoryModal` components `BrokeringRoute.vue` uses.
- Two concrete regressions if `CircuitCanvas.vue` replaced `BrokeringRoute.vue` as-is today:
  - **Description is read-only** in `CircuitCanvas.vue:11` (`<p v-if="group.description">`) — no edit/add control, unlike `BrokeringRoute.vue:65-75`.
  - **No permission gate.** `BrokeringRoute.vue:79` explicitly hides the test-drive card behind `userStore.hasPermission('ROUTING_TEST_DRIVE_VIEW')`. `CircuitCanvas.vue` has no equivalent check anywhere on its status-toggle, schedule, or run-now controls.
- The AI-chat/manifest layer treats the group as **read-only context today, not an editable surface**: `src/utils/brokeringRulesManifest.ts`'s `editableTargets` only cover the single open routing's status/filters/sorts and the selected rule's fields (`route.*`, `selectedRule.*`). `brokeringRun.{groupName,schedule,routingGroupId}` are injected only as inert context. Per decision §0.1.9, this is set to change — group-level fields become real editable targets.
- A genuinely equivalent **read-only group inquiry** feature already exists — just not in Circuit. `BrokeringRunsAssistantModal.vue`, mounted only on the list page (`/brokering`), lets a user ask schedule/config questions about any group with a manifest that does include full schedule data. It's a completely separate code path (`buildBrokeringRunsListManifest()` / `/brokering-runs-list-inquiry`) from Circuit's (`buildCircuitDraftManifest()` / `/brokering-route-assistant`).
- The actual circuit/Mastra server source could not be located on this machine (`CLAUDE.md` claims `sandbox/circuit/`, which has never existed in this repo's git history). **Per decision §0.1.10, this is explicitly not a concern for this plan.**
- **CLAUDE.md is stale in several structural claims** unrelated to Circuit specifically but discovered during this investigation: no `Tabs.vue`/`<ion-tabs>` anywhere (see Part 1), no `src/store/modules/` or `src/store/index.ts` (stores are independent Pinia `defineStore` files, each opting into `pinia-plugin-persistedstate` individually), no `src/draftTargets/` directory (the manifest builder lives at `src/utils/brokeringRulesManifest.ts`), and `tests/brokeringRulesDraftTargets.test.ts` imports from a `../src/util/` path that no longer exists post-rename. Worth a documentation refresh independent of this initiative.

### 3. Feature Gaps To Close (given the decided direction)

| Capability | `BrokeringRoute.vue` | `BrokeringQuery.vue` | `CircuitCanvas.vue` | AI-draftable via manifest? |
|---|---|---|---|---|
| Rename group | Yes | — | Yes | No → candidate to become Yes (decision §0.1.9) |
| Edit description | Yes | — | **No (read-only)** | No → **to become Yes** (decision §0.1.9, explicit example) |
| Clone group | Yes | — | Yes | No → candidate to become Yes (decision §0.1.9) |
| Schedule (edit/add) | Yes | — | Yes | No → candidate to become Yes (decision §0.1.9) |
| Run now | Yes | — | Yes | No → candidate to become Yes (decision §0.1.9) |
| Execution history | Yes | — | Yes | No (read-only history, no obvious "draft" action) |
| Reorder routings | Yes | — | Yes | No → candidate to become Yes (decision §0.1.9) |
| Test-drive toggle | Yes, permission-gated | — | Yes, **no permission gate** | No |
| Archived routings | Yes | — | Yes | No |
| Clone/rename/status per routing | Yes (via modals) | — | Yes | No |
| Routing status/filters/sorts | — | Yes, own page/route | N/A (delegates to `BrokeringQuery.vue` today) | **Yes** |
| Create a sibling routing | — | — | N/A | **Yes** (only group-adjacent draftable action found) |

Concrete work items implied by the gaps above, given the decided direction:
1. Add description edit/add controls to the canonical page (currently missing from `CircuitCanvas.vue`), and make it a real manifest `editableTarget` per decision §0.1.9.
2. Add the same `hasPermission('ROUTING_TEST_DRIVE_VIEW')` gate to the canonical page's status/schedule/run-now controls that `BrokeringRoute.vue` already has and `CircuitCanvas.vue` currently lacks.
3. Wire direct navigation from the list/calendar page into the canonical page with the group pre-loaded (decision 1) — no more manual "add context" step; the context-picker modal and Circuit's onboarding sequence are deleted (decisions §0.1.2–§0.1.3), not repurposed.
4. Fold `BrokeringQuery.vue`'s rule/filter/sort/action editor into the same scrollable page (decision 7) rather than a second route/navigation hop, keeping the existing route (`/brokering/:routingGroupId/routes`) and pure in-page state for routing selection (decision §0.1.4).
5. Extend `brokeringRulesManifest.ts`'s `editableTargets` to cover group-level fields (starting with description; rename/schedule/clone/reorder/run-now as likely follow-ons) per decision §0.1.9.
6. Make the manifest/draft-apply layer variation-aware (decision §0.1.7) — see §4 below; this is the single biggest net-new implementation item in this whole initiative.

### 4. Simulation + AI-Chat Integration (decided direction: genuinely combined, not parameterized)

`SimulationCanvas.vue` (1739 lines) carries a code comment (`:523`) identifying itself as a **"Simulation fork of `CircuitCanvas`."** It is not embedded inside Circuit and does not share a component with it today — it's a separately maintained copy that has already diverged (e.g. it has the variation-management UI described below, which `CircuitCanvas.vue` has no equivalent of, since live routing groups don't have "variations").

Per decision 8 (confirmed and sharpened at decision §0.1.7), the target end state is **not** a single component parameterized by a "live" vs. "simulation" mode flag that shows one or the other — it's a page where a user can genuinely do both at once (e.g. iterate on a variation's rules while asking the assistant about it, in the same screen), **and the assistant itself must be able to answer/draft against whichever context is currently open** — the live group, or a specific active variation. Concretely, this means:

- The manifest-building layer (today's `buildCircuitDraftManifest()` in `CircuitCanvas.vue`, and whatever supersedes it on the canonical page) needs to track "is a variation currently active, and if so which one," and reflect that in what gets sent to the model.
- The draft-apply logic needs to write proposed changes into the *correct* target — the live group's store when nothing's active, or the active variation's working copy (`sim.working`) when one is — instead of always assuming the live group as it does today.
- Running/results/comparison are explicitly deferred to a future planning round (decision §0.1.6) — the variation-awareness of chat/draft itself is in scope now (Tasks 3-4 below), but is the least-specified part of this plan; expect real design work during implementation rather than a mechanical change.

#### 4.1 Variation Management: the Modal

**Current state**, all in `SimulationCanvas.vue`'s routing-group info card (`:5-41`):

- A chip (`:12-18`) showing either `"Editing: {label}"` (when `sim.activeVariationId` is set) or `"New variation (from Baseline)"`, plus `"— unsaved changes"` appended when `sim.isDirty`.
- An `"Update {label}"` button, shown only when editing an existing variation, calling `updateActiveVariation()` (`:601-606`) — overwrites that variation's persisted config with the current working copy.
- A `"Save as new variation"` button, always shown, calling `saveAsNewVariation()` (`:581-598`) — opens a bare Ionic `alertController` prompt (one text input for a name, Cancel/Save buttons) to create a brand-new variation.

**Existing store support** (`simulationStore.ts`) the modal can build on directly:

- `variations: Variation[]` state + `fetchServerVariations(parentRoutingGroupId)` (`:183-190`) — loads the persisted list from the backend into what a code comment calls "the rail." No template renders this list today.
- `loadVariation(id)` (`:224-243`) — switches the canvas's working copy to a different existing variation, fetching it lazily if not cached. No UI trigger calls this today.
- `renameVariation(id, label)` (`:276-279`) — exists but is **client-side only** (no backend call).
- **No delete action exists at all**, in the store or in `VariationService`.

**Decided requirements for the modal:**

- **Full ownership (decision 5):** the modal is the entire variation-management surface for now — list, create with inline naming, switch/load, delete, and the update-vs-save-as-new workflow. The inline chip/buttons in `SimulationCanvas.vue:11-29` are replaced outright, not kept alongside it.
- **Unsaved-changes guard (decision 4):** switching to a different variation (or back to baseline) while `sim.isDirty` must warn the user first, since there's real working-copy data that would otherwise be silently discarded. No existing pattern for this in the codebase to reuse — this needs a new confirm-dialog step in the switch flow.
- **Delete is in scope (decision §0.1.8),** alongside rename.
- **Backend-persisted rename AND delete are required (decisions 3 and §0.1.8), but both are an external dependency.** Neither endpoint exists in `VariationService`/the backend today, and per the user, that work most likely lands in "the routing sim component" — a separate repo not available locally in this session. This plan specifies the frontend call shape once those endpoints exist, but can't scope the backend work itself. Track as a blocking external dependency; until the endpoints exist, rename/delete should surface a clear failure toast rather than silently no-op or crash.
- **Built for eventual migration (decision 6):** the modal should avoid deep coupling to `Simulation.vue`-specific plumbing so it can move into the new canonical detail page later, at which point the standalone `/simulate/:routingGroupId` page is retired. Don't over-build for that migration now — just avoid gratuitous coupling.
- **Scope explicitly excludes running/results/comparison** (decision §0.1.6) — `runActiveVariation()`, `PastSimulationDetail.vue`, and any results/comparison UI are deferred to a future planning round, not part of this modal's work.

### 5. Rendering Strategy for Multiple Routings (decided)

`BrokeringQuery.vue` (today's rule/filter/sort/action editor for one routing) is 1840 lines of UI and logic. Decision 7 says the group-detail view and the rule editor become one continuous scrollable page instead of two routes — this section settles exactly how a group's *routings list* (which can contain several routings, each needing its own rule editor) renders on that one page.

**Decided: one active routing at a time (accordion / expand-on-select), not every routing's editor expanded simultaneously.** Routings render as collapsed summary rows (reusing today's reorderable-list layout); selecting one expands its full rule editor in place, others stay collapsed. Rationale, for the record:

- **Performance stays bounded regardless of routing count.** Only the selected routing's heavy editor subtree is mounted (via `v-if`, not just CSS-hidden) at any time, rather than multiplying DOM size, reactive overhead, and API calls by however many routings a group has.
- **Reuses the existing state model almost unchanged.** "One active routing at a time" is already how `activeRoutingId`/`activeRule`/`selectedRule` work today in both `BrokeringQuery.vue` and `CircuitCanvas.vue` — no refactor to keyed/scoped per-routing state is needed, and "what is the assistant currently looking at" stays unambiguous for the chat/manifest layer.
- **Still satisfies decision 7's actual intent.** What decision 7 was resolving was the **navigation hop to a second route/page**, not "every routing's rules must be visible without a click." An accordion never leaves the page or changes routes — expand/collapse is pure in-page state (consistent with decision §0.1.4) — so it fully delivers "single page, no second route" while costing only one extra click to view a given routing's configuration.

### File Changes

Create:

- `src/components/simulation/VariationsModal.vue` (Task 1 — later moved into the canonical page's component tree in Task 4)

Modify:

- `src/store/simulationStore.ts` — add `deleteVariation(id)`, wire `renameVariation`/`deleteVariation` toward real backend calls (guarded, since the endpoints don't exist yet).
- `src/services/VariationService.ts` — add `renameVariation`/`deleteVariation` request builders.
- `src/components/simulation/SimulationCanvas.vue` — remove the inline chip/buttons (`:11-29`), add a "Manage variations" entry point opening the modal.
- `src/components/circuit/CircuitCanvas.vue` — renamed (e.g. to `src/components/routing/RoutingDetailCanvas.vue`) and substantially extended: description edit, permission gate, accordion routing/rule editor absorbing `BrokeringQuery.vue`, variation-aware manifest hooks, the Variations modal entry point.
- `src/components/circuit/CircuitChatCanvas.vue` — receives `routingGroupId` via route/props instead of `useCircuitStore().activeContext` set by a picker modal.
- `src/store/circuit.ts` — remove or repurpose `activeContext` (no longer used to select a group; confirm during implementation whether it's still needed for chat thread/message persistence).
- `src/router/index.ts` — remove the `/circuit` route (and its nav entry); remove the `/brokering/:routingGroupId/:orderRoutingId/rules` route; point `/brokering/:routingGroupId/routes` at the renamed canonical component.
- `src/utils/brokeringRulesManifest.ts` — add group-level `editableTargets` (description first), add active-variation awareness to manifest inputs, extend `applyBrokeringRulesOperation()` to recognize `brokeringRun.*` targets and to write into the correct target (live group vs. active variation's working copy).

Delete:

- `src/views/BrokeringRoute.vue`
- `src/views/BrokeringQuery.vue`
- `src/views/Circuit.vue`
- `src/components/circuit/CircuitIntro.vue`
- `src/components/circuit/CircuitStart.vue`
- `src/components/circuit/RoutingRuleSelectionModal.vue`

### Implementation Tasks

#### 1. Build the Variations Modal (decoupled, hosted in Simulation for now)

- [ ] Create `src/components/simulation/VariationsModal.vue`: list existing variations (`sim.variations`, populated via `fetchServerVariations`), each with switch/rename/delete affordances; a "New variation" action with an inline name input (replacing the current `alertController` prompt); wraps the existing update-vs-save-as-new save workflow (`updateActiveVariation()` / `saveAsNewVariation()`).
- [ ] Add `deleteVariation(id)` to `simulationStore.ts` — remove from the local `variations` list, and call through to `VariationService.deleteVariation` once that endpoint exists.
- [ ] Add `VariationService.renameVariation` / `VariationService.deleteVariation` request builders now, even though the backend doesn't have these endpoints yet (decisions 3, §0.1.8) — wire the frontend call shape so it works once the routing-sim-component backend ships. Until then, both actions must surface a clear failure toast (matching the error-handling pattern already used in `loadVariation()`) rather than silently no-op or throw uncaught.
- [ ] Wire the unsaved-changes guard: before `loadVariation(id)` (switch) or `resetWorkingToBaseline()` (back to baseline) from the modal, check `sim.isDirty` and confirm via a dialog before proceeding.
- [ ] Remove the inline chip and "Update"/"Save as new variation" buttons from `SimulationCanvas.vue:11-29`; replace with a single "Manage variations" entry point that opens the modal.
- [ ] Keep all modal logic inside the new component + store actions (not inline in `SimulationCanvas.vue`) so it can be lifted into the canonical page in Task 4 with minimal rework.
- [ ] Manually verify: create a variation with an inline name; rename one (expect a failure toast if the backend endpoint isn't deployed yet, not a silent failure); switch between variations while dirty (confirm the warning fires); delete a variation.

#### 2. Build the Canonical Routing Detail Page (live group + chat, simulation not yet integrated)

- [ ] Rename `src/components/circuit/CircuitCanvas.vue` → e.g. `src/components/routing/RoutingDetailCanvas.vue` (exact name is an implementation detail per decision §0.1.1).
- [ ] Add description edit/add controls to the renamed canvas (currently read-only at `CircuitCanvas.vue:11`), matching the existing pattern at `BrokeringRoute.vue:65-75`.
- [ ] Add `userStore.hasPermission('ROUTING_TEST_DRIVE_VIEW')` gating to the canvas's status/schedule/run-now controls, matching `BrokeringRoute.vue:79`.
- [ ] Fold `BrokeringQuery.vue`'s rule/filter/sort/action editor into the canvas as the expanded content of the accordion-style routings list (per §5) — one active routing/rule at a time, reusing the existing `activeRoutingId`/`activeRule`/`selectedRule` state, no second route.
- [ ] Update `CircuitChatCanvas.vue` to receive `routingGroupId` as a prop sourced from the route (`route.params.routingGroupId`), not from `useCircuitStore().activeContext` set via a picker modal.
- [ ] Delete `RoutingRuleSelectionModal.vue`, `CircuitIntro.vue`, `CircuitStart.vue`, and `Circuit.vue`.
- [ ] Update `src/store/circuit.ts`: remove or repurpose `activeContext` — confirm during implementation whether any part of it is still needed for chat thread/message persistence (as distinct from "which group is selected").
- [ ] `src/router/index.ts`: remove the `/circuit` route entirely (including its nav-menu entry, `menuIndex: 12`); remove the `/brokering/:routingGroupId/:orderRoutingId/rules` route; point `/brokering/:routingGroupId/routes` at the renamed canvas component.
- [ ] Delete `src/views/BrokeringRoute.vue` and `src/views/BrokeringQuery.vue` — fully superseded.
- [ ] Re-grep the repo for any remaining references to `/circuit`, `Circuit.vue`, `BrokeringRoute.vue`, `BrokeringQuery.vue`, or the other deleted components (including `DashboardSummary.vue` and any test files) to confirm nothing else imports them.
- [ ] Manually verify: from the calendar page (Part 1), click a run and land directly on the new canonical page with the group loaded, chat available inline, description editable, test-drive gated by permission, and a routing's rules expandable/collapsible in place with no route change.

#### 3. Extend the Manifest for Group-Level Fields and Variation Awareness

- [ ] In `src/utils/brokeringRulesManifest.ts`, add `brokeringRun.description` (and, as follow-ons, `groupName`/schedule/etc. per decision §0.1.9) to `editableTargets`, and extend `applyBrokeringRulesOperation()` to recognize and apply `brokeringRun.*` target prefixes (today it only recognizes `route.*`/`selectedRule.*`).
- [ ] Design and add an "active context" field to the manifest (live group vs. a specific `variationId`), sourced from the state Task 4 introduces on the canonical page.
- [ ] Update the draft-apply logic so a proposed change writes into the live group's store when no variation is active, or into the active variation's working copy when one is. This is explicitly the least-specified item in this plan — expect real design work during implementation rather than a mechanical change, and don't be surprised if this task reveals sub-tasks not listed here.
- [ ] Manually verify: ask the assistant to edit the group description with no variation active (applies live); once Task 4 lands, switch to an active variation and confirm the same kind of ask applies to the variation's working copy instead.

#### 4. Integrate Simulation Into the Canonical Page

- [ ] Move `VariationsModal.vue` (Task 1) from `src/components/simulation/` into the canonical page's component tree (e.g. rendered from the renamed canvas), wired to the same `simulationStore.ts`.
- [ ] Add "active context" state to the canonical page (live group vs. a specific variation), surfaced via a status indicator (e.g. reusing the existing chip pattern) plus the "Manage variations" entry point from Task 1.
- [ ] Wire the canonical page's traditional controls (description, schedule, routings list, rule editor) to read/write against whichever context is active — live group data or the active variation's working copy — rather than always the live group.
- [ ] Confirm the manifest/draft-apply variation-awareness from Task 3 is fully wired to this same active-context state, not a second, disconnected concept.
- [ ] Manually verify: switch to a variation on the canonical page, edit its rules, ask the assistant a question about it, switch back to baseline with unsaved changes (confirm the warning fires), and confirm nothing written to the variation leaked into the live group.

#### 5. Manual Validation (full pass)

- [ ] Confirm `/circuit` and the old rules sub-route both 404 or are otherwise fully gone from the router.
- [ ] Confirm the nav menu no longer shows a separate "Circuit" entry.
- [ ] Confirm the calendar page (Part 1) still routes correctly into the canonical page with the group pre-loaded.
- [ ] Confirm `Simulation.vue`/`/simulate/:routingGroupId` still works for anything not covered by this plan (running/results/comparison) — Task 1's changes to `SimulationCanvas.vue` shouldn't have broken it.
- [ ] Grep for "Circuit" branding outside `CircuitChatCanvas.vue`/`useCircuitStore()` to confirm the rebrand (decision §0.1.1) actually landed where intended.
- [ ] Run `npm run build` and confirm it still succeeds.

### Execution Order

1. Task 1 (Variations modal) — fully specified, lowest risk, ships independent value; do first.
2. Task 2 (canonical page merge) — the largest mechanical chunk; do this once Task 1's modal exists so Task 4 has something concrete to fold in later.
3. Task 3 (manifest group-level + variation-aware) — depends on Task 2's canonical page existing as the place these targets are used from.
4. Task 4 (simulation integration) — depends on Tasks 1-3 all being in place; this is where "genuinely combined, at the same time" actually lands.
5. Task 5 (full validation).

### Non-Goals (Part 2)

- No backend work for persisted variation rename/delete (decisions 3, §0.1.8) — that lives in "the routing sim component," a repo not available in this session; this plan only specifies the frontend call shape.
- No Mastra/circuit-server-side changes (decision §0.1.10) — explicitly not this plan's concern.
- No running/results/comparison work for simulation (decision §0.1.6) — `runActiveVariation()`, `PastSimulationDetail.vue`, batch runs, and any comparison UI are deferred to a future planning round; `Simulation.vue` is not being retired by this plan.
- No visual/interaction redesign beyond what's needed to fold the pieces together — reuse existing Ionic components and modal patterns already used elsewhere in this codebase.
- Does not modify anything covered by Part 1 beyond what Part 1 already plans — Part 2 depends on Part 1 landing first but doesn't redo its work.
