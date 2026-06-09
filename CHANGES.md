# Merge ATP → Routing Rules (decisions log)

Goal: a single app that hosts both **Sourcing rules** (formerly Available to Promise) and **Routing rules** (Brokering).

## Decisions

- **Base app**: refactored `order-routing-rules` (Pinia/Vite branch) copied into `accxui/apps/order-routing-rules`.
- **Stack**: Vue 3 + Vite + Pinia + `@common` (same as ATP and the rest of accxui).
- **Port**: 8100 (replaces the old ATP dev server).
- **User store**: kept routing's `userStore.ts` as the canonical user store. ATP's `user.ts` was NOT copied; its `postLogin`/`postLogout` semantics were folded into the routing user store so both halves of the merged app initialise correctly on login.
- **Product store conflict**: both apps had a `productStore.ts`.
  - Routing's `productStore.ts` (ecomStores + facilities + shippingMethods + facilityGroups + carriers) is kept as `productStore.ts`.
  - ATP's `productStore.ts` (productStores + filters + pickup groups, etc.) is renamed to `atpProductStore.ts` with Pinia id `'atpProductStore'` to avoid a state collision.
- **Component conflicts** (`Logo`, `Image`, `DxpAppVersionInfo`, `ArchivedRuleModal`): routing's versions are kept. ATP's `ArchivedRuleModal` is renamed to `AtpArchivedRuleModal.vue` (different shape — ATP's is for sourcing rules, routing's is for routing rules).
- **App shell**: ATP's side-menu (ion-split-pane) pattern is used as the unified shell. Routing's bottom-tab navigation is replaced by side-menu entries. Existing routing routes are preserved.
- **Routes**: ATP routes are added under their original paths (`/threshold`, `/safety-stock`, `/store-pickup`, `/shipping`, `/inventory-channels`). Routing routes are preserved (`/tabs/brokering`, etc.).
- **Locales**: ATP locale strings are merged into the routing locales/ folder.

## Files copied / changed

New app: `accxui/apps/order-routing-rules/` — seeded from the `origin/order-routing-refactored` branch of the standalone `order-routing-rules` repo (the Pinia/Vite refactor that was never landed in accxui).

From the ATP app (`accxui/apps/available-to-promise`) we pulled in:

- **Views (9 new)**: `Threshold.vue`, `SafetyStock.vue`, `StorePickup.vue`, `Shipping.vue`, `InventoryChannels.vue`, plus their four `CreateUpdate*Rule.vue` siblings.
- **Stores**: `channel.ts`, `rule.ts`, and `atpProductStore.ts` (renamed from `productStore.ts` — Pinia id changed from `'productStore'` → `'atpProductStore'`, export `useProductStore` → `useAtpProductStore`).
- **Components**: every ATP component except `Logo.vue`, `Image.vue`, `DxpAppVersionInfo.vue` (kept routing's version). ATP's `ArchivedRuleModal.vue` was renamed to `AtpArchivedRuleModal.vue` to avoid collision with routing's modal of the same name.
- **Locales**: ATP's `en.json` keys merged into routing's `en.json` (routing wins on conflicts). 490 keys total.
- **Utils**: ATP's `utils/ruleUtil.ts` copied into the new app.

Files changed in the new app:

- `src/App.vue` — replaced routing's bare `ion-router-outlet` with ATP's `ion-split-pane`/side-menu shell. Menu items are grouped by `meta.section` (`sourcing` / `routing`) plus a "General" catch-all.
- `src/router/index.ts` — full rewrite. All ATP routes added with `section: 'sourcing'` meta; routing routes lifted out of `/tabs/*` to top-level (`/brokering`, `/brokering/:routingGroupId/routes`, etc.) with `section: 'routing'`. Legacy `/tabs/*` paths still resolve via redirects so old bookmarks keep working.
- `src/store/userStore.ts` — extended `postLogin` to also call `useAtpProductStore().fetchUserProductStores()` and set the first product store as current; extended `postLogout` to reset the ATP, channel, and rule stores.
- `src/views/Tabs.vue` — removed (no longer referenced).
- `package.json` — renamed to `order-routing-rules`, added ATP-side deps (`cronstrue`, `ionicons`, `qs`, `register-service-worker`, `vite-plugin-pwa`, `boolean-parser`, etc.) using monorepo `catalog:` versions.
- `.env` — converted from `VUE_APP_*` to `VITE_VUE_APP_*` prefixes (refactored branch uses `import.meta.env.VITE_VUE_APP_*`); appended ATP-required vars (`VITE_BASE_URL`, `VITE_ALIAS`, `VITE_DEFAULT_*`, `VITE_LOGIN_URL`).

## Verification status (live in preview on `localhost:8100`)

- Login flow against `test-oms` with `hotwax.user` / `hotwax@786` — works (session persisted via Pinia persistedstate).
- Side menu shows three groups: Sourcing (5), Routing (1), General (1: Settings) — correct.
- Footer shows OMS instance URL and timezone; product store appears once `fetchUserProductStores()` returns.
- All seven menu pages navigated and mounted without JS crashes:
  - `/threshold` → "No threshold rule found." (empty, expected for test-oms)
  - `/safety-stock` → "No safety stock rule found."
  - `/store-pickup` → "No store pickup rule found."
  - `/shipping` → "No shipping rule found."
  - `/inventory-channels` → "No inventory channel found."
  - `/brokering` → "Standard" routing group, schedule "Every day at midnight", next run shown.
  - `/settings` → user profile / Logout / Go to Launchpad render.
- Console errors observed: `[ERROR] No rule group found` and `[ERROR] {}` — these come from `rule.ts` / `channel.ts` when test-oms has no rule groups configured. Identical behaviour to standalone ATP against the same instance, so this is not a regression.

## Open items (please review)

1. **Visual verification**: I navigated programmatically; do a manual click-through to confirm the Ionic transitions, side-menu open/close on small screens, and footer product-store selector behave as expected.
2. **Brokering drill-down screens** (`/brokering/:routingGroupId/routes` etc.) render the route header but I did not exercise create/edit flows. Needs a smoke test with a real rule group.
3. **`@/store/product.ts` vs ATP's product needs**: routing has its own `product.ts` (the "product info" store) which is independent of ATP's `atpProductStore`. They coexist. No conflict observed.
4. **Settings screen**: I kept routing's `Settings.vue`. ATP's `Settings.vue` had a different layout — if you want the ATP fields (e.g., the cache section), they need to be folded in manually.
5. **PWA manifest**: routing's `manifest.json` was used as-is. If the merged app should advertise itself differently to PWA installers, update.
6. **Standalone repo cleanup**: the legacy Vue CLI `order-routing-rules` repo (cwd) is now superseded by `accxui/apps/order-routing-rules`. Decide whether to archive/redirect it.
7. **Old ATP app**: `accxui/apps/available-to-promise` still exists untouched. Once the merged app is signed off, decide whether to delete the ATP app dir or keep it as a reference.

