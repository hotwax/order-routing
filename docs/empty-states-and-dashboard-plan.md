# Empty States & Dashboard — Working Plan

> Status doc. Check off rows as they ship. Last updated 2026-06-16.

## Design principles (empty states)

1. **Informative** — every empty state explains *what the thing is / why you'd create it*, not just "none found."
2. **Progressive, not escape** — actions move the user forward in place: **Create new** or **Use an existing one**. No "change your product store" / "go back" dead-ends.
3. **Wayfinding** — multi-tab views (Shipping, Store pickup — 3 tabs each) surface quick-link cards, one per tab, each with a one-line intro.

## Feasibility note

- **Create new** reuses existing modals/flows everywhere (`CreateUpdateFacilityGroupModal`, `CreateGroupModal`, inline create alerts). No backend work.
- **Use existing** needs **one small new modal** (`LinkExistingGroupModal`) but **no backend work**: the association endpoint (`channelStore.updateGroupAssociationWithProductStore` → `POST /admin/productStores/{id}/facilityGroups/{id}/association`) and the system-wide list (`facilityGroupStore.fetchGroups()`) already exist.

## Components to build

- [ ] `<EmptyState>` — `hero` + `compact` variants. Props: `icon` / `image`, `title`, `message`, `#actions` slot. Replaces ~38 hand-rolled blocks and ~8 duplicated local `.empty-state` CSS blocks.
- [ ] `<SectionWayfinding>` — row of tab quick-link cards (icon + name + one-line intro); emits segment change.
- [ ] `<InlineHint>` — light callout for "default-applies" help text (icon + muted text + optional CTA). Pulls these OUT of `.empty-state`.
- [ ] `LinkExistingGroupModal` — lists system-wide groups of a given `facilityGroupTypeId` *not yet linked* to the current store; links via the existing association API. **The only net-new functional piece; zero backend.**

## Decision table

### A · First-run hero (create; sometimes + use-existing)
- [ ] Inventory channels `InventoryChannels.vue:73` — "Create your first inventory channel" → Create channel (`CreateGroupModal`) · Use existing facility group (`LinkExistingGroupModal`)
- [ ] Brokering runs `BrokeringRuns.vue:75` — "No routing runs yet" → Create brokering run (inline alert); keep image
- [ ] Brokering route `BrokeringRoute.vue:199` — "No order batches yet" → Create order batch
- [ ] Inventory rules `BrokeringQuery.vue:453` — "No inventory rules yet" → Add inventory rule; keep image
- [ ] Threshold `Threshold.vue:22` — "No threshold rules yet" → Create threshold rule
- [ ] Safety stock `SafetyStock.vue:22` — "No safety stock rules yet" → Create safety stock rule
- [ ] Store pickup (rules) `StorePickup.vue:34` — "No store pickup rules yet" → Create rule + wayfinding
- [ ] Shipping (rules) `Shipping.vue:34` — "No shipping rules yet" → Create rule + wayfinding

### B · Prerequisite (create OR use existing, in place)
- [ ] Store pickup facility tab `StorePickup.vue:39` — "No pickup groups yet" → Create pickup group (`CreateUpdateFacilityGroupModal`, type=PICKUP) · Use existing group (`LinkExistingGroupModal`)
- [ ] Threshold form `CreateUpdateThresholdRule.vue:54` — "No channels yet" → Create channel · Use existing channel
- [ ] Safety stock form `CreateUpdateSafetyStockRule.vue:77` — "No facility groups yet" → Create group · Use existing group
- [ ] Store pickup form `CreateUpdateStorePickupRule.vue:78/95` — facility-group / channel → Create · Use existing
- [ ] Shipping form `CreateUpdateShippingRule.vue:78/95` — facility-group / channel → Create · Use existing

### C · Wayfinding hub (Shipping & Store pickup, 3 tabs)
- [ ] Shipping — cards: Product & facility / Product & channel / Facility
- [ ] Store pickup — cards: Product & facility / Product & channel / Facility

### D · Inline hints (convert to `<InlineHint>`, keep CTAs)
- [ ] BrokeringQuery `:58 :207 :293 :366`
- [ ] RuleDetails `:36 :71`
- [ ] RouteDetails `:45 :63`

### E · No-results & misc
- [ ] Shipping / Store pickup facility tab `Shipping.vue:42` / `StorePickup.vue:45` — compact + wayfinding to rule tabs
- [ ] Facility groups `FacilityGroups.vue:20` — informative + Create your first group
- [ ] Add-product-group modal `AddProductFacilityGroupModal.vue:28` — Create a group
- [ ] Link/Manage facilities modals `LinkFacilitiesToGroupModal.vue:32` / `ManageFacilityGroupFacilitiesModal.vue:38` — compact "no match" + clear search
- [ ] Inventory channels — Publish `InventoryChannels.vue:132` — needs Shopify config; informative + navigate if available

### F · Leave as-is
- Modal loading spinners; BrokeringQuery `:449` "select a rule" passive prompt.

## Reusable mechanisms (for wiring CTAs)

| Mechanism | What | File |
|-----------|------|------|
| `CreateUpdateFacilityGroupModal` | create facility group (any type), auto-associates to store | `src/components/CreateUpdateFacilityGroupModal.vue` |
| `CreateGroupModal` | create channel (CHANNEL_FAC_GROUP) + config facility | `src/components/CreateGroupModal.vue` |
| `facilityGroupStore.createGroup()` | create + auto-associate to current store | `src/store/facilityGroupStore.ts:98` |
| `facilityGroupStore.fetchGroups()` | list ALL system-wide groups (powers "use existing") | `src/store/facilityGroupStore.ts` |
| `channelStore.updateGroupAssociationWithProductStore()` | link existing group to store (association API) | `src/store/channel.ts:291` |
| `atpProductStore.fetchPickupGroups()` | list PICKUP groups linked to store | `src/store/atpProductStore.ts:249` |
| inline `alertController.create()` | create run / route / rule | BrokeringRuns/Route/Query |

## Build order

1. **Store pickup vertical slice** (reference) — hero + prerequisite(create/use-existing) + wayfinding. Build `<EmptyState>`, `<SectionWayfinding>`, `LinkExistingGroupModal` here.
2. Replicate to remaining pages, refining the component API.
3. Convert inline hints (`<InlineHint>`).
4. Phase-1 dashboard.

## Dashboard — Phase 1 (locked)

- Real operational data only (no simulation).
- Tiles: sourcing-rule counts (4 ATP types); brokering groups (total / active / **paused** / next-run / **last-run status via N parallel calls**); facility groups & channels; inventory-sync job health.
- Every tile **drills down** into its existing view.
- New `dashboardStore` orchestrates parallel fetches + per-store cache + refresh.
- `/ → /dashboard`; menu entry above the sections. Empty dashboard reuses `<EmptyState>`. No charting lib.
