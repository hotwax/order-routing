import { GroupRunProgress, JobStatusResponse, SimVariant } from "../types/simulation";

/** Base URL for the brokering simulation / Sim-routing API. These endpoints live on a dedicated
 *  instance (UAT: asb-sim-uat.hotwax.io), separate from the OMS/Maarg the rest of the app talks to.
 *  This is the ONE place the host + component prefix are configured, so promoting UAT -> prod is a
 *  config change, not a code change. The value INCLUDES the `/rest/s1/order-routing` prefix; per-call
 *  paths are relative to it. Auth is unchanged — api() attaches the same credentials as other
 *  order-routing admin calls. Env is injectable for headless testing (import.meta.env is the default). */
export function simApiBaseUrl(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_API_BASE_URL) || "https://asb-sim-uat.hotwax.io/rest/s1/order-routing").trim();
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
  const { api, commonUtil } = await import("@common");
  const resp: any = await api({
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
  const { api, commonUtil } = await import("@common");
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  let sinceSeq = 0;
  while (Date.now() < deadline) {
    const resp: any = await api({
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
  const { api, commonUtil } = await import("@common");
  const { url, params } = pastSimulationsQuery(f);
  const resp: any = await api({ url, method: "GET", baseURL: simApiBaseUrl(), params });
  if (commonUtil.hasError(resp)) throw new Error(`Failed to load past simulations: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  // Confirmed contract: { simulationList: [...headers], totalCount }.
  const headers = resp.data?.simulationList ?? (Array.isArray(resp.data) ? resp.data : []);
  const total = Number(resp.data?.totalCount ?? headers.length);
  return { headers, total };
}

/** Fetch one persisted simulation with its variants (R2). Returns the raw response for the adapter. */
export async function fetchPastSimulation(simulationId: string): Promise<any> {
  if (useMock()) { const { mockPastSimulation } = await import("../mock/pastSimulationsMock"); return mockPastSimulation(simulationId); }
  const { api, commonUtil } = await import("@common");
  const resp: any = await api({ url: `brokeringSimulations/${simulationId}`, method: "GET", baseURL: simApiBaseUrl() });
  if (commonUtil.hasError(resp)) throw new Error(`Failed to load simulation ${simulationId}: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  return resp.data;
}
