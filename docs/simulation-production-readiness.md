# Simulation production release smoke runbook

Use this checklist for a release candidate built from the exact commit being approved. A release
passes only when every required row has captured evidence. Do not infer backend authorization from
the UI being visible or from one successful request.

## 1. Record the test boundary

Record these values without copying credentials into the evidence file:

- PWA build/commit:
- PWA origin:
- simulation origin (`VITE_SIM_URL`):
- OMS origin (for the no-write comparison only):
- signed-in test user and approved role/permission set:
- product store id:
- routing group id:
- UTC start/end time:

Use an approved, non-production order-routing group unless the release owner explicitly authorizes
production testing. Never paste the bearer into a terminal command, screenshot, HAR, or ticket.

## 2. Deployment gates

The build must contain all three simulation gates:

```dotenv
VITE_SIMULATION_ENABLED="true"
VITE_SIM_ALLOW_OMS_BEARER="true"
VITE_SIM_URL="https://trusted-simulation-origin.example"
```

`VITE_SIM_URL` must be a bare HTTPS origin; only loopback development may use HTTP. The optional
`VITE_SIM_PRODUCT_STORE_ID` overrides the signed-in OMS store context. Record which source supplies
the product store and confirm it is the intended tenant/store.

Before browser testing:

1. Confirm the simulation origin is deployment-owned and approved to receive the OMS JWT.
2. Confirm the target validates the intended issuer, signing keys, audience, expiry, and the
   release user's authorization. This repository does not define those backend permissions.
3. Run the read-only preflight. It prompts silently for the bearer when `OMS_BEARER` is unset:

   ```bash
   SIM_URL="<simulation-origin>" \
   PRODUCT_STORE_ID="<store>" \
   ROUTING_GROUP_ID="<group>" \
   PWA_ORIGIN="<pwa-origin>" \
   bash tests/manual-simulator-test.sh
   ```

4. Save its status-only output. The script performs only `GET` and `OPTIONS`; it never accepts an OMS
   origin and never performs a mutation.

## 3. Browser evidence setup

Sign into the PWA normally, open DevTools Network, enable **Preserve log**, clear the log, and record
requests as method + origin + path + status. Keep request bodies only when necessary to prove scope;
redact `Authorization`, cookies, user data, and order data before sharing a HAR.

The browser uses an interceptor-free client for simulation calls. It manually attaches the OMS
bearer only after fixing the request under `<VITE_SIM_URL>/rest/s1/`; absolute, root-relative, and
cross-origin service paths are rejected. A simulation 401/403 must remain a simulation error and
must not trigger the OMS-wide logout flow.

## 4. Functional smoke: create through history

Open `/order-routing/<routingGroupId>`, expand **Variations**, and complete these steps in order.

| Step | Action | Required result and evidence |
|---|---|---|
| Baseline | Confirm the selected product store and note one live route name/status. | The requested group and simulation references load from the simulation origin. Record the scoped group request and the original live value. |
| Create | From Baseline, enter a unique name such as `Release smoke <UTC timestamp>` and choose **Save as new**. | A variation id is returned and becomes selected. Capture the create `POST` and whole-config `PUT`, both on the simulation origin. |
| Edit | Change a route name, rule name, status, one filter/sort/action, and one sequence where the fixture safely permits it. | The rail reports unsaved changes. The live OMS group remains unchanged. |
| Save | Choose **Update** and wait for completion. | One whole-config `PUT` succeeds. The variation becomes clean and Run is enabled. |
| Reload | Reload the browser and reopen the same group and variation. | Route name, **rule name**, status, action/filter, and order persist. Capture the variation `GET`. |
| Switch | Make an unsaved edit, select Baseline/another variation, choose **Cancel**, then repeat and choose **Discard**. | Cancel restores the prior radio and edit. Discard switches without leaking the prior working copy. |
| Reset | Make an unsaved variation edit and choose **Reset**; test Cancel, then Discard. | Cancel preserves the variation edit; Discard returns to Baseline. No live OMS mutation occurs. |
| Run | Reopen the saved variation and choose **Run**. Do not navigate while save/run is active. | Variation simulation completes or shows a specific recoverable error. Record duration and the variation-run `POST`. The parent comparison uses the simulation job endpoints. |
| Results | Open **Results**, inspect Baseline → variation labels and at least one route, then close and reopen the modal. | Counts attach to the correct route even if result order differs. Missing parent data is labeled variation-only; partial/failed payloads show an explicit message rather than a blank panel. |
| History | Open `/simulate`, filter Complete/Failed, open the new saved id, reload the deep link, then use Back. | History is scoped to the selected product store; detail survives reload; empty/error states are explicit. Capture list and detail `GET`s. |

### Expected simulation-origin paths

All paths below are relative to `<VITE_SIM_URL>/rest/s1/`.

| Purpose | Method and path |
|---|---|
| Group list/detail | `GET order-routing/groups?productStoreId=…`, `GET order-routing/groups/<group>/raw` |
| Reference data | `GET order-routing/facilities`, `GET order-routing/productStores/<store>/shippingMethods`, `GET order-routing/productStores/<store>/facilityGroups`, `GET order-routing/omsenums` |
| Variation list/create/read | `GET sim-routing/variations?parentRoutingGroupId=…`, `POST sim-routing/routingGroups/<group>/variations`, `GET sim-routing/variations/<variation>` |
| Whole-tree save | `PUT sim-routing/variations/<variation>/config` |
| Variation run | `POST sim-routing/variations/<variation>/simulation` |
| Parent comparison | `POST sim-routing/routingGroups/<group>/brokeringSimulation/jobs`, then `GET .../jobs/<job>?sinceSeq=…` |
| Saved history | `GET sim-routing/brokeringSimulations?productStoreId=…`, `GET sim-routing/brokeringSimulations/<simulation>` |

Additional simulation-origin reads are acceptable only when they are understood and documented.
Any unexpected mutation path is a release blocker.

## 5. Explicit no-live-OMS-write gate

Keep Network filtered to `POST`, `PUT`, `PATCH`, and `DELETE` throughout Create/Edit/Save/Reset/Run.

Pass only when:

- every variation/config/run mutation targets the configured simulation origin;
- no order-routing mutation targets the live OMS origin;
- the live baseline value recorded before the smoke is unchanged after reload; and
- no Circuit request contains an OMS URL, bearer, cookie, or raw authorization field.

Normal shell/session `GET`s to OMS are not mutations. Any live OMS write is an immediate **NO-GO**;
save the sanitized request path and stop testing.

## 6. Negative security and recovery tests

Run these with deployment-owner-approved accounts/stores. Expected statuses are deliberately limited
to outcomes the release team must verify; this repository does not invent permission names.

| Test | Procedure | Pass condition |
|---|---|---|
| Missing/expired bearer | Use the script's missing-bearer check; separately expire/log out, then retry a simulation read. | Simulation returns 401/403, shows an actionable error, and does not expose data or log the user out of OMS because of a cross-origin simulation response. |
| Insufficient permission | Use an authenticated account the backend owner confirms lacks simulation access. | 403 with no group, variation, result, or history data. |
| CORS | Supply `PWA_ORIGIN` to the script and repeat in the browser. | Preflight allows the exact PWA origin and `Authorization`; an unrelated origin is not allowed. No wildcard credential policy. |
| Tenant/store isolation | Supply an approved `NEGATIVE_PRODUCT_STORE_ID`, then attempt the same store in the UI if possible. | 401/403 or an empty list; never another store's groups/history. |
| Save failure | Interrupt the simulation connection during Update, restore it, reload the variation, and retry. | UI reports failure; it does not claim clean/saved until canonical data is adopted. Record any partially created variation id for cleanup by the backend owner. |
| Variation-run failure | Interrupt or force an approved backend failure. | Run stops with an explicit error and can be retried; navigation unlocks. |
| Parent comparison failure | Allow variation run but fail the parent job in an approved environment. | Variation result remains visible with “parent unavailable”; no false zero baseline is presented. |
| History failure | Block the history request, then restore it and choose Retry. | Error and Retry appear without a misleading empty state; restored data remains product-store scoped. |

## 7. Evidence bundle and release decision

Attach:

- completed table with tester/time/build/store/group/variation/simulation ids;
- status-only preflight output;
- screenshots for persisted edit, switch/reset prompt, results labels, failed/partial state, and history deep-link reload;
- sanitized network export proving simulation-origin paths and no live OMS writes;
- negative-test status/path matrix; and
- every defect or deviation, including recovery outcome.

**GO** requires every functional step, no-live-OMS-write gate, missing bearer, permission, CORS, and
tenant isolation test to pass. A blank result, wrong route pairing, cross-store data, silent save/run
failure, unexpected mutation, exposed credential, or unverified backend authorization is **NO-GO**.

## Current live evidence (not a release sign-off)

On 2026-07-16, live UAT on localhost port 8104 opened group `M100255`. Variation `VM100005`, named
`Codex live check 2026-07-16`, received a 200 whole-config `PUT` on the configured demo Simulation UAT
origin; the save fixes persisted after reload and the live baseline stayed unchanged. The only
definitive origin trace captured was that `PUT` plus the absence of an OMS mutation; post-reload CDP
did not emit enough new events to attribute the later Run requests to an origin.

The live Run completed in about seven seconds. Its modal showed one variation route with 328 eligible,
2 brokered, and 532 queued while the corresponding baseline route was not run, plus additional route
rows. Baseline/variation switching passed. A dirty Reset + Discard restored the untouched live
`Unfillable Standard Orders` route and removed the unsaved probe. History created paired ids `M100375`
and `M100374` at the test timestamp.

The initial history details were indistinguishable, which exposed an identity defect. The corrected
candidate was then retested against the authoritative history response: `M100375` has no
`variationGroupId` and now renders as Baseline, while `M100374` has
`variationGroupId: VM100005` and now renders as Variation `VM100005` in both list and detail views.
The fix keys only on `variationGroupId`, never response ordering or timestamps. Create-request origin
tracing, 401/403, insufficient permission, CORS, and tenant isolation were not proven and remain
required release gates above.
