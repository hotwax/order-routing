# Order Routing Open Work Closeout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close already-delivered Order Routing issues, rescue and ship the local-only work, repair the remaining open PRs, and finish the larger cross-repository features without mixing unrelated changes.

**Architecture:** Treat each row in the ranked backlog as its own review gate. Rebuild stale work from current `origin/main` in isolated worktrees, keep issue hygiene separate from code changes, and use dependency gates for Product Calendar, Replenishment, and Simulation so the frontend is never presented as shipped before its backend contract is available.

**Tech Stack:** Vue 3, Ionic Vue, TypeScript, Pinia, Vitest, Vite, pnpm, GitHub Actions, Maarg `/rest/s1` APIs.

**Spec:** Live GitHub PR/issue state captured on 2026-09-18, the local branches/worktrees in this repository, and `docs/superpowers/plans/2026-07-01-replenishment-card.md` for replenishment behavior.

## Global Constraints

- Work from `/Users/adityapatel/Documents/GitHub/ionic-apps/accxui/apps/order-routing`; it is the nested `hotwax/order-routing` repository.
- Preserve the dirty `inventory/selected-product-ui` checkout until both its committed and uncommitted patches have been reproduced and verified from current `origin/main`.
- Use a separate worktree for every implementation PR. Do not repurpose the primary dirty checkout.
- Never push directly to `main`, rewrite published history, force-push, merge, deploy, close an issue, or delete a branch/worktree without the corresponding execution authority.
- Before every push, inspect the actual repository root, branch, status, remotes, upstream, commits, and diff from `origin/main`.
- A green unit test or build is not UI proof. Run the app against a real available Maarg backend for user-visible behavior.
- Do not implement server-paginated filters as client-side filtering of the current page.
- Keep Product Calendar, Replenishment, and Simulation dependency state explicit; frontend green does not prove the backend stack is merged or deployed.

---

## Evidence Snapshot

- Current main: `d553526`, the squash merge of PR #562.
- Open frontend PRs authored by Aditya: #503, #557, #567.
- Local-only branch: `inventory/selected-product-ui` at `56f5d10`, with eight UI-polish commits after PR #562's reviewed head `1b23097`.
- Uncommitted local history fix: four files, 41 additions and 8 deletions; its two focused test files currently pass 8/8.
- Full tests on the stale local branch are not a release signal: 59 suites passed, 7 suites failed, and 4 tests failed. Rebuild from current main before using the full suite as evidence.
- The `order-routing-pr-562` worktree is clean and points at merged PR #562. It is not active product work.

## Ranked Backlog: Simplest to Hardest

| Rank | Work item | Current evidence | Finish definition | Estimate |
|---:|---|---|---|---:|
| 1 | ✅ Completed — Close issue [#448](https://github.com/hotwax/order-routing/issues/448) | PR #449 merged; current main contains explicit `Select`/`Done` mode and ID-based selection | Verified, delivery comment added, and issue closed on 2026-09-18 | 10–15 min |
| 2 | ✅ Completed — Close issue [#450](https://github.com/hotwax/order-routing/issues/450) | PR #453 merged | Verified, delivery comment added, and issue closed on 2026-09-18 | 10–15 min |
| 3 | ✅ Completed — Close issue [#451](https://github.com/hotwax/order-routing/issues/451) | PR #455 merged | Verified, delivery comment added, and issue closed on 2026-09-18 | 10–15 min |
| 4 | ✅ Completed — Close issue [#454](https://github.com/hotwax/order-routing/issues/454) | PR #457 merged | Verified, delivery comment added, and issue closed on 2026-09-18 | 10–15 min |
| 5 | ✅ Completed — Close issue [#458](https://github.com/hotwax/order-routing/issues/458) | PR #463 merged | Verified, delivery comment added, and issue closed on 2026-09-18 | 15–20 min |
| 6 | ✅ Completed — Close issue [#452](https://github.com/hotwax/order-routing/issues/452) | First PR #461 closed unmerged; replacement PR #465 merged | Verified, delivery comment added, and issue closed on 2026-09-18 | 20–30 min |
| 7 | ✅ Completed — Validate and disposition the local inventory-history timestamp fix | PR #568 merged; the UI uses `createdStamp` with an `effectiveDate` response fallback, focused tests pass 8/8, the full build passed 398/398 tests, and live API/UI QA succeeded | Completed by merged PR #568; keep #467 open for its broader server-pagination, filtering, and search scope | 0.5–1 day |
| 8 | ✅ Completed — Repair and ship PR [#503](https://github.com/hotwax/order-routing/pull/503) | Current `main` merged without rewriting history; product-store session state was unified under `productStore.ts`; `pnpm build` passed 67 files / 411 tests plus production build; live store-switch UAT and Node 20/22 GitHub checks passed | Merged through the normal review flow on 2026-09-18 | 0.5–1 day |
| 9 | ✅ Completed — Ship selected-product Inventory polish in PR [#569](https://github.com/hotwax/order-routing/pull/569) | PR #569 merged from current `main`; follow-up PR [#570](https://github.com/hotwax/order-routing/pull/570) removed custom Ionic button sizing and fixed the selected-product summary with a responsive CSS grid; 68 test files / 417 tests, production build, desktop/mobile QA, bulk-action QA, and Node 20/22 CI passed | Completed through the normal review flow on 2026-09-18 | 1–2 days |
| 10 | ✅ Completed — Finish issue [#443](https://github.com/hotwax/order-routing/issues/443) | PR [#572](https://github.com/hotwax/order-routing/pull/572) merged the remaining native-search QOH and negative/range filter matrix | Completed through the normal review flow on 2026-09-18 | 1–3 days |
| 11 | ✅ Completed — Ship replenishment metrics and card ([#481](https://github.com/hotwax/order-routing/issues/481) + [#479](https://github.com/hotwax/order-routing/issues/479)) | PR [#573](https://github.com/hotwax/order-routing/pull/573) merged on 2026-09-19, closing both issues. It delivers the native metrics layer, editable Inventory Detail card, ATP trend, sales-velocity/incoming breakdowns, and newest-first inventory-history fallback; 71 test files / 451 tests and GitHub Node 20/22 checks passed, with live Rails UI QA | Merged through the normal review flow | Completed |
| 12 | ✅ Completed — Replenishment card parent [#479](https://github.com/hotwax/order-routing/issues/479) | Child UI issue #482 remains closed and its stacked PR was never merged; the rebuilt card shipped directly in merged PR [#573](https://github.com/hotwax/order-routing/pull/573) | Delivered with item 11; no separate card PR remains | Completed |
| 13 | 🟡 Backend implementation complete — finalize ProductFacility regression coverage for [OMS #1064](https://github.com/hotwax/oms/issues/1064) | [OMS #1060](https://github.com/hotwax/oms/pull/1060) merged on 2026-09-19 and #1064 is closed; it exposes `maximumStock` and `reorderQuantity` in the search contract. Companion [oms-test #248](https://github.com/hotwax/oms-test/pull/248), containing the 5 focused read/search/null/store regressions, remains open. Weighted-average-cost work stays owned by [OMS #1062](https://github.com/hotwax/oms/pull/1062) | Merge or deliberately disposition #248, then prove the deployed search response includes both nullable fields | One test-only PR and deployed-contract proof remain |
| 14 | Ready and ship Product Calendar PR [#567](https://github.com/hotwax/order-routing/pull/567) | Draft; 9 files, 551 additions; CI green; one `src/locales/en.json` conflict; depends on draft OMS #1049 and connector #768 | Resolve main conflict, add focused tests, validate against deployed backend stack, mark ready, review, merge through normal flow | 2–4 frontend days plus dependencies |
| 15 | ✅ Done for now — complete the Inventory-history data-contract prerequisite for [#467](https://github.com/hotwax/order-routing/issues/467) | [OMS #1065](https://github.com/hotwax/oms/pull/1065) and [connector #785](https://github.com/hotwax/mantle-shopify-connector/pull/785) are in review. Together they expose applied cycle-count decisions and persist direct sales-order context for every new return receipt path. | Resume #467's separate server-pagination, filtering, order-name resolution, and per-page-state work after these reviews/deployment; main still has the 250-row client-side pipeline. | 3–5 days when resumed |
| 16 | Replace and ship Simulation Wizard PR [#557](https://github.com/hotwax/order-routing/pull/557) | 25 files, 2,669 additions/1,256 deletions, nine merge-conflict files, five unresolved review threads, two CI failures, and three open cross-repo dependencies | Extract only simulation files onto current main, address all P1/P2 findings, add tests, verify the real four-repo flow, close #557 as superseded by the clean PR | 5–10 days across repositories |

---

## Delivery Clusters

### Cluster A: Inventory Intelligence and Replenishment

**Scope:** frontend issues #481 and #479 in PR #573, backend issue [OMS #1064](https://github.com/hotwax/oms/issues/1064) in PR #1060 with companion test PR #248, and the related but independent inventory-history issue #467.

**User outcome:** A truthful Inventory Detail experience: scalable movement history, a replenishment card with ATP trend, sales velocity and inbound units, and editable replenishment settings persisted through the native ProductFacility store.

**Execution sequence:**

1. ✅ PR #573 merged on 2026-09-19 after UI approval, live Rails QA, and Node 20/22 checks. It is the frontend delivery: native metrics, the Inventory Detail card, direct ProductFacility saves, facility-safe refreshes, and client-side validation for maximum stock/reorder quantity.
2. 🟡 OMS #1060 merged on 2026-09-19 and exposes `maximumStock` and `reorderQuantity` in the ProductFacility search contract. Its separate regression companion, oms-test #248, remains open; it must be merged or deliberately dispositioned before this backend stream is fully closed.
3. Run #467 independently. When it server-paginates history, reconcile the metrics input so the trend and 30-day velocity remain time-scoped rather than derived from a visible page subset.
4. OMS #1064 was closed with #1060. Deployed search/read-write behavior still needs explicit proof; #573 merged independently because the direct native ProductFacility contract already supports the editable fields.

**Why this stays two product PRs:** #573 owns frontend workflow composition and client validation; #1060 owns the backend search contract. oms-test #248 is the required regression companion because backend tests live in a separate repository. #467 remains separate because server history scale is its own correctness change.

### Cluster B: Product Availability Policy

**Scope:** Product Calendar PR #567 and its OMS #1049 / connector #768 dependencies.

**User outcome:** Set product lifecycle dates per ProductStore, sync the mapped Shopify data, and apply ATP rules based on those dates.

**Boundary:** It influences availability policy, but it neither supplies replenishment metrics nor shares the #467 history contract. Keep it as an independent release stream; it can run in parallel with Cluster A once its backend dependencies are deployed.

### Cluster C: Simulation Setup

**Scope:** stale Simulation Wizard PR #557 and its OMS, OrderRouting, and sim-routing dependencies.

**User outcome:** A feature-gated, truthfully verified simulation setup workflow.

**Boundary:** It has no inventory-metric or replenishment dependency. Keep it isolated and last because its stale diff and multi-repository dependencies make it the highest-risk stream.

---

### Task 1: Close the Six Already-Delivered Issues

**Issues and delivery evidence:**

- #448 → merged PR #449
- #450 → merged PR #453
- #451 → merged PR #455
- #452 → merged replacement PR #465; PR #461 was not merged
- #454 → merged PR #457
- #458 → merged PR #463

**Files:**

- Inspect: `src/views/Inventory.vue`
- Inspect: `src/components/AddProductFiltersModal.vue`
- Inspect: `src/components/ProductFilters.vue`
- Inspect: `src/components/FacilityGroupFilters.vue`
- Inspect: `src/store/productStore.ts`
- Inspect: Circuit routing components touched by PR #463

**Interfaces:**

- Consumes: current `origin/main` and the six merged PR timelines.
- Produces: six closed issues with concise delivery comments; no code changes.

- [ ] **Step 1: Confirm each merged PR is reachable from current main**

```bash
for pr in 449 453 455 465 457 463; do
  gh pr view "$pr" --repo hotwax/order-routing --json number,state,mergedAt,mergeCommit,url
done
```

Expected: every PR reports `state: MERGED` and a non-null `mergedAt`.

- [ ] **Step 2: Verify the corresponding behavior in current source and focused tests**

```bash
rg -n "selectMode|selectedProductIds|matched products|facility.*count|identifier|schedule" src tests
pnpm exec vitest run tests/inventorySelection.test.ts tests/addProductFiltersModal.test.ts tests/circuitProposalContext.test.ts
```

Expected: relevant behavior is present and focused tests pass. If a behavior has no focused test, perform the smallest browser verification before closing its issue.

- [ ] **Step 3: Comment and close each issue**

Use the issue-specific comments below so every closure names the verified behavior and actual merged PR:

```bash
gh issue close 448 --repo hotwax/order-routing --comment "Verified on current main: Inventory has explicit Select/Done mode with stable product-ID selection. Delivered by PR #449. Closing this issue as shipped."
gh issue close 450 --repo hotwax/order-routing --comment "Verified on current main: the pickup tag selector shows tag counts and the live matched-product total. Delivered by PR #453. Closing this issue as shipped."
gh issue close 451 --repo hotwax/order-routing --comment "Verified on current main: the pickup facility-group selector shows facility counts and the live net selection. Delivered by PR #455. Closing this issue as shipped."
gh issue close 452 --repo hotwax/order-routing --comment "Verified on current main: Store Pickup matched-products preview uses the applied product filters. Delivered by replacement PR #465; PR #461 was not merged. Closing this issue as shipped."
gh issue close 454 --repo hotwax/order-routing --comment "Verified on current main: the Product Store identifier preference loads without the prior dataDocumentView 400 path. Delivered by PR #457. Closing this issue as shipped."
gh issue close 458 --repo hotwax/order-routing --comment "Verified on current main: Circuit preserves routing context, schedule action, and selected routing state. Delivered by PR #463. Closing this issue as shipped."
```

Expected: only the verified issues are closed. Any mismatch stops that issue's closure and creates a focused follow-up instead.

---

### Task 2: Rescue and Validate the Local Inventory-History Timestamp Fix

**Files:**

- Modify: `src/composables/useProductFacility.ts` — request creation-time ordering with stable detail keys.
- Modify: `src/views/InventoryDetail.vue` — display/filter by `createdStamp`, falling back to `effectiveDate` for older OMS responses.
- Test: `tests/inventoryDetailChannelScope.test.ts`
- Test: `tests/useProductFacility.test.ts`

**Interfaces:**

- Consumes: current scoped history endpoint delivered by Order Routing PR #556 and OMS PR #732.
- Produces: `historyDate = row.createdStamp ?? row.effectiveDate` and request ordering `createdStamp desc,inventoryItemDetailSeqId desc,inventoryItemId desc`.

- [ ] **Step 1: Capture the dirty four-file patch without modifying the primary checkout**

```bash
git diff --binary -- src/composables/useProductFacility.ts src/views/InventoryDetail.vue tests/inventoryDetailChannelScope.test.ts tests/useProductFacility.test.ts > /private/tmp/order-routing-created-stamp.patch
git diff --check -- src/composables/useProductFacility.ts src/views/InventoryDetail.vue tests/inventoryDetailChannelScope.test.ts tests/useProductFacility.test.ts
```

Expected: the patch contains only the four intended files and `git diff --check` is clean.

- [ ] **Step 2: Create an isolated worktree from current main**

At execution time, use `superpowers:using-git-worktrees`. Create a dedicated branch such as `fix/inventory-history-created-stamp` from `origin/main`; do not switch or clean the primary checkout.

- [ ] **Step 3: Validate the real scoped-history contract before deciding to ship the patch separately**

Against the target Maarg instance, confirm that the scoped endpoint returns `createdStamp` and accepts this order without silently ignoring or rejecting it:

```text
orderByField=createdStamp desc,inventoryItemDetailSeqId desc,inventoryItemId desc
```

Also compare records whose `effectiveDate` is missing or backdated so the product meaning of "history date" is explicit.

- [ ] **Step 4: Apply the captured patch in the fresh worktree**

```bash
git apply /private/tmp/order-routing-created-stamp.patch
pnpm exec vitest run tests/inventoryDetailChannelScope.test.ts tests/useProductFacility.test.ts
```

Expected: 2 test files and 8 tests pass, matching the observed local result.

- [ ] **Step 5: Run the full gate from the fresh main-based worktree**

```bash
pnpm typecheck
pnpm test:unit
pnpm build
```

Expected: no failures introduced by the patch. Record any unrelated baseline failure separately rather than weakening the focused assertions.

- [ ] **Step 6: Browser-verify the history contract against a real Maarg instance**

```bash
pnpm dev --host 0.0.0.0 --port 8104
```

Verify `/inventory/:productId` at one real facility:

- rows are newest-created first;
- equal creation times remain stable by detail sequence/item ID;
- displayed dates use `createdStamp`;
- records without `createdStamp` still display/filter through `effectiveDate`;
- the seven-day filter uses the displayed history date.

- [ ] **Step 7: Choose the disposition using the live API evidence**

- If `createdStamp` ordering is supported and creation time is the accepted user-facing meaning, ship the four-file patch as a small prerequisite PR before Task 6.
- If the endpoint cannot filter/order consistently by creation time, preserve the tests and fold the timestamp requirement into Task 6's backend contract instead of opening a frontend-only PR that only partly works.
- If product intent remains effective-time history, document that decision and do not ship the local patch.

- [ ] **Step 8: Commit and open a focused PR only for the supported, accepted outcome**

```bash
git add src/composables/useProductFacility.ts src/views/InventoryDetail.vue tests/inventoryDetailChannelScope.test.ts tests/useProductFacility.test.ts
git commit -m "fix: order and filter inventory history by creation time"
```

After CI, review, and merge, link the timestamp PR from #467 as a prerequisite/follow-up. Keep #467 open until Task 6's full server-pagination, filtering, and search acceptance criteria are delivered.

---

### Task 3: Repair PR #503 Without Rewriting Its Published Branch

**Files:**

- Modify/resolve: `src/store/userStore.ts`
- Verify: `src/main.ts`
- Verify: `src/store/atpProductStore.ts`
- Verify: `src/store/productStore.ts`
- Verify: `src/utils/omsInstance.ts`
- Test: `tests/omsInstanceScope.test.ts`

**Interfaces:**

- Consumes: cookie-backed connected OMS key and current persisted product-store state.
- Produces: instance-stamped caches that clear and refetch user, permission, ATP-store, and ecommerce-store state on an OMS switch; in-flight old-instance responses are discarded.

- [ ] **Step 1: Create a worktree on the published PR branch and merge current main**

Use `superpowers:using-git-worktrees`. Check out `origin/fix/oms-instance-scope-product-stores` to a local branch with the same name, then merge `origin/main`. Do not rebase or force-push the published branch.

Expected: the merge reports one content conflict in `src/store/userStore.ts`.

- [ ] **Step 2: Resolve `userStore.ts` by preserving both current-main behavior and PR #503's scope reset**

Keep these invariants:

```ts
// On mismatch, clear user profile and permissions before refetching.
this.current = null;
this.permissions = [];

// During a hydrate refetch, restore profile and permissions from the connected instance.
await this.fetchUserProfile();
await this.fetchPermissions();
```

Preserve current-main routing/util cleanup and do not reintroduce any removed legacy store behavior.

- [ ] **Step 3: Run the focused and full gates**

```bash
pnpm exec vitest run tests/omsInstanceScope.test.ts
pnpm typecheck
pnpm test:unit
pnpm build
```

Expected: the eight scope tests pass and the full build is green.

- [ ] **Step 4: Repeat the live switch-without-logout scenario**

Verify that switching between two real OMS connections:

- removes the previous instance's Product Stores immediately;
- refetches profile and permissions;
- does not accept a late response from the previous OMS;
- performs no redundant store refetch on a healthy same-instance reload.

- [ ] **Step 5: Push only the PR branch and request review**

Before pushing, run the mandated repository/branch/upstream/diff checks. Push the existing feature branch only; do not target `main`.

---

### Task 4: Rebuild the Local Selected-Product UI Polish on Current Main

**Files:**

- Modify: `src/views/Inventory.vue`
- Modify: `src/components/ProductSearchModal.vue`
- Modify: `src/composables/useProductSearch.ts`
- Test: `tests/inventoryEntityFirstSearch.test.ts`
- Test: `tests/productSearchModal.test.ts`
- Test: `tests/productSearchSummary.test.ts`

**Interfaces:**

- Consumes: the entity-first Inventory implementation already merged through PR #562.
- Produces: selected-product summaries grouped by parent/style, clear actions, compact outlined filters, and preserved grouping across Inventory filter changes.

- [ ] **Step 1: Capture only the post-#562 committed patch**

```bash
git diff --binary 1b23097..56f5d10 -- src/views/Inventory.vue src/components/ProductSearchModal.vue src/composables/useProductSearch.ts tests/inventoryEntityFirstSearch.test.ts tests/productSearchModal.test.ts tests/productSearchSummary.test.ts > /private/tmp/order-routing-selected-product-polish.patch
```

Expected: the patch excludes the uncommitted Inventory Detail timestamp work and all pre-#562 entity-first implementation.

- [ ] **Step 2: Apply the patch in a fresh worktree from `origin/main`**

Create a new task branch from `origin/main`, apply the patch, and resolve only current-main overlap. Do not cherry-pick the entire stale branch because PR #562 was squash-merged and the old branch still carries obsolete file deletions and dependency state.

- [ ] **Step 3: Preserve current-main invariants while resolving overlap**

Verify the reconstructed diff does not remove or regress:

- `FacilitySelectModal.vue` and its current tests;
- entity-first server pagination;
- current loading-state invalidation;
- explicit Select/Done behavior;
- multi-facility scope and route serialization;
- current `uuid` dependency and main build configuration.

- [ ] **Step 4: Run focused tests, full tests, and build**

```bash
pnpm exec vitest run tests/inventoryEntityFirstSearch.test.ts tests/productSearchModal.test.ts tests/productSearchSummary.test.ts
pnpm typecheck
pnpm test:unit
pnpm build
```

- [ ] **Step 5: Browser-verify desktop and mobile widths**

Confirm selected product groups, variant counts, clear buttons, facility/channel switching, route persistence, pagination, and Select mode all remain coherent.

- [ ] **Step 6: Commit as one reviewable UI-polish PR**

Do not preserve the eight local commits as an eight-commit review stack unless a reviewer needs that history. The shippable unit is one selected-product filter-polish change.

---

### Task 5: Resolve Issue #443 Against the Product That Now Exists

**Files:**

- Modify: `src/views/Inventory.vue`
- Modify if the API adapter needs typed params: `src/composables/useProductFacility.ts`
- Test: `tests/inventoryEntityFirstSearch.test.ts`
- Test: `tests/productFacilityRows.test.ts`

**Interfaces:**

- Consumes: current server-side ProductFacility search and current filter card from PR #562.
- Produces: a documented, server-side filter contract with accurate totals and pagination.

- [ ] **Step 1: Record the current acceptance delta on #443**

Current main already has:

- a top filter card;
- facility/channel scope;
- sort selector;
- pickup and brokering filters;
- `minimumStock_from`;
- `availableToPromise_from`;
- server-side filtering before pagination.

Current main does not fully match the issue's original matrix for ATP positive/negative, QOH positive/negative, and safety-stock less-than/greater-than.

- [ ] **Step 2: Validate the real Maarg query contract before adding controls**

Against the target Maarg instance, verify `_from`/`_thru` behavior for:

```text
availableToPromise_from
availableToPromise_thru
quantityOnHand_from
quantityOnHand_thru
minimumStock_from
minimumStock_thru
allowPickup
allowBrokering
orderByField
```

Expected: filters affect `totalCount` before pagination. If any parameter is unsupported, stop the frontend task and create the narrow backend dependency rather than shipping a no-op control.

- [ ] **Step 3: Make the product decision explicit**

Choose one of these outcomes based on current product intent:

1. The streamlined current filter set is accepted: comment that PR #562 superseded the original broad matrix, document the supported controls, and close #443.
2. The original matrix remains required: add operator/value state for ATP, QOH, and safety stock and map it to the validated `_from`/`_thru` query contract.

- [ ] **Step 4: If implementing, cover the request payload and pagination totals**

Add focused tests proving each operator resets `pageIndex` to `0`, sends the correct server params, and updates the result count from the filtered server response. Do not filter `products.value` in the browser.

- [ ] **Step 5: Run full validation and close #443 only after the accepted outcome is present**

```bash
pnpm exec vitest run tests/inventoryEntityFirstSearch.test.ts tests/productFacilityRows.test.ts
pnpm build
```

---

### Task 6: Complete Server-Driven Inventory History for Issue #467

**Files:**

- Modify: `src/views/InventoryDetail.vue`
- Modify: `src/composables/useProductFacility.ts`
- Modify: `src/store/orderRoutingStore.ts`
- Verify/modify only as needed: `src/utils/inventoryMovement.ts`
- Modify: `src/locales/en.json`
- Test: `tests/useProductFacility.test.ts`
- Test: `tests/inventoryDetailChannelScope.test.ts`
- Create focused tests for server pagination, search resolution, filter resets, and empty/error states.

**Interfaces:**

- Consumes: `GET oms/products/{productId}/facilities/{facilityId}/inventoryDetail`, the OrderHeader join delivered by OMS #732, and current Solr order lookup in `orderRoutingStore`.
- Produces: `{ rows, total }` for one server page, server date/type/order filters, exact order-ID resolution, and UI paging driven by the backend total.

- [ ] **Step 1: Verify the deployed backend contract before changing UI state**

Against the target Maarg instance, verify:

```text
pageIndex
pageSize
orderByField
orderId
orderId_op=in
orderTypeId
effectiveDate_from
effectiveDate_thru
X-Total-Count
```

Confirm `X-Total-Count` is browser-readable through `Access-Control-Expose-Headers`. Resolve Task 2's creation-time versus effective-time decision here: if creation time is accepted, the backend must expose equivalent `createdStamp_from`/`createdStamp_thru` semantics before the UI sends them.

- [ ] **Step 2: Write failing composable tests for server paging and total count**

Cover:

- path encoding for product/facility IDs;
- `pageSize: 20` and zero-based `pageIndex`;
- date, order type, and order ID parameters passed unchanged;
- `orderId_op: "in"` when multiple IDs are supplied;
- total count read from the response header;
- no fallback to the old `pageSize: 250` fetch.

- [ ] **Step 3: Change `fetchInventoryLogs` to return a page result**

Use this contract:

```ts
interface InventoryHistoryPage {
  rows: any[];
  total: number;
}

async function fetchInventoryLogs(params: {
  productId: string;
  facilityId: string;
  pageIndex: number;
  pageSize: number;
  orderByField: string;
  effectiveDate_from?: string;
  effectiveDate_thru?: string;
  orderTypeId?: string;
  orderId?: string;
  orderId_op?: "in";
}): Promise<InventoryHistoryPage>
```

If Task 2 selects creation-time history, replace the two `effectiveDate` fields with the validated `createdStamp` fields consistently in the type, tests, and UI.

- [ ] **Step 4: Write failing order-search resolution tests**

Cover:

- an input that matches the accepted order-ID shape skips Solr;
- a name resolves through `docType: ORDER` to one or more exact IDs;
- multiple IDs are joined with comma plus `orderId_op=in`;
- zero matches set an explicit empty result and never issue an unfiltered history request.

- [ ] **Step 5: Add a focused order-name resolver to `orderRoutingStore.ts`**

Reuse the existing backend-aware Solr adapter and return `string[]` order IDs. Keep the existing per-page order-summary enrichment so movement labels/classification continue to work for returned rows.

- [ ] **Step 6: Replace the client-side 250-row pipeline in `InventoryDetail.vue`**

Remove the history-only uses of:

- `pageSize: 250`;
- full-array `filteredMovements` as the pagination source;
- full-array `pagedMovements` slicing;
- `filteredMovements.length` as total count.

Keep movement classification and expansion state for the current page. Filter/search/date changes reset the server page to zero, cancel or ignore stale requests, and render loading/empty/error state for the active request only.

- [ ] **Step 7: Make non-order movement type behavior explicit**

Sales, Transfer, and Purchase map to `SALES_ORDER`, `TRANSFER_ORDER`, and `PURCHASE_ORDER`. For Return, Cycle Count, Rollover, Receipt, and Adjustment, either map to validated server fields or label them out of scope and omit unsupported chips; do not pretend `orderTypeId` can distinguish null-order movements.

- [ ] **Step 8: Run focused and full gates**

```bash
pnpm exec vitest run tests/useProductFacility.test.ts tests/inventoryDetailChannelScope.test.ts
pnpm typecheck
pnpm test:unit
pnpm build
```

- [ ] **Step 9: Browser-verify full-history behavior against real data**

Use a high-velocity product with more than 250 movements. Verify page totals, rewind beyond the former cap, rolling/custom dates, direct order-ID search, order-name search with multiple matches, zero-match empty state, order-type filtering, facility switching, row expansion, ATP/QOH balance, and Fast Travel links.

- [ ] **Step 10: Merge through review and close #467 with complete evidence**

Link OMS #732, Order Routing #556, the Task 2 disposition, and the final server-history PR. Do not close #467 based on #556 alone; that PR explicitly delivered only the scoped endpoint repoint.

---

### Task 7: Ready Product Calendar PR #567 After Its Backend Stack Is Real

**Files:**

- Create tests for: `src/store/productCalendarStore.ts`
- Create tests for: `src/components/ProductCalendarConditionModal.vue`
- Modify/resolve: `src/locales/en.json`
- Verify: `src/components/RuleDetails.vue`
- Verify: `src/components/RuleItem.vue`
- Verify: `src/components/circuit/RoutingGroupEditor.vue`
- Verify: `src/utils/routingWorkingCopy.ts`
- Verify: `src/views/ProductStoreProductCalendar.vue`

**Interfaces:**

- Consumes: OMS PR #1049 calendar/date-rule services and connector PR #768 Shopify metafield synchronization.
- Produces: ProductStore calendar list, Shopify mapping/populate actions, and ATP rule date conditions that survive working-copy projection and save.

- [ ] **Step 1: Keep #567 draft while dependencies remain drafts**

```bash
gh pr view 1049 --repo hotwax/oms --json state,isDraft,mergeStateStatus,url
gh pr view 768 --repo hotwax/mantle-shopify-connector --json state,isDraft,mergeStateStatus,url
```

Current evidence: both are open drafts and blocked. Do not call #567 release-ready until their contracts are reviewed and available in the target environment.

- [ ] **Step 2: Merge current main into the published #567 branch**

Use an isolated worktree and a normal merge. Resolve the single known conflict in `src/locales/en.json` by retaining both current-main Inventory strings and Product Calendar strings. Do not force-push.

- [ ] **Step 3: Add focused contract tests**

Cover:

- ProductStore ID is required before calendar fetch/populate;
- lifecycle dates and Shopify mapping state map from the backend response;
- `days since` and `days till` conditions retain operator, value, and date field;
- working-copy clone/projection/save retains calendar conditions;
- `/inventory-policies` redirects to `/product-calendar`.

- [ ] **Step 4: Run frontend gates**

```bash
pnpm typecheck
pnpm test:unit
pnpm build
```

Expected: retain the existing Node 20 and Node 22 CI green state after the main merge.

- [ ] **Step 5: Validate the deployed integration**

Against the target environment, set dates for one ProductStore, populate/map one Shopify product, create an ATP rule using a date condition, save, reload, and confirm the condition still appears. Record which backend PRs/commits and environment were tested.

- [ ] **Step 6: Mark ready and request review only after the dependency and UAT gates pass**

---

### Task 8: Rebuild Replenishment Metrics for Issue #481

**Files:**

- Create: `src/utils/replenishmentMetrics.ts`
- Create: `src/composables/useReplenishmentMetrics.ts`
- Test: `tests/replenishmentMetrics.test.ts`
- Reference: `docs/superpowers/plans/2026-07-01-replenishment-card.md`

**Interfaces:**

- Consumes: scoped Inventory Detail rows, Maarg-native `admin/search/query`, purchase-order detail, and transfer-order detail.
- Produces: trend points, sales velocity, incoming units, and metric-level unavailable state.

- [x] **Step 1: Start from current main, not closed PR #483 or its obsolete base branch**

Use the existing replenishment plan as the implementation spec. Copy behavior, types, and tests; do not resurrect the old branch wholesale.

- [x] **Step 2: Implement pure utilities test-first**

Cover numeric conversion, timestamp sorting, ATP-total fallback, negative sales ATP joined to `SALES_ORDER`, and incoming remaining quantities.

- [x] **Step 3: Implement the Maarg composable with failure isolation**

Use the live Maarg-native `admin/search/query` payload/response shape directly; do not use `solr-query`, `hotwax-oms`, or a legacy response-compatibility wrapper. Cache order details by `orderId` per composable instance. Incoming lookup failure sets `incomingUnavailable` without failing Inventory Detail.

- [x] **Step 4: Run focused and full gates**

```bash
pnpm exec vitest run tests/replenishmentMetrics.test.ts
pnpm build
```

- [x] **Step 5: Validate the live inventory/search contracts and source-owned purchase/transfer response shape; open replacement PR [#573](https://github.com/hotwax/order-routing/pull/573) linked to #481**

Close #481 only after the rebuilt PR merges; do not cite closed draft PR #483 as delivery.

---

### Task 9: Finish the Replenishment Card Parent Issue #479

**Files:**

- Create: `src/components/ReplenishmentCard.vue`
- Modify: `src/views/InventoryDetail.vue`
- Modify: `src/composables/useProductFacility.ts`
- Modify: `src/locales/en.json`
- Test: `tests/replenishmentMetrics.test.ts`
- Add focused component test for: `src/components/ReplenishmentCard.vue`

**Interfaces:**

- Consumes: Task 8 metrics and current ProductFacility config.
- Produces: editable reorder point, truthful unavailable states for unsupported fields, trend graph, sales velocity, incoming units, and refresh-after-save.

- [x] **Step 1: Implement from the existing replenishment plan on top of Task 8**

Use direct native ProductFacility reads and writes for nullable `maximumStock` and `reorderQuantity`; do not fabricate zeroes or derive fake values.

- [x] **Step 2: Add the Ionic card and inline SVG graph without a new chart dependency**

Use the component props/emits and source rules from `docs/superpowers/plans/2026-07-01-replenishment-card.md`.

- [x] **Step 3: Wire save and refresh into Inventory Detail**

Save changed, non-negative integer replenishment fields, then refetch ProductFacility configuration and replenishment metrics.

- [x] **Step 4: Run focused tests, build, and live browser validation**

Verified facility switching, input reset, empty/unavailable states, replenishment save behavior, incoming/sales metric drill-downs, and the Rails-backed Inventory Detail UI. The final frontend suite passed 71 files / 451 tests.

- [x] **Step 5: Merge through review and close #479 with #481 and the card PR linked**

PR #573 merged on 2026-09-19 and closed #479 and #481.

---

### Task 10: Deliver the Backend Contract for Issue #1064

**Files:**

- Owning backend component: determine from current Maarg ProductFacility entity/service definitions before editing.
- Modify the ProductFacility read/search contract to expose nullable `maximumStock` and `reorderQuantity`.
- Modify the write contract to persist validated non-negative integers.
- Add backend service/entity tests in the owning repository.
- Update frontend typing and card enablement only after deployed validation.

**Interfaces:**

- Consumes: ProductFacility identity `(productId, facilityId)`.
- Produces: nullable read values and persisted updates for `maximumStock` and `reorderQuantity`.

- [x] **Step 1: Resolve the owning entity/service from source, not assumptions**

Inspect current Maarg component entity definitions and the services behind:

```text
GET oms/productFacilities/search
GET oms/productFacilities
POST oms/productFacilities
```

- [ ] **Step 2: Merge the focused backend regressions for absent, present, and update cases**

Acceptance:

- absent values return null/omitted consistently, never fabricated zero;
- exact product/facility lookup returns configured values;
- POST persists both non-negative integers;
- client-side validation rejects invalid negative or non-integer input; #248 covers native read/search/null/store behavior and remains open.

- [x] **Step 3: Implement the narrow backend change and validate it in source**

- [x] **Step 4: Enable the two card inputs through native ProductFacility reads and writes**

- [x] **Step 5: Link the backend and frontend delivery on #1064, then close it**

OMS #1060 and #1064 merged/closed on 2026-09-19. The remaining gate is the open oms-test #248 regression companion plus a deployed search-response check.

---

### Task 11: Replace the Monolithic Simulation Wizard PR #557

**Files to carry forward:**

- `src/views/SimulationSetupWizard.vue`
- `src/components/simulation/SimulationWizardStepList.vue`
- `src/config/simulationSetupSteps.ts`
- `src/services/SimApiService.ts`
- simulation-specific additions in `src/router/index.ts`
- simulation-specific additions in `src/locales/en.json`
- Add focused tests for wizard state transitions and failure paths.

**Files not to carry forward from #557:**

- Unrelated Inventory/entity-first files already delivered by PR #562.
- Deleted general routing components unrelated to Simulation Setup.
- Old Inventory tests already superseded by current main.

**Interfaces:**

- Consumes: OMS PR #984, OrderRouting PR #130, and sim-routing PR #538.
- Produces: feature-gated setup wizard with real replica verification, datastore provisioning, ingestion, readiness, and authenticated handshake behavior.

- [ ] **Step 1: Preserve the simulation-only diff, then build a new branch from current main**

Do not merge the stale PR branch: merge simulation shows nine conflict files and the PR carries unrelated PR #562 work. Extract only the listed simulation files and narrow route/locale changes into a clean worktree.

- [ ] **Step 2: Gate the route with the existing simulation contract**

The `/simulation-setup` route must use the same `simulateGuard` and `meta.featureFlag: "simulation"` contract as `/simulate`. Disabled or invalid configuration must not render a crashing menu destination.

- [ ] **Step 3: Replace every false-success path with verified state**

Required invariants from unresolved review threads:

- “Verify replica access” performs a real request and only marks success on a valid response.
- Provision failure never fabricates datastore ID `10000`.
- Fill/ingestion failure never sets `fillCompleted` or displays success.
- A paginated 50-row product page is never used to decide whether all filtered products are stocked.

- [ ] **Step 4: Restore the simulation API security boundary and fix CI**

Current CI failures in `tests/simApiSecurity.test.ts` require:

- missing OMS session token rejects before any request;
- callers cannot replace trusted bearer credentials or JSON content type.

Run:

```bash
pnpm exec vitest run tests/simApiSecurity.test.ts
pnpm test:unit
pnpm build
```

- [ ] **Step 5: Add wizard-specific failure and recovery tests**

Cover disabled feature flag, replica failure, provisioning failure, fill failure, readiness polling, API-key propagation, resume after reload, and successful completion.

- [ ] **Step 6: Verify the dependency stack before end-to-end UAT**

```bash
gh pr view 984 --repo hotwax/oms --json state,isDraft,mergeStateStatus,url
gh pr view 130 --repo hotwax/OrderRouting --json state,isDraft,mergeStateStatus,url
gh pr view 538 --repo hotwax/sim-routing --json state,isDraft,mergeStateStatus,url
```

Current evidence: all three are open; OMS #984 and OrderRouting #130 are blocked, while sim-routing #538 is clean but unreviewed.

- [ ] **Step 7: Run the real four-repository workflow**

Validate feature flag, remote auth, replica access, datastore provisioning, ingestion, readiness, and opening the resulting simulation. Capture exact environment and PR heads.

- [ ] **Step 8: Open the clean replacement PR, link #557, and close #557 as superseded**

Do not merge or deploy the replacement until CI, review threads, dependency PRs, and end-to-end UAT are all complete.

---

## Execution Waves

1. **Same-day hygiene:** Task 1.
2. **Small shippable fixes:** Tasks 2 and 3 in parallel.
3. **Inventory UX cleanup:** Task 4, then Task 5.
4. **Inventory Intelligence and Replenishment:** merge Task 8 / PR #573, then run server history Task 6 and backend Task 10 in parallel. Reconcile the metrics data boundary before Task 9 builds the card.
5. **Product Availability Policy:** Task 7 can proceed in parallel when OMS #1049 and connector #768 are deployed; it does not block Cluster A.
6. **Simulation:** Task 11 last, because it has the largest stale diff, highest safety risk, and widest dependency surface.

## Final Closeout Gate

- [ ] Every issue in the ranked table is closed with delivery evidence or explicitly superseded with a linked replacement.
- [ ] Every open PR is either merged through review or closed as superseded; none is left stale without a stated disposition.
- [ ] The primary `inventory/selected-product-ui` checkout is untouched until both local patches are reproduced elsewhere.
- [ ] All replacement branches are based on the then-current `origin/main` and contain only their stated task.
- [ ] Focused tests, full tests, build, and browser evidence are recorded separately.
- [ ] Cross-repository features name the exact backend PRs and deployed test environment.
- [ ] Worktree/branch deletion is proposed separately and performed only with explicit approval.
