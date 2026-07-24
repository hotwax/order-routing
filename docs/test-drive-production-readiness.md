# Test Drive production gate

Test Drive performs live OMS allocation and reset mutations. The PWA therefore keeps the feature
off unless a deployment explicitly sets both:

```dotenv
VITE_TEST_DRIVE_ENABLED="true"
VITE_TEST_DRIVE_BACKEND_AUTH_VERIFIED="true"
```

The second setting is a deployment attestation, not a substitute for the checks below.

## Current upstream evidence

This review inspected `hotwax/OrderRouting` main at
`aec610cde5f2e48fdf6607acc0c3a413d3b10b24` (verified against the remote on 2026-07-16).
It proves the upstream source state, but not which commit or configuration a live OMS has deployed.

- `OrderRoutingServices.xml` declares `run#OrderRoutingGroup` as `authenticate="anonymous-all"`.
- Its Test Drive session branch checks only that a `UserSession` exists for the same product store,
  and only when store brokering is disabled. It does not verify current user, session type,
  permission, start/end time, or expiry.
- `EligibleOrdersQuery.sql.ftl` still requires `ENABLE_BROKERING` to be null/`Y`, contradicting the
  intended Test Drive override for a disabled store.
- `orderId` and `shipGroupSeqId` are interpolated into SQL text instead of bound parameters.
- `/orders/:orderId/reject` calls the generic `reject#OrderItems` service. That service has no Test
  Drive session or permission input, no atomic all-items reset guarantee, and no Test Drive mutation
  receipt that the PWA can safely reconcile for split or multi-item allocations.

## Required verification before enablement

Do not enable Test Drive until all of the following are proven against the exact deployed backend:

1. Run and reset endpoints require authenticated users and enforce `ROUTING_TEST_DRIVE_VIEW`
   server-side.
2. The session belongs to the current user and product store, has
   `sessionTypeEnumId=ROUTING_TEST_DRIVE`, and is within its `fromDate`/`thruDate` window.
3. Every `orderId`, `shipGroupSeqId`, and filter value is validated and parameter-bound; no user
   input is interpolated into executable SQL.
4. Test Drive works intentionally when normal brokering is disabled, including the downstream
   eligible-orders query.
5. Run returns a durable mutation receipt describing every allocated item, quantity, facility, and
   resulting ship group. The client must not reconstruct multi-location allocation from one history
   row.
6. Reset accepts that scoped receipt/session, is atomic (or returns exact per-item completion), and
   leaves the client blocked from exit until every Test Drive allocation is conclusively reset.
7. CORS, tenant/product-store scope, audit logging, expiry, retry/idempotency, and concurrent-run
   behavior are exercised on the deployed environment.
8. The enabled PWA passes authenticated browser QA for run, Back-during-run, failed history
   reconciliation, full/partial reset, multi-item and split allocation, expiry, reload, and
   cross-store deep links.

Until then, the editor hides the entry point and the direct route redirects to the routing group.
