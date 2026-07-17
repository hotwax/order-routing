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

## Circuit assistant authentication: what is proven

The PWA can prove only the HTTP request/response shapes for the configured Mastra endpoints. The
Mastra implementation, its deployment identity, and a server-to-server OMS authorization contract
are not present in this checkout.

Older client code copied both the active OMS base URL and raw bearer token into each Mastra request
body. That delegated the user's full OMS credential to a cross-origin service with no contract this
repository could verify. The production client no longer sends either field.

Requests now contain only the prompt, normalized conversation history, and capability manifest.
If the assistant must query OMS data, the Circuit backend must gain a reviewed server-side
integration (for example, a service identity or a narrowly scoped token exchange) and enforce the
same tenant/product-store/permission scope as the signed-in user. Do not restore browser bearer
forwarding to make a missing backend contract appear functional.

## No production mock fallback

Past-simulation reads always call the configured backend. The former `VITE_SIM_USE_MOCK` runtime
fallback was removed so a failed or incomplete backend cannot look healthy by returning fixtures.

## Relevant source files

- `src/utils/simConfig.ts`: opt-in flags, URL validation, and fail-closed URL resolvers.
- `src/services/SimApiService.ts`: isolated bearer attachment and simulation-origin confinement.
- `src/services/SimulationService.ts`: simulation jobs, scoped group reads, and persisted-run reads.
- `src/services/VariationService.ts`: variation CRUD and execution requests.
- `src/services/DraftAssistantService.ts`: assistant request shapes; deliberately no OMS credential
  forwarding.
- `tests/manual-simulator-test.sh`: credential-safe, read-only API/security preflight.
