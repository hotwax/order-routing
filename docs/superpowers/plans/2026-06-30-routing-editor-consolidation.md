# Routing Editor Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Brokering, Circuit, and Simulation routing editors around one routing editor workflow where the Circuit canvas layout becomes the shared visual shell, Brokering remains the production behavior source of truth, Simulation remains in-memory, and Circuit becomes an embedded chat-assisted side panel.

**Architecture:** Build a shared routing editor canvas/shell that can run with live, circuit-assisted, or simulation adapters. The live adapter must keep current production Brokering detail behavior and use the recent single-JSON save flow instead of the older chunk-wise route/rule/filter save path. Circuit should reuse the same editor state and mount chat as a side panel; Simulation should reuse the shell while routing edits stay confined to `simulationStore.working`.

**Tech Stack:** Vue 3, Ionic Vue core components, Pinia stores, AccxUI pnpm wrapper build, existing order-routing stores/services, no `ion-grid`, and no backend API contract changes.

---

## User Brief Snapshot

- Create one shared routing editor canvas used by live Brokering detail mode, Circuit-assisted mode, and Simulation mode.
- Use the Circuit page's horizontal canvas layout: fixed-width horizontal columns, independent vertical scrolling per column, routing group column, routing detail column, and rule detail column.
- Preserve Brokering regular as canonical production behavior: OMS loading and saves, route/rule test mode, history, archived items, complete empty states, unsaved-change guard, and production rule/filter/sort behavior.
- Preserve Circuit behavior as editor assistance: selected routing/rule context, prompt area, draft proposal prepare/apply/discard, feedback, threads, and dev last-prompt tooling.
- Preserve Simulation behavior as non-destructive: initialize from `simulationStore.working`, normalize flat variation filters/actions into editor shape, sync local edits back into `simulationStore.working`, and never write OMS routing config from simulation mode.
- Remove normal rendering of `CircuitIntro` and `CircuitStart`; `/circuit` should route to the editor/chat workflow or show an editor empty state plus chat.
- Existing Brokering and Simulation URLs must continue to work.
- Keep the Brokering calendar view as the primary list view and entry point into routing detail pages.
- No backend route or API contract changes.

## Latest User Corrections

- Use all applicable skills, subagents, and background/headless threads where they help keep context clean.
- Treat this as a large migration, not a quick component swap.
- Focus heavily on UX before saying the work is complete.
- Save path must now follow the recent single-JSON save flow, not the older chunk-wise saving.
- Brokering calendar should remain the primary list/entry view for routing details.
- Ionic UI work must stay grounded in core Ionic components, avoid `ion-grid`, avoid duplicated screen information, and preserve existing styling/CSS.
- Re-read and preserve the whole plan after context compaction; this document is the durable source of truth for that.

## Non-Negotiable Constraints

- Work from `/Users/adityapatel/Documents/GitHub/order-routing-consolidate-editor` on branch `codex/consolidate-routing-editor`.
- Use the AccxUI wrapper root for build/test commands: `/Users/adityapatel/Documents/GitHub/accxui`, command `pnpm --filter order-routing build`.
- Do not touch unrelated dirty files in the original checkout.
- Do not edit existing CSS or styling code.
- New CSS is allowed only when necessary for layout and must not change font or color properties.
- Prefer core Ionic components.
- Do not use `ion-grid`, `ion-row`, `ion-col`, or Ionic grid utility classes.
- Remove duplicate on-screen information when consolidating UI.
- Browser QA must include the in-app Browser/local app because the user is looking at localhost.

## UX And Styling Guardrails

- Keep Brokering's calendar view as the primary operational entry point; routing detail pages remain downstream of that list/calendar workflow.
- Build UI changes with Ionic primitives that are straightforward to maintain in Ionic Vue.
- Do not change existing CSS/styling code while consolidating behavior; add only scoped layout CSS when unavoidable and never change font or color properties.
- Prefer removing repeated labels or duplicate summaries over adding more panels.
- Keep the Circuit intro/start experience out of normal rendering; `/circuit` should start in the editor/chat workflow.

## Current Relevant Files

- Live production detail editor: `src/views/BrokeringQuery.vue`
- Brokering group/list route: `src/views/BrokeringRoute.vue`
- Circuit route: `src/views/Circuit.vue`
- Circuit chat/editor shell: `src/components/circuit/CircuitChatCanvas.vue`
- Circuit canvas layout and draft-apply mechanics: `src/components/circuit/CircuitCanvas.vue`
- Simulation page: `src/views/Simulation.vue`
- Simulation editor fork: `src/components/simulation/SimulationCanvas.vue`
- Stores/services: `src/store/orderRoutingStore.ts`, `src/store/circuit.ts`, `src/store/simulationStore.ts`, `src/services/VariationService.ts`

## Confirmed Findings

- The recent live single-JSON save flow is `orderRoutingStore().saveRoutingGroupRaw(currentRoutingGroup)`.
- `saveRoutingGroupRaw` posts the whole transformed group to `order-routing/groups`, then reloads `order-routing/groups/:routingGroupId/raw`.
- `BrokeringRoute.vue` already uses this flow for routing-group saves.
- `BrokeringQuery.vue` now builds a full routing-group editor payload and commits through `saveRoutingGroupRaw`; the remaining `deleteRoutingFilters`, `updateRouting`, `deleteRuleConditions`, `deleteRuleActions`, and `updateRule` calls are local store mutations feeding the single-JSON save, not backend chunk saves.
- `CircuitCanvas.vue` still has older local-edit helper names from the Circuit branch, but these should be treated as local editor-state helpers unless a fresh audit finds an API write.
- Simulation save/update variation flows are separate and must remain separate; they persist through `sim-routing` variation endpoints, not live OMS `order-routing/groups`.

## Execution Tasks

### Task 1: Single-JSON Save Payload

- [x] Create a tested helper that folds editor dictionaries into a full routing group payload.
- [x] Denormalize UI-only field names before save:
  - `*_excluded` field names must be sent without the suffix when the operator is `not-equals` or `not-in`.
  - sort field names listed in `VITE_FILTER_SORT_DESC` must be sent with ` desc`.
- [x] Remove transient UI flags such as `hasUnsavedChanges` from the POST payload.
- [x] Use this helper from live detail editors before calling `saveRoutingGroupRaw`.
- [x] Strip client-generated UUID routing/rule IDs, including nested filter/action owner IDs, before the single-JSON save so new locally drafted children are created by the backend.

### Task 2: Brokering Detail Preservation

- [x] Keep `BrokeringQuery.vue` as the functional source of truth.
- [x] Keep the Brokering calendar as the primary list/entry point into routing detail; do not replace it with the older route list as the main entry.
- [x] Preserve route/rule test mode, history modal, archived rule modal, add-filter modals, empty states, and unsaved-change guard.
- [x] Replace its chunk-wise save implementation with the full-group save helper plus `saveRoutingGroupRaw`.
- [x] Avoid cosmetic replacement with CircuitCanvas if it would drop production behavior.

### Task 3: Shared Editor Shell

- [x] Create shared files under `src/components/routing-editor/`.
- [x] Provide a common `RoutingEditorCanvas` entry point with `mode: "live" | "circuit" | "simulation"`.
- [x] Use the Circuit fixed-column/per-column-scroll layout as the visual baseline.
- [x] Keep live, circuit, and simulation adapters separate enough that simulation cannot invoke live saves.

### Task 4: Circuit as Editor Chat Panel

- [x] Update `src/views/Circuit.vue` so it always renders the chat-assisted editor, not intro/start pages.
- [x] Update `CircuitChatCanvas.vue` to mount the shared editor canvas and pass selected context.
- [x] Preserve draft proposal prepare/apply/discard/revise/feedback, threads, and dev last-prompt modal.
- [x] Show a useful editor empty state when no routing context is selected.

### Task 5: Simulation Integration

- [x] Route Simulation through the shared shell while preserving the existing `SimulationCanvas` adapter behavior.
- [x] Open Simulation from the Brokering routing detail canvas without leaving the Brokering detail URL.
- [x] Seed Simulation from the already loaded live Brokering routing group while keeping edits inside `simulationStore.working`.
- [x] Preserve the selected Brokering route when the simulation workspace opens.
- [x] Keep variation controls and run comparison in `Simulation.vue` / `simulationStore`.
- [x] Confirm no live OMS save is reachable from simulation mode.

### Task 6: UX Review

- [x] Confirm first screen is the usable editor/chat experience.
- [x] Confirm routing group, routing detail, and rule detail information is not duplicated unnecessarily.
- [x] Confirm horizontal scrolling and independent column scrolling work on desktop and narrow viewports.
- [x] Confirm empty states are concrete and action-oriented.
- [x] Confirm icon-only actions have labels or ARIA labels where needed.
- [x] Confirm no text overlap/overflow in desktop and narrow viewport screenshots.
- [x] Confirm no existing font or color styling was changed.

### Task 7: Verification

- [x] Run targeted unit tests for the save-payload helper.
- [x] Build from `/Users/adityapatel/Documents/GitHub/accxui` with `pnpm --filter order-routing build`.
- [x] Browser QA `/circuit`: intro/start gone, chat/editor render, context selection works.
- [x] Browser QA Brokering detail: existing production behavior remains usable and save uses single JSON.
- [x] Browser QA Simulation: edits remain variation/in-memory and do not call live save.
- [x] Check browser console for missing translation keys and Vue/Ionic warnings.

## Current Verification Notes

- `/circuit` rendered in the in-app Browser at `http://127.0.0.1:8213/circuit` without the intro/start flow.
- Circuit layout metrics confirmed horizontal canvas scrolling at desktop and narrow viewport widths; the loaded group column had independent vertical scrolling, while routing/rule columns fit within the viewport for the selected data set.
- `/brokering` server response is healthy and the router now maps it to `BrokeringRunsCalendar.vue`; `/brokering-calendar` redirects to `/brokering`.
- In-app Browser automation timed out while loading/evaluating the Brokering route twice; treat that as a Browser automation blocker, not proof of an app loading failure.
- Chrome QA confirmed `/brokering` renders the Brokering runs calendar with no visible spinner, no framework overlay, and run data loaded.
- Chrome QA confirmed `/brokering` -> `SV.run2` opens the Brokering run detail at `/brokering/M100104/routes`, then `Standard` opens the routing detail canvas at `/brokering/M100104/M100102/rules`.
- Chrome QA confirmed the side menu only exposes `Brokering` under the `Routing` section; Circuit and Simulation remain route-compatible but are not separate menu entries.
- Chrome QA confirmed the routing detail canvas reloads after the rule-list key fix with no visible spinner, no framework overlay, Circuit and Simulate toolbar actions present, and one visible `SV` rule row.
- Unit tests now cover nested temporary UUID stripping for newly drafted rules and full ID stripping for brand-new routing groups before `saveRoutingGroupRaw`.
- Chrome QA confirmed the `Simulate` toolbar action opens an in-detail simulation workspace and preserves the Brokering detail URL instead of routing to `/simulate/:routingGroupId`.
- Chrome QA confirmed the in-detail simulation workspace seeds from the current live group, selects `Standard`, shows the `SV` rule, shows the baseline variation state, and renders at about `1220px x 1248px` instead of the earlier narrow card modal.
- Chrome QA caught an immediate dirty-state regression in the simulation modal. Fixes added after that check:
  - Circuit and Simulation modal contents now mount only while their modal is open, avoiding hidden editor initialization.
  - Simulation normalizes a freshly loaded baseline/variation and then calls `simulationStore.markWorkingClean()` so no-op editor normalization does not look like a user edit.
  - The simulation variation rail now disables run while dirty and prompts before switching/resetting/deleting away from unsaved simulation changes.
  - Standalone Circuit chat proposals now carry a routing context key and reject stale apply/revise actions after context changes, matching the embedded assistant panel.
  - `RoutingEditorAssistantPanel` is wrapped in `ion-page` so IDE trace attributes no longer produce Vue fragment warnings.
- Fresh Chrome QA after those fixes confirmed:
  - `/brokering/M100104/M100102/rules` renders the rule editor with no framework overlay and no visible spinner.
  - `Simulate` opens the in-detail simulation workspace cleanly with no immediate `unsaved changes`, `Save first`, or discard prompt.
  - Closing Simulation returns to the Brokering detail page without a discard prompt.
  - `Circuit` opens the in-detail Circuit Assistant panel with the staged-change save reminder.
  - The only fresh console issue in that smoke was the backend/data 404 for `categories/CODEX219`; no Vue/Ionic warning or missing translation warning was observed.
- Current Chrome console still reports backend/data 404s for product categories (`categories/CODEX219`) and earlier testing-session checks (`oms/entityData`); these appear independent of the editor consolidation and do not block rendering.
- 2026-06-30 frontend-debugging pass:
  - In-app Browser automation timed out on both the selected tab and a fresh `/brokering` tab before returning DOM/screenshot state.
  - Fallback Playwright with a fresh Chrome executable proved the Vite app shell mounts and redirects unauthenticated `/brokering` to `/login` without a framework overlay or stuck loader.
  - Registry-driven UI login could not complete because both `test-maarg` and `localhost-8080` hit the Login component's SAML branch and navigated to `/undefined?relaystate=...`; direct `test-maarg` Moqui `admin/login` returned 404, and `localhost-8080` was unreachable from the script.
  - Patched `BrokeringRunsCalendar.fetchRuns()` so the calendar loader always clears in `finally` and shows a translated failure toast on load errors.
  - Patched `BrokeringQuery.onIonViewWillEnter()` so the global detail loader always dismisses in `finally`, and auxiliary reference-data calls use `Promise.allSettled()` so one bad reference endpoint cannot keep the editor blocked.
  - Patched `routingGroupEditorPayload` so list-owned rule `statusId`/`sequenceNum` wins over stale cached rule detail during single-JSON save.
  - Patched `routingGroupEditorPayload` so filter entries without real values are dropped while `ENTCT_SORT_BY` sort entries and `0` filter values are preserved.
  - Added Vitest coverage for stale rule metadata and blank-filter single-JSON regressions.
  - Re-ran `pnpm --filter order-routing exec vitest run tests/routingEditorEnv.test.ts tests/routingGroupEditorPayload.test.ts`: 9 tests passed.
  - Re-ran `pnpm --filter order-routing build`: passed with only existing Vite CJS/module-federation eval/large-chunk warnings.
- 2026-06-30 authenticated Chrome frontend-debugging pass:
  - In-app Browser remained blocked by automation timeouts, so validation used the existing authenticated Chrome session per the frontend-debugging fallback path and local Chrome-session requirement.
  - `/brokering` mounted the Brokering runs calendar, then data resolved to the heatmap/list state with no visible spinner, no framework overlay, and `10 Runs` including `SV.run2`.
  - Clicked `SV.run2` from the calendar list and confirmed navigation to `/brokering/M100104/routes` with the Brokering run detail, scheduler/history, and `Standard` route card visible.
  - Clicked `Standard` and confirmed navigation to `/brokering/M100104/M100102/rules` with the shared routing detail editor rendered, `Circuit` and `Simulate` actions present, `SV` rule content visible, no visible spinner, and the live save FAB still disabled on clean load.
  - Confirmed the in-detail `Circuit` modal opens on the Brokering detail URL with the selected `Standard` context and staged-save reminder.
  - Confirmed the in-detail `Simulation` modal opens on the Brokering detail URL, its horizontally scrolling canvas exposes the offscreen rule-detail columns, and toggling a simulation-only setting produced zero live network save requests.
  - Confirmed dirty simulation close shows the discard prompt, discard closes the modal cleanly, and the live Brokering save FAB remains disabled afterward.
  - Screenshot evidence saved outside the repo at `/tmp/order-routing-qa/calendar-loaded.png` and `/tmp/order-routing-qa/routing-detail-loaded.png`.
  - Sanitized console summary still shows only the known backend category lookup 404 for `CODEX219`; no framework overlay, missing translation warning, or Vue/Ionic warning was observed in this pass.
- 2026-06-30 live-editor audit follow-up:
  - Subagent audit found three concrete editor regressions: first-rule creation could replace formatted action/filter maps with raw arrays, excluded promise-date display/save was inconsistent, and standalone `/circuit` archived-rule unarchive lacked the modal callback used by Brokering detail.
  - Patched `BrokeringQuery.fetchRuleInformation()` to keep the formatted `fetchInventoryRuleInformation()` result instead of overwriting it with raw rule data, preserving first-rule action edits in the single-JSON payload.
  - Patched excluded promise-date handling so the excluded row shows its own selected value, uses the negative operator, and saves `promiseDaysCutoff` instead of the UI-only `promiseDaysCutoff_excluded` field.
  - Patched standalone `CircuitCanvas` archived-rule unarchive to stage local rule state through `saveRules`, and patched its add-rule path to rebind the local canvas after store mutation, mark dirty, and select the created rule.
  - Patched raw save sanitization so cloned/new routings and rules drop copied `conditionSeqId`/`actionSeqId` owner-child identifiers, and so `isNew` remains available for save branching but is stripped from the outgoing POST payload.
  - Added Vitest coverage for first-rule action payloads, excluded promise-date payloads, cloned route child-ID stripping, stale rule metadata, blank filters, and new-group ID stripping.
  - Re-ran `pnpm --filter order-routing exec vitest run tests/routingEditorEnv.test.ts tests/routingGroupEditorPayload.test.ts`: 12 tests passed.
  - Re-ran `pnpm --filter order-routing build`: passed with only existing Vite CJS/module-federation eval/large-chunk warnings.
  - Authenticated Chrome post-patch smoke on `/brokering/M100104/M100102/rules` settled with no visible spinner, no framework overlay, `Standard` and `SV` rendered, and the clean-load save FAB disabled. Sanitized console still showed only the known `CODEX219` backend category lookup 404.
- 2026-06-30 responsive and loader-race pass:
  - In-app Browser desktop viewport loaded `/brokering/M100255/M100408/rules` with all editor columns visible, no framework overlay, no visible spinner, no fresh console errors, and no text overflow from the DOM scan.
  - Narrow viewport (`390x844`) initially exposed that BrokeringQuery still stacked columns vertically, which violated the shared Circuit-style horizontal canvas requirement.
  - Patched the narrow BrokeringQuery layout so the route column, inventory-rule list, and rule-detail panel become three fixed-width horizontal columns with per-column vertical scrolling.
  - The first narrow reload exposed a shared Ionic loader race: fast page dismissals could happen before `loadingController.create()` / `present()` completed, leaving a stale loader overlay.
  - Patched `App.vue` loader handling with request IDs so stale async `presentLoader` calls cannot present after a matching dismiss.
  - Patched `BrokeringQuery` to load route/rule state first and move non-critical facility/category/shipping reference data into a background `Promise.allSettled`, so slow reference data cannot block the editor canvas.
  - In-app Browser narrow viewport then proved `main.scrollWidth=1125` vs `clientWidth=390`, horizontal scroll to the rule-detail column, independent rule-detail vertical scroll (`scrollTop=194`), no visible spinner or loader overlay, no framework overlay, no fresh console errors, and no text overflow from the DOM scan.
- 2026-06-30 in-app Browser loading and save-path pass:
  - Patched routing-group schedule loading so the calendar only requests schedules for groups with `jobName`, and current-group schedule loading treats missing schedules as optional instead of logging a hard error.
  - Patched `saveRoutingGroupRaw(payload, { saveSchedule })` so ordinary live editor saves do not repost schedule data. `BrokeringRoute.vue` now tracks schedule edits explicitly and passes `saveSchedule: true` only when the schedule modal changed the job.
  - In-app Browser fresh reload of `/brokering?qa=loading-fix` settled to the Brokering runs calendar with `11 Runs`, no visible spinner, no framework overlay, and no fresh console warnings/errors after the reload timestamp.
  - In-app Browser clicked `Rejected Orders` from the calendar list, confirmed `/brokering/100153/routes` rendered routing run detail with scheduler/history and no fresh console warnings/errors, then clicked `Rejected items` and confirmed `/brokering/100153/M100156/rules` rendered the shared routing editor with Circuit/Simulate controls and no visible spinner.
  - CDP request interception during a harmless `Clear auto cancel days` edit/save fulfilled the live save locally, so OMS was not mutated. Captured requests were `OPTIONS /order-routing/groups`, one mutating `POST /order-routing/groups`, and `GET /order-routing/groups/100153/raw`; there was no `POST /order-routing/groups/:id/schedule` and no chunk-wise route/rule/filter endpoint.
- 2026-06-30 schedule-status save follow-up:
  - Audited the Brokering run page schedule status select and patched `BrokeringRoute.saveRoutingGroup()` so a successful save clears the page dirty state, matching the routing detail editor behavior.
  - Confirmed schedule status changes keep the explicit schedule-save path: in-app Browser CDP interception captured `POST /order-routing/groups`, `POST /order-routing/groups/100153/schedule`, and `GET /order-routing/groups/100153/raw`.
  - Fulfilled all three requests locally during QA so no OMS schedule mutation was made, and confirmed the visible Save FAB returned to disabled state after the successful intercepted save.
  - Screenshot evidence saved at `/tmp/order-routing-qa/brokering-run-schedule-save-clean.png`.
- 2026-06-30 frontend-testing-debugging loading regression pass:
  - Reproduced the current "not loading" symptom in the in-app Browser: `/brokering` calendar rendered, but clicking `Tuesday 8 AM` -> `Rejected Orders` opened `/brokering/100153/routes` with `No order batches yet` and no `/order-routing/groups/100153/raw` request.
  - Root cause was persisted `orderRoutingStore.currentGroup` state with an empty `routings` array short-circuiting `fetchCurrentRoutingGroup()`. Patched the shortcut so only a new group or a raw-loaded unsaved group can bypass the `/raw` fetch.
  - Added `isRoutingGroupDetailLoaded` as an internal raw-detail marker and stripped it from the single-JSON save payload.
  - Re-ran the in-app Browser flow `/brokering` -> current-hour cell -> `Rejected Orders`; CDP captured `GET /order-routing/groups/100153/raw`, `GET /order-routing/groups/100153/schedule`, and routing history, and the run detail showed the `Rejected items` order batch instead of the empty state.
  - Clicked `Rejected items` and confirmed `/brokering/100153/M100156/rules` rendered the shared routing editor with `Circuit`, `Simulate`, route filters, inventory rules, and rule actions visible.
  - Changed category reference-data loading to use the Maarg API base instead of the OMS base, removing the CORS preflight failure. The `categories/STORE` endpoint still returns a backend 404 on demo data; this remains optional reference data and does not block editor rendering.
  - Screenshot evidence saved at `/tmp/order-routing-qa/brokering-rules-loading-fix.png`.
- 2026-06-30 unsaved editor state follow-up:
  - Added `buildRoutingGroupEditorDraftPayload()` so the live editor can stage the current route/rule/filter/action draft into Pinia without denormalizing UI-only fields or invoking the save API.
  - Circuit and Simulation toolbar actions are now available while the live editor is dirty, except during test mode, and they stage the current unsaved editor draft before opening.
  - Simulation continues to seed from the staged group and remains non-destructive; live OMS writes still only happen through the explicit single-JSON save path.
  - Fixed route test highlighting to read `testRoutingInfo.unmatchedOrderFilters`, matching the test component/store key.
  - Added `orderRoutingStore.discardCurrentGroupChanges()` so Discard reloads the persisted raw group instead of only clearing the dirty flag. Wired this into both Brokering run detail and routing detail unsaved-change prompts.
  - Added Vitest coverage for draft-payload staging and raw discard reloading.
  - Re-ran `pnpm --filter order-routing exec vitest run tests/orderRoutingStore.test.ts tests/utilStore.test.ts tests/routingGroupEditorPayload.test.ts tests/routingEditorEnv.test.ts`: 17 tests passed.
  - Re-ran `pnpm --filter order-routing build`: passed with only existing Vite CJS/module-federation eval/large-chunk warnings.
  - Browser QA limitation in this pass: in-app Browser control repeatedly timed out when reloading or reading the target tab, Chrome profile tabs on `8213` were at `/login`, and an isolated Playwright fallback also redirected to `/login`. The server itself responded `200 OK` on `http://127.0.0.1:8213/brokering/100153/M100156/rules`, so this pass is verified by build/unit/static evidence rather than authenticated rendered interaction.
- 2026-06-30 frontend-testing-debugging follow-up:
  - Re-read the frontend-testing-debugging, in-app Browser, and AccxUI workflow instructions before debugging the current loading complaint.
  - In-app Browser automation connected and returned documentation, but selecting/navigating the tab hung until the browser-control kernel reset, so Browser rendered QA is still blocked by automation rather than by a confirmed app error.
  - Verified the running dev server is the AccxUI symlinked checkout: `/Users/adityapatel/Documents/GitHub/accxui/apps/order-routing -> /Users/adityapatel/Documents/GitHub/order-routing-consolidate-editor`.
  - Verified `http://127.0.0.1:8213/brokering` returns Vite HTML and Vite serves the updated Brokering, Circuit, and Simulation modules from this branch.
  - Fallback Playwright with the default cached browser failed because the local Playwright Chromium executable is missing, but `playwright screenshot --channel chrome` succeeded without installing anything and captured a mounted unauthenticated login screen at `/tmp/order-routing-brokering-load.png`; this proves a fresh Chrome context is not seeing a blank app shell or framework overlay.
  - Patched `RoutingEditorAssistantPanel` modal UX so the close action uses the toolbar start slot, the action buttons stay in the toolbar end slot, and the prompt/proposal controls are pinned in an Ionic footer rather than scrolling away with chat history.
  - Patched Circuit and Simulation canvas routing lists to show only active/draft routes in the main reorder list while archived routes remain behind the Archived row, matching the production Brokering mental model and removing duplicated archived information.
  - Patched Circuit archived-route unarchive to stage returned modal changes locally and keep the editor dirty for the single-JSON save instead of refetching immediately.
  - Patched Simulation archived-rule and archived-route unarchive callbacks so they update `simulationStore.working` only, preserve non-destructive behavior, and no longer rely on missing modal callbacks or working-copy reinitialization.
  - Re-ran `pnpm --filter order-routing exec vitest run tests/orderRoutingStore.test.ts tests/utilStore.test.ts tests/routingGroupEditorPayload.test.ts tests/routingEditorEnv.test.ts`: 17 tests passed.
  - Re-ran `pnpm --filter order-routing build`: passed with only existing Vite CJS/module-federation eval/large-chunk warnings.
  - Re-ran `git diff --check`: passed.
- 2026-06-30 frontend-testing-debugging auth/loading pass:
  - In-app Browser control still times out before returning URL/DOM/log/screenshot state, so the rendered check used the documented Playwright fallback with Chrome channel and no dependency changes.
  - A clean browser context redirects `http://127.0.0.1:8213/brokering` to `/login`; the app shell mounts, there is no framework overlay or stuck loader, and the only console issue is `admin/checkLoginOptions` failing against `http://localhost:8080/rest/s1/` because no local OMS is listening.
  - Direct registry-backed `test-maarg` login succeeds via Moqui `admin/login`; secrets were retrieved from Keychain only inside the diagnostic script and were not printed.
  - Seeding the same cookies and persisted user-store shape the app expects lets `/brokering` load the Brokering runs calendar with real `test-maarg` data.
  - Authenticated Chrome QA showed route `/brokering`, no visible spinner, no framework overlay, no console warnings/errors, no page errors, and all observed calendar/schedule requests returned `200`.
  - Interaction proof: clicking the scoped `Active` Ionic segment changed the runs card from `13 Runs` to `8 Runs` and applied the checked segment class.
  - Screenshot evidence saved outside the repo at `/tmp/order-routing-brokering-authenticated.png` and `/tmp/order-routing-brokering-active-filter.png`.
- 2026-06-30 frontend-testing-debugging detail loading and UX pass:
  - Re-ran the named frontend-testing-debugging workflow. In-app Browser setup still connects but tab URL/DOM inspection times out and resets the browser-control kernel, so rendered QA used the documented Playwright fallback with Chrome channel.
  - Verified the app is not blank: `http://127.0.0.1:8213/brokering` returns Vite HTML, and authenticated Chrome with a `test-maarg` session renders the Brokering calendar with real runs, no visible spinner, no framework overlay, no console warnings/errors, and no failed network responses.
  - Verified `/brokering/M100052/routes` renders the Brokering run detail and `/brokering/M100052/M100051/rules` renders the routing editor canvas with Circuit and Simulate controls.
  - Found and fixed a new canvas UX issue: the rule-detail panel was being squeezed by the nested `#inventory-rules` grid on desktop. The new routing-detail layout now treats routing context, route detail, inventory sequence, and rule detail as four horizontal columns with per-column vertical scrolling.
  - Verified desktop detail layout at 1440x900: main editor `scrollWidth=1615`, `clientWidth=1136`, no spinner/overlay/errors, and horizontal scroll brings the rule detail column fully into view at 640px width.
  - Verified narrow detail layout at 390x844: main editor `scrollWidth=1280`, `clientWidth=390`, no spinner/overlay/errors, and horizontal scroll brings the rule detail column fully into the viewport at 320px width.
  - Found and fixed route-list console/network noise: active test-drive sessions now load through `admin/user/sessions`, matching the existing create/expire endpoint family, instead of the missing `oms/entityData` endpoint. Client-side active-session filtering preserves the previous `filterByDate` behavior.
  - Re-ran `pnpm --filter order-routing exec vitest run tests/orderRoutingStore.test.ts tests/routingGroupEditorPayload.test.ts tests/routingEditorEnv.test.ts tests/utilStore.test.ts`: 20 tests passed.
  - Re-ran `pnpm --filter order-routing build`: passed with only existing Vite CJS/module-federation eval/large-chunk warnings.
  - Screenshot evidence saved outside the repo at `/tmp/order-routing-brokering-load-debug.png`, `/tmp/order-routing-routes-after-session-fix.png`, `/tmp/order-routing-detail-layout-before.png`, `/tmp/order-routing-detail-layout-after-scroll.png`, `/tmp/order-routing-detail-mobile-before.png`, and `/tmp/order-routing-detail-mobile-after.png`.
- 2026-06-30 embedded Circuit/Simulation workflow pass:
  - Verified the runtime menu still has Brokering as the only Routing section menu entry; Circuit and Simulation routes remain addressable but do not have menu indexes.
  - Authenticated Chrome QA on `/brokering/M100052/M100051/rules` confirmed the detail canvas exposes `Circuit` and `Simulate` controls while remaining on the Brokering detail URL.
  - Clicking `Circuit` opens `Circuit Assistant` over the current editor context, shows the active `Test1-OrderBatch` context chip, exposes prompt input/thread controls, and leaves the editor visible behind the modal.
  - Clicking `Simulate` opens the variation workspace over the same Brokering detail URL with `Editor`/`Results`, baseline routing content, variation save/run rail, and zero live OMS mutating requests while opening.
  - Verified standalone `/circuit` no longer shows intro/start copy. It renders the chat prompt plus `Select a Routing Context` editor empty state, with no visible spinner, no framework overlay, no console warnings/errors, and no failed network responses.
  - Added the missing `Add routing context` locale key that the standalone chat prompt used for its accessibility label.
  - Re-ran `pnpm --filter order-routing exec vitest run tests/orderRoutingStore.test.ts tests/routingGroupEditorPayload.test.ts tests/routingEditorEnv.test.ts tests/utilStore.test.ts`: 20 tests passed.
  - Re-ran `pnpm --filter order-routing build`: passed with only existing Vite CJS/module-federation eval/large-chunk warnings.
  - Screenshot evidence saved outside the repo at `/tmp/order-routing-one-menu-detail-initial.png`, `/tmp/order-routing-circuit-modal-open.png`, `/tmp/order-routing-simulation-modal-open.png`, and `/tmp/order-routing-standalone-circuit-chat-clean.png`.

## Subagent Work Packets

- Explorer A: Locate and explain the recent single-JSON save flow.
- Explorer B: Inventory BrokeringQuery behavior that must not regress.
- Explorer C: Inventory SimulationCanvas in-memory adapter behavior and live-save risks.
- Explorer D: UX audit of Circuit/Brokering/Simulation editor differences.
- Explorer E: Audit live Brokering detail CRUD/filter/save regressions after consolidation.
