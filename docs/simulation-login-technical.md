# Simulation Moqui Authentication — Technical Reference

How the order-routing PWA authenticates to the **simulation Moqui** backend, and
why it is different from how the app authenticates to the OMS Moqui.

> Audience: engineers working on the simulation/brokering features.
> Companion doc: [`simulation-login-eli5.md`](./simulation-login-eli5.md).

---

## 1. The core problem: two Moqui instances, two auth schemes

The PWA talks to **two separate Moqui backends**:

| Instance | Example host/port | Auth scheme | How the app gets credentials |
| --- | --- | --- | --- |
| **OMS Moqui** | `:8085` | `Authorization: Bearer <token>` | Bearer token from the shared DXP launchpad login (cross-app). |
| **Simulation Moqui** | `:8075` | `api_key: <key>` header | Username/password from `.env`, exchanged for an `api_key` at a `/login` endpoint. |

The crux: **the simulation Moqui does not accept the OMS Bearer token.** It is a
distinct instance with its own user store and its own auth. The launchpad login
flow never hands the raw password to this app, so the simulation credentials must
be supplied independently via environment variables.

This is the "two-Moqui `api_key`" arrangement.

---

## 2. The deployment switch: `VITE_SIM_URL`

Everything hinges on one env var, `VITE_SIM_URL` (read by `simBaseURL()` in
`src/services/SimulationService.ts:23`):

- **Blank (single-instance — UAT/prod default).** The simulation runs inside the
  *same* Moqui as the rest of the app. There is no second instance to log into,
  so simulation calls ride the normal OMS Bearer auth. The entire
  `SimAuthService` module is never touched.

- **Set (two-instance — local dev, e.g. `http://localhost:8075/rest/s1/`).** The
  simulation Moqui is a separate `api_key`-auth instance. Simulation calls must
  go through the dedicated login + `api_key` path.

This switch lives in a single function so the two modes never diverge elsewhere.

---

## 3. The request dispatcher: `simApi()`

`src/services/SimulationService.ts:55` — every simulation backend call goes
through `simApi()`, which picks the auth path based on the switch:

```ts
export async function simApi(config: any): Promise<any> {
  const { api, client } = await import("@common");
  if (!simBaseURL()) return api(config);            // single-instance → OMS Bearer

  const { getSimApiKey, clearSimSession } = await import("./SimAuthService");
  const callWith = (key: string) =>
    client({ ...config, headers: { ...(config.headers || {}), api_key: key } });

  const key = await getSimApiKey();
  try {
    return await callWith(key);
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401 || status === 403) {         // stale key → re-login, retry once
      clearSimSession();
      return callWith(await getSimApiKey());
    }
    throw e;
  }
}
```

Two behaviours to note:

1. **Single-instance** → delegates to `@common`'s `api()` and returns. The OMS
   Bearer interceptor authenticates the call exactly like any other.
2. **Two-instance** → attaches an `api_key` header (lower-case, *not*
   `Authorization`) and issues the call via `@common`'s `client()`. On a `401`/
   `403` it drops the cached session, re-logs-in, and retries **once**.

### Why `client()` instead of `api()`?

`@common` exposes two request functions (`common/core/remoteApi.ts`):

- **`api()`** — calls a shared module-level axios instance that has a request
  interceptor. The interceptor force-attaches `Authorization: Bearer <OMS
  token>` and gates the request on the app being OMS-authenticated.
- **`client()`** — `axios.create().request(...)`, a **fresh instance with no
  interceptors**.

The simulation path deliberately uses `client()` for both the login and the
authenticated calls, so the OMS Bearer token and OMS auth-gating **never touch
the separate-auth `:8075` instance**. Using `api()` there would inject the wrong
token and could trip the interceptor's force-logout.

---

## 4. The login flow: `SimAuthService.ts`

`src/services/SimAuthService.ts` owns the simulation session. It is a small
module with module-level state — no Vuex, no Pinia, no persistence.

### 4.1 Credentials (`simCreds`, line 8)

```ts
export function simCreds(env = import.meta.env) {
  return {
    username: ((env && env.VITE_SIM_USERNAME) || "").trim(),
    password: (env && env.VITE_SIM_PASSWORD) || "",
  };
}
```

Credentials come straight from `.env`. (`env` is injectable so tests can pass a
fake.)

### 4.2 Login endpoint (`simLoginUrl`, line 17)

```ts
export function simLoginUrl(): string {
  return `${simApiName()}/login`;   // e.g. "order-routing/login"
}
```

`simApiName()` (`SimulationService.ts:6`) returns `VITE_SIM_API_NAME` or the
default `"order-routing"`. The login path is component-relative; the API client
joins it to `simBaseURL()`. `admin/login` is a newer alias for the same endpoint.

> Forward-looking: if the simulation backend moves from the `order-routing`
> component to `ai-routing`, only `VITE_SIM_API_NAME` changes — the REST contract
> is stable.

### 4.3 The login call (`simLogin`, line 43)

```ts
export async function simLogin(): Promise<string> {
  const { client, commonUtil } = await import("@common");
  const base = simBaseURL();
  const { username, password } = simCreds();
  if (!base) throw new Error("VITE_SIM_URL is not set …");
  if (!username || !password) throw new Error("VITE_SIM_USERNAME / VITE_SIM_PASSWORD are not set …");

  const resp: any = await client({
    url: simLoginUrl(),
    method: "POST",
    baseURL: base,                                  // = VITE_SIM_URL
    headers: { "Content-Type": "application/json" },
    data: { username, password },
  });
  if (commonUtil.hasError(resp) || !resp.data?.api_key) {
    throw new Error(`Simulation login failed: …`);
  }
  // expirationTime is only trusted when it parses as a plausible FUTURE epoch-ms value;
  // anything else (TTL, seconds, garbage) is treated as "no known expiry" and real expiry
  // is recovered by simApi()'s 401 -> clearSimSession -> retry path.
  const exp = Number(resp.data.expirationTime);
  session = {
    apiKey: resp.data.api_key,
    expirationTime: Number.isFinite(exp) && exp > Date.now() ? exp : undefined,
  };
  return session.apiKey;
}
```

- **Method/body:** `POST` JSON `{ username, password }`.
- **Transport:** the interceptor-free `client()` (see §3).
- **Response contract:** `resp.data.api_key` (required) and an optional
  `resp.data.expirationTime` (epoch ms).
- **Errors:** throws if `VITE_SIM_URL` or the credentials are unset, or if the
  response has an error / lacks an `api_key`.

### 4.4 Session caching & expiry

The session is held in a **module-level variable** (line 27):

```ts
let session: SimSession | null = null;     // { apiKey, expirationTime? }
let inFlight: Promise<string> | null = null;
const EXPIRY_SKEW_MS = 60_000;             // refresh 60s early
```

- **`getSimApiKey()` (line 69)** — the public accessor. Returns the cached key if
  the session is valid; otherwise triggers `simLogin()`. Concurrent callers are
  de-duped via the `inFlight` promise, so a burst of calls yields exactly **one**
  login round-trip.

  ```ts
  export async function getSimApiKey(): Promise<string> {
    if (session && !isSessionExpired(session, Date.now())) return session.apiKey;
    if (!inFlight) inFlight = simLogin().finally(() => { inFlight = null; });
    return inFlight;
  }
  ```

- **`isSessionExpired(s, now)` (line 34)** — pure, testable. A session with **no**
  `expirationTime` is treated as never-expiring; otherwise it's considered
  expired `EXPIRY_SKEW_MS` (60 s) *before* the real expiry, to avoid racing the
  wire.

- **`clearSimSession()` (line 78)** — nulls the session. Called by `simApi()`
  after a `401`/`403`.

> **Lifetime caveat:** the session lives only in module memory. A page reload
> clears it and the next call re-logs-in. Nothing is written to `localStorage`,
> cookies, or any store.

---

## 5. End-to-end request sequence (two-instance mode)

```
caller (e.g. submitBatch)
  └─ simApi(config)
       ├─ simBaseURL() set?  ── yes ──┐
       │                              │
       ├─ getSimApiKey()              │
       │    ├─ valid cached session?  ── yes → return apiKey
       │    └─ no → simLogin()  (deduped via inFlight)
       │              └─ POST {VITE_SIM_URL}/order-routing/login {username,password}
       │                   → { api_key, expirationTime }  → cache in `session`
       │
       └─ client({ ...config, headers: { api_key } })   ← interceptor-free
            ├─ 2xx → return response
            └─ 401/403 → clearSimSession(); getSimApiKey(); retry once
```

---

## 6. The two base URLs (one key serves both)

Both resolve to the same simulation instance and use the same `api_key`:

| Helper | Env var / default | Used for |
| --- | --- | --- |
| `simApiBaseUrl()` (`SimulationService.ts:33`) | `VITE_SIM_API_BASE_URL`, default `https://asb-sim-uat.hotwax.io/rest/s1/order-routing` | Jobs (`routingGroups/{id}/brokeringSimulation/jobs`), poll, past-sims (`brokeringSimulations`). |
| `simMoquiUrl()` (`SimulationService.ts`) | `VITE_SIM_URL`; blank → `""` (callers fall back to the OMS default baseURL — single-instance) | OMS reference data on the sim instance (sales channels, facilities, shipping methods) and the routing-group picker. |

`RoutingGroupService.ts` is request-fn-agnostic: the OMS store passes `api()`
(Bearer, `:8085`); the simulate path passes `simApi()` (api_key, `:8075`). The two
instances never share a request path.

---

## 7. Environment variables

| Var | Purpose | Local-dev value | `.env.example` default |
| --- | --- | --- | --- |
| `VITE_SIM_URL` | Bare sim Moqui REST root; **also the mode switch** | `http://localhost:8075/rest/s1/` | `""` (single-instance) |
| `VITE_SIM_API_BASE_URL` | Sim component base for jobs/past-sims (must be the same HOST as `VITE_SIM_URL` when that is set) | `http://localhost:8075/rest/s1/sim-routing` | `https://asb-sim-uat.hotwax.io/rest/s1/order-routing` |
| `VITE_SIM_API_NAME` | Component the sim login + data paths mount under (`order-routing` \| `ai-routing`) | (unset → `order-routing`) | `order-routing` |
| `VITE_SIM_USERNAME` | Sim login username | `<sim username>` (in `.env`, gitignored) | `""` |
| `VITE_SIM_PASSWORD` | Sim login password | `<sim password>` (in `.env`, gitignored) | `""` |
| `VITE_SIM_PRODUCT_STORE_ID` | Store scope for sim queries | `SM_STORE` | `""` |
| `VITE_SIMULATION_ENABLED` | Show/hide Simulate tab + guard routes | (unset) | `"true"` |
| `VITE_SIM_USE_MOCK` | Use fixtures instead of live past-sims API | (unset) | (unset) |

> **Security note:** `.env` is gitignored, so the credentials stay out of the
> repo — but any `VITE_*` value present at build time is compiled into the
> shipped JS bundle and readable by anyone with the app URL. `simLogin()` logs a
> warning in production builds. This scheme is for local/demo use only; a real
> deployment needs server-side auth.

---

## 8. Key source files

| File | Responsibility |
| --- | --- |
| `src/services/SimAuthService.ts` | Login, api_key cache, expiry skew, dedup, header name. |
| `src/services/SimulationService.ts` | `simApi()` dispatcher, base-URL helpers, job submit/poll, past-sims. |
| `common/core/remoteApi.ts` | `api()` (interceptor + Bearer) vs `client()` (no interceptor). |
| `common/utils/commonUtil.ts` | `getToken()` (OMS token), `hasError()`. |
| `src/services/RoutingGroupService.ts` | Request-fn-agnostic group fetches (OMS or sim). |
| `src/store/simulationStore.ts` | Wires `simApi`/`simMoquiUrl` into the routing-group picker. |

---

## 9. TL;DR

The OMS Moqui authenticates with a **Bearer token** from the shared launchpad
login. The simulation Moqui is a **separate instance with its own `api_key`
auth** that rejects that token. To bridge them, the PWA logs into the sim
instance with env-supplied username/password at `{component}/login`, caches the
returned `api_key` in module memory (refreshing 60 s early, deduping concurrent
logins, retrying once on 401/403), and sends it as an `api_key` header on every
sim call through the **interceptor-free** `client()`. When `VITE_SIM_URL` is
blank (single-instance UAT/prod), this whole second-auth path is skipped and the
simulation rides the normal OMS Bearer auth via `api()`.
</content>
