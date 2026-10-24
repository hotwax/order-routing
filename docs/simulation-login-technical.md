# Simulation and Circuit backend trust contract

This document describes the trust boundary that the PWA can prove from this checkout. Use the
executable [simulation production release smoke runbook](./simulation-production-readiness.md) for
deployment approval and evidence capture.

## Default posture

Simulation and the Circuit draft assistant are disabled by default. `.env.example` contains no
development, UAT, product-store, or service-host defaults.

The PWA will expose simulation only when all of these build-time settings are present:

```dotenv
VITE_SIMULATION_ENABLED="true"
VITE_SIM_ALLOW_OMS_BEARER="true"
VITE_SIM_URL="https://verified-simulation-origin.example"
```

`VITE_SIM_URL` must be a bare HTTPS origin. HTTP is accepted only for a loopback development
origin. Credentials, paths, query strings, and fragments are rejected. The simulation URL helpers
throw before a network call when any requirement is missing.

The assistant requires both settings below:

```dotenv
VITE_DRAFT_ASSISTANT_ENABLED="true"
VITE_MASTRA_URL="https://verified-circuit-origin.example"
```

The same URL validation applies. Unknown feature flags fail closed.

## Simulation authentication: what is proven

`SimApiService` uses an interceptor-free HTTP client so a simulation 401/403 cannot invoke the
global OMS logout interceptor. It resolves every request under the fixed
`<VITE_SIM_URL>/rest/s1/` root, rejects absolute/root-relative/cross-origin paths, reads the active
OMS token, and attaches `Authorization: Bearer <OMS JWT>` itself. A missing token fails before the
network call.

That proves the current browser protocol and host confinement. It does **not** prove that an
arbitrary configured host is deployment-owned, validates the expected JWT issuer/signing
configuration, or grants the correct artifacts to the current user. Those facts live outside this
PWA repository. Consequently, `VITE_SIM_ALLOW_OMS_BEARER=true` is an explicit deployment
attestation, not a convenient default.

Before setting it, verify all of the following against the target environment:

1. The exact `VITE_SIM_URL` origin is controlled by the deployment team.
2. Its Moqui instance validates the OMS JWT using the intended issuer, keys, audience, and expiry.
3. CORS permits the PWA origin and the `Authorization` header without using a wildcard credential
   policy.
4. The signed-in user's permissions cover the required `order-routing` and `sim-routing` artifacts.
5. The endpoints used by `SimulationService.ts`, `VariationService.ts`, and `simReferenceStore.ts`
   return their current response shapes.

Until those checks are complete, leave all three simulation settings at their defaults. The tab and
direct routes stay unavailable and service calls fail before sending a bearer token anywhere.

## Circuit diagnostic authentication

The editor/draft assistant remains credential-free. The runs-list inquiry endpoint delegates
read-only OMS requests using the signed-in user's bearer in the `Authorization` header. It sends
only the active **Maarg origin** as `omsInstance`; neither the token nor a caller-selected REST
URL appears in the JSON body. A missing token or invalid HTTPS Maarg connection leaves the
request credential-free so configuration-only questions can still be answered. Before delegating,
the existing shared authentication guard checks that the tab still matches the signed-in user and
OMS session. A mismatch stops the request and asks the user to refresh; it does not log them out.

This requires the companion Circuit change in hotwax/circuit#39. Release that backend before
this client: its request schema must accept `omsInstance`, and its server-only
`MASTRA_OMS_ALLOWED_ORIGINS` setting must contain the exact permitted HTTPS Maarg origins,
comma-separated. For example, the paired demo-oms login uses `https://demo-maarg.hotwax.io` for
Moqui REST; replacing `/api` on the OFBiz host would select the wrong server. Do not put tokens
in any `VITE_*` setting.

Circuit checks the origin against that allowlist, performs fixed GETs under the user's existing
OMS permissions, and reports missing/invalid evidence without diagnosing from guesses. It must
not follow redirects or pass credentials into model prompts, tool arguments or diagnostic dumps.
This does not add stronger per-store authorization than the OMS already enforces. The configured
`VITE_MASTRA_URL` is therefore a trusted recipient of the user's diagnostic authorization header;
keep it explicitly enabled and validated by `requireDraftAssistantUrl`.

No deployment setting is changed by this code. Live verification on 2026-10-24 found execution
history available on demo-maarg; the four aggregate diagnostic endpoints returned 404. A release
must preserve that distinction instead of treating the missing endpoints as empty results.

## No production mock fallback

Past-simulation reads always call the configured backend. The former `VITE_SIM_USE_MOCK` runtime
fallback was removed so a failed or incomplete backend cannot look healthy by returning fixtures.

## Relevant source files

- `src/utils/simConfig.ts`: opt-in flags, URL validation, and fail-closed URL resolvers.
- `src/services/SimApiService.ts`: isolated bearer attachment and simulation-origin confinement.
- `src/services/SimulationService.ts`: simulation jobs, scoped group reads, and persisted-run reads.
- `src/services/VariationService.ts`: variation CRUD and execution requests.
- `src/services/DraftAssistantService.ts`: credential-free editor requests and header-only delegated
  authentication for runs-list diagnostics.
- `tests/manual-simulator-test.sh`: credential-safe, read-only API/security preflight.
