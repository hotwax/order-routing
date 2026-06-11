import { GroupRunProgress, JobStatusResponse, SimVariant } from "../types/simulation";

/** Name of the Moqui component that serves the simulation REST endpoints (and the sim login).
 *  Defaults to "order-routing"; set VITE_SIM_API_NAME="ai-routing" if the backend moves (the REST
 *  contract is stable; only the mount point is in flux). Env is injectable for headless testing. */
export function simApiName(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_API_NAME) || "order-routing").trim();
}

/** Product store id to scope the simulation's routing-group + reference-data queries to. The sim
 *  instance's real stores (e.g. SM_STORE) differ from the OMS demo placeholder ("STORE") that
 *  currentEComStore resolves to, so set VITE_SIM_PRODUCT_STORE_ID to a real one. Blank => caller falls
 *  back to the OMS currentEComStore. Env is injectable for headless testing.
 *  TODO: replace with a store selector populated from the sim instance's product stores. */
export function simProductStoreId(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_PRODUCT_STORE_ID) || "").trim();
}

/** REST root of the dedicated simulation Moqui (:8075), or "" when unset. Empty is the single-instance
 *  toggle: the simulation talks to the same Moqui as everything else and the shared OMS Bearer auth
 *  applies (UAT/prod). When set (local two-instance dev), the sim Moqui has its OWN api_key auth and
 *  sim calls must go through SimAuthService instead. Env is injectable for headless testing. */
export function simBaseURL(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_URL) || "").trim();
}

/** Base URL for the brokering simulation / Sim-routing API. These endpoints live on a dedicated
 *  instance (UAT: asb-sim-uat.hotwax.io), separate from the OMS/Maarg the rest of the app talks to.
 *  This is the ONE place the host + component prefix are configured, so promoting UAT -> prod is a
 *  config change, not a code change. The value INCLUDES the `/rest/s1/order-routing` prefix; per-call
 *  paths are relative to it. Auth is unchanged — api() attaches the same credentials as other
 *  order-routing admin calls. Env is injectable for headless testing (import.meta.env is the default). */
export function simApiBaseUrl(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_API_BASE_URL) || "https://asb-sim-uat.hotwax.io/rest/s1/order-routing").trim();
}

/** Base URL for the sim-routing (variation / what-if) API. Same host as simApiBaseUrl()'s sim
 *  instance, different component prefix (`sim-routing`). One place to configure host + prefix so
 *  UAT -> prod is config, not code. Auth is unchanged — simApi() attaches api_key (two-instance) or
 *  the OMS Bearer (single-instance). Env is injectable for headless testing. */
export function simRoutingApiBaseUrl(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_ROUTING_API_BASE_URL) || "https://asb-sim-uat.hotwax.io/rest/s1/sim-routing").trim();
}

/** Bare REST root the simulation page pulls its routing groups and OMS reference data (omsenums,
 *  facilities, facility groups, shipping methods) from. Two-instance mode: the sim Moqui root
 *  (VITE_SIM_URL, e.g. http://localhost:8075/rest/s1/). Single-instance mode (VITE_SIM_URL blank):
 *  returns "" so callers fall through to api()'s default OMS baseURL (getMaargURL) — same Moqui, same
 *  Bearer auth as the rest of the app. Keying off simBaseURL() keeps the host and the auth scheme in
 *  lockstep with simApi()'s mode switch: blank can never mean "OMS auth" but "sim host" at the same
 *  time. Env is injectable for headless testing (import.meta.env is the default). */
export function simMoquiUrl(env: Record<string, any> = import.meta.env): string {
  return simBaseURL(env);
}

/** Pure: do two URLs share an origin (scheme + host + port)? Relative/empty bases never mismatch. */
export function sameOrigin(a: string, b: string): boolean {
  try {
    return !a || !b || new URL(a).origin === new URL(b).origin;
  } catch {
    return true; // unparseable -> can't judge, don't warn
  }
}

let warnedCrossHost = false;

/** Issue a request to the simulation backend with the correct auth for the deployment. Two modes:
 *  - Two-instance (VITE_SIM_URL set): the sim Moqui has its OWN api_key auth, so go through the
 *    interceptor-free client() with an `api_key` header (from SimAuthService) and re-login once on a
 *    401/403. The shared OMS Bearer-token interceptor is deliberately bypassed — that token is not
 *    accepted on the sim instance. The caller's `baseURL` is preserved: jobs use simApiBaseUrl()
 *    (its component prefix, e.g. sim-routing, can differ from the data component) but it MUST be the
 *    same host as VITE_SIM_URL — the api_key is only valid there.
 *  - Single-instance (VITE_SIM_URL blank): same Moqui as everything else — use api() so the shared
 *    OMS Bearer-token interceptor authenticates, preserving the original UAT/prod behaviour. */
export async function simApi(config: any): Promise<any> {
  const { api, client, logger } = await import("@common");
  if (!simBaseURL()) return api(config);

  // Guard against the classic split-brain misconfig: VITE_SIM_URL switched to a new host but
  // VITE_SIM_API_BASE_URL left pointing elsewhere — that host will reject this instance's api_key.
  if (!warnedCrossHost && config?.baseURL && !sameOrigin(config.baseURL, simBaseURL())) {
    warnedCrossHost = true;
    logger.warn(`Sim request baseURL ${config.baseURL} is on a different host than VITE_SIM_URL (${simBaseURL()}); its api_key login will not be honored there. Align VITE_SIM_API_BASE_URL with VITE_SIM_URL.`);
  }

  const { getSimApiKey, clearSimSession } = await import("./SimAuthService");
  const callWith = (key: string) =>
    client({ ...config, headers: { ...(config.headers || {}), api_key: key } });

  const key = await getSimApiKey();
  try {
    return await callWith(key);
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 401 || status === 403) {
      // Stale/expired sim session — drop it, log in again, and retry once.
      clearSimSession();
      return callWith(await getSimApiKey());
    }
    throw e;
  }
}

export interface JobOutcome {
  done: boolean;
  result?: { groupRun?: any; variation?: any };
  error?: string;
}

/** Pure: turn a poll response into a terminal/continue decision. */
export function interpretJobStatus(resp: JobStatusResponse): JobOutcome {
  switch (resp.status) {
    case "running":
      return { done: false };
    case "complete": {
      const result: { groupRun?: any; variation?: any } = {};
      if (resp.groupRun !== undefined) result.groupRun = resp.groupRun;
      if (resp.variation !== undefined) result.variation = resp.variation;
      return { done: true, result };
    }
    case "failed":
      return { done: true, error: resp.error || "Simulation failed." };
    case "not_found":
      return { done: true, error: "Simulation job expired before it completed. Please re-run." };
    default:
      return { done: true, error: `Unknown job status: ${(resp as any).status}` };
  }
}

// Live progress feed streams per-order events as deltas, so a tight 2.5s cadence stays cheap.
const POLL_INTERVAL_MS = 2_500;
const MAX_POLL_DURATION_MS = 90 * 60_000;

export interface SubmitBatchArgs {
  routingGroupId: string;
  variants: SimVariant[];
  sampleCap?: number;
}

/** POST one batch (≤5 variants). Returns the jobId. Throws on non-2xx. */
export async function submitBatch({ routingGroupId, variants, sampleCap }: SubmitBatchArgs): Promise<string> {
  const { commonUtil } = await import("@common");
  const resp: any = await simApi({
    url: `routingGroups/${routingGroupId}/brokeringSimulation/jobs`,
    method: "POST",
    baseURL: simApiBaseUrl(),
    data: { variants, ...(sampleCap != null ? { sampleCap } : {}) },
  });
  if (commonUtil.hasError(resp) || !resp.data?.jobId) {
    throw new Error(`Failed to submit simulation batch: ${JSON.stringify(resp?.data ?? resp)?.slice(0, 300)}`);
  }
  return resp.data.jobId;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll a job to completion with a sinceSeq cursor for the live progress feed.
 *  Resolves with { groupRun?, variation? } on success; throws on failure/timeout.
 *  `onPhase` gets the raw status each poll; `onProgress` gets the `progress` object each poll
 *  that carries one (running ticks and the terminal flush). */
export async function pollJob(
  routingGroupId: string,
  jobId: string,
  onPhase?: (status: string) => void,
  onProgress?: (progress: GroupRunProgress) => void,
): Promise<{ groupRun?: any; variation?: any }> {
  const { commonUtil } = await import("@common");
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  let sinceSeq = 0;
  while (Date.now() < deadline) {
    const resp: any = await simApi({
      url: `routingGroups/${routingGroupId}/brokeringSimulation/jobs/${jobId}`,
      method: "GET",
      baseURL: simApiBaseUrl(),
      params: { sinceSeq },
    });
    if (commonUtil.hasError(resp)) throw new Error(`Polling failed: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
    const status = resp.data as JobStatusResponse;
    onPhase?.(status.status);
    if (status.progress) {
      onProgress?.(status.progress);
      if (typeof status.progress.nextSeq === "number") sinceSeq = status.progress.nextSeq;
    }
    const outcome = interpretJobStatus(status); // same module — call directly
    if (outcome.done) {
      if (outcome.error) throw new Error(outcome.error);
      return outcome.result ?? {};
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Simulation timed out. Please re-run this batch.");
}

/** Run the parent group's live config (no variants) via the existing job endpoint, returning its
 *  GroupRunResult. Reuses submitBatch (empty variants -> baseline groupRun) + pollJob for live
 *  progress. `onProgress` receives each progress tick for the parent-side progress bar. */
export async function runParentLiveConfig(
  parentRoutingGroupId: string,
  sampleCap: number | undefined,
  onProgress?: (progress: GroupRunProgress) => void,
): Promise<any> {
  const jobId = await submitBatch({ routingGroupId: parentRoutingGroupId, variants: [], sampleCap });
  const result = await pollJob(parentRoutingGroupId, jobId, undefined, onProgress);

  return (result as any).groupRun ?? (result as any).variation ?? result;
}

// ---- Past simulations (read-only: backend request R1/R2) -------------------------------------

export interface PastSimulationsFilters {
  productStoreId: string;
  routingGroupId?: string;
  statusId?: string;        // RUNNING | COMPLETE | FAILED
  runType?: string;         // SINGLE | VARIATION
  fromDate?: string;
  thruDate?: string;
  pageIndex: number;
  pageSize: number;
}

/** Pure: build the GET url + params for the list endpoint (R1). Newest-first. */
export function pastSimulationsQuery(f: PastSimulationsFilters): { url: string; params: Record<string, any> } {
  const params: Record<string, any> = { productStoreId: f.productStoreId };
  if (f.routingGroupId) params.routingGroupId = f.routingGroupId;
  if (f.statusId) params.statusId = f.statusId;
  if (f.runType) params.runType = f.runType;
  if (f.fromDate) params.fromDate = f.fromDate;
  if (f.thruDate) params.thruDate = f.thruDate;
  params.orderByField = "-createdDate";
  params.pageIndex = f.pageIndex;
  params.pageSize = f.pageSize;
  return { url: "brokeringSimulations", params };
}

/** Pure: true when the query carries any filter beyond productStoreId+paging (so the cache is bypassed). */
export function isFilteredQuery(f: PastSimulationsFilters): boolean {
  return Boolean(f.routingGroupId || f.statusId || f.runType || f.fromDate || f.thruDate);
}

// Flip to true (or wire VITE_SIM_USE_MOCK) until backend R1/R2 are live in your environment.
function useMock(env: Record<string, any> = import.meta.env): boolean {
  return (env && String(env.VITE_SIM_USE_MOCK)) === "true";
}

/** List persisted simulations (R1). Returns { headers, total }. */
export async function fetchPastSimulations(f: PastSimulationsFilters): Promise<{ headers: any[]; total: number }> {
  if (useMock()) { const { mockPastSimulations } = await import("../mock/pastSimulationsMock"); return mockPastSimulations(f); }
  const { commonUtil } = await import("@common");
  const { url, params } = pastSimulationsQuery(f);
  const resp: any = await simApi({ url, method: "GET", baseURL: simApiBaseUrl(), params });
  if (commonUtil.hasError(resp)) throw new Error(`Failed to load past simulations: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  // Confirmed contract: { simulationList: [...headers], totalCount }.
  const headers = resp.data?.simulationList ?? (Array.isArray(resp.data) ? resp.data : []);
  const total = Number(resp.data?.totalCount ?? headers.length);
  return { headers, total };
}

/** Fetch one persisted simulation with its variants (R2). Returns the raw response for the adapter. */
export async function fetchPastSimulation(simulationId: string): Promise<any> {
  if (useMock()) { const { mockPastSimulation } = await import("../mock/pastSimulationsMock"); return mockPastSimulation(simulationId); }
  const { commonUtil } = await import("@common");
  const resp: any = await simApi({ url: `brokeringSimulations/${simulationId}`, method: "GET", baseURL: simApiBaseUrl() });
  if (commonUtil.hasError(resp)) throw new Error(`Failed to load simulation ${simulationId}: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  return resp.data;
}
