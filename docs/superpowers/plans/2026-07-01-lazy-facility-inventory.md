# Lazy Facility Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Inventory Detail facility switcher render its facility list immediately and load per-facility QOH/ATP only when facility rows enter view.

**Architecture:** Keep facility identity sourced from `props.facilities`. Replace the modal-wide `Promise.all` inventory prefetch with an `IntersectionObserver`-driven per-row loader that caches loaded/pending facilities. Rows render with placeholder inventory until their own lookup resolves.

**Tech Stack:** Vue 3 script setup, Ionic Vue, Vitest, Vue Test Utils, AccxUI wrapper commands.

---

### Task 1: Lazy Inventory Loading In Facility Switcher

**Files:**
- Modify: `src/components/FacilitySwitcherModal.vue`
- Create: `tests/facilitySwitcherModal.test.ts`

- [ ] **Step 1: Write the failing regression test**

Create `tests/facilitySwitcherModal.test.ts` with a Vue Test Utils mount of `FacilitySwitcherModal.vue`. Mock `@ionic/vue`, `@common`, `@/components/EmptyState.vue`, and `IntersectionObserver`.

The test must verify:
- The modal renders facility names immediately without calling `api`.
- The modal does not render the modal-wide `"Fetching facilities"` loading state on mount.
- Inventory lookup is not fired for every facility on mount.
- Triggering one observed row as intersecting calls `api` exactly once with `{ productId, facilityId, pageSize: 1 }`.
- After that API resolves, only that facility row shows its QOH/ATP values.

Run:

```bash
pnpm --filter ./apps/order-routing exec vitest run tests/facilitySwitcherModal.test.ts
```

Expected before implementation: the test fails because `FacilitySwitcherModal.vue` calls all facility inventory lookups from `onMounted(fetchInventoryAcrossFacilities)`.

- [ ] **Step 2: Implement lazy row-based inventory loading**

In `src/components/FacilitySwitcherModal.vue`:
- Remove the modal-wide `isLoading` state and `onMounted(fetchInventoryAcrossFacilities)`.
- Keep the facility list visible immediately from `filteredFacilities`.
- Replace `fetchInventoryAcrossFacilities()` with `fetchInventoryForFacility(facilityId: string)`.
- Cache loaded inventory in `inventoryByFacility`.
- Track pending facility IDs in a local `Set` so repeated observer events do not duplicate calls.
- Add a local custom directive such as `v-lazy-inventory="facility.facilityId"` on each `ion-item`.
- Use `IntersectionObserver` so `fetchInventoryForFacility` runs only when a row enters view.
- Unobserve rows after they trigger and disconnect the observer on unmount.
- If `IntersectionObserver` is unavailable, fall back to fetching when the row mounts.
- Do not edit existing CSS or add new CSS.
- Preserve existing selection behavior and modal dismiss payload.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm --filter ./apps/order-routing exec vitest run tests/facilitySwitcherModal.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run build verification**

Run:

```bash
pnpm --filter ./apps/order-routing build
```

Expected: PASS.

- [ ] **Step 5: Self-review**

Confirm:
- No existing CSS was changed.
- No all-facility `Promise.all` inventory fanout remains.
- The modal list is not blocked by inventory calls.
- The test proves lazy per-row fetch behavior.
