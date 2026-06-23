import { api, commonUtil } from "@common";
import { simApiBaseUrl } from "../utils/simConfig";
import { interpretJobStatus, pastSimulationsQuery, isFilteredQuery } from "../utils/simulationCompute";
import type { SubmitBatchArgs, PastSimulationsFilters } from "../types/simulation";
import { GroupRunProgress, JobStatusResponse } from "../types/simulation";




// Live progress feed streams per-order events as deltas, so a tight 2.5s cadence stays cheap.
const POLL_INTERVAL_MS = import.meta.env.VITE_SIM_POLL_INTERVAL_MS
  ? Number(import.meta.env.VITE_SIM_POLL_INTERVAL_MS)
  : 2_500;
const MAX_POLL_DURATION_MS = import.meta.env.VITE_SIM_MAX_POLL_DURATION_MS
  ? Number(import.meta.env.VITE_SIM_MAX_POLL_DURATION_MS)
  : 90 * 60_000;

/** POST one batch (≤5 variants). Returns the jobId. Throws on non-2xx. */
export async function submitBatch({ routingGroupId, variants, sampleCap }: SubmitBatchArgs): Promise<string> {
  const resp: any = await api({
    url: `sim-routing/routingGroups/${routingGroupId}/brokeringSimulation/jobs`,
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
export async function pollJob(routingGroupId: string, jobId: string, onPhase?: (status: string) => void, onProgress?: (progress: GroupRunProgress) => void): Promise<{ groupRun?: any; variation?: any }> {
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  let sinceSeq = 0;
  while (Date.now() < deadline) {
    const resp: any = await api({
      url: `sim-routing/routingGroups/${routingGroupId}/brokeringSimulation/jobs/${jobId}`,
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
export async function runParentLiveConfig(parentRoutingGroupId: string, sampleCap: number | undefined, onProgress?: (progress: GroupRunProgress) => void): Promise<any> {
  const jobId = await submitBatch({ routingGroupId: parentRoutingGroupId, variants: [], sampleCap });
  const result = await pollJob(parentRoutingGroupId, jobId, undefined, onProgress);

  return (result as any).groupRun ?? (result as any).variation ?? result;
}

// ---- Past simulations (read-only: backend request R1/R2) -------------------------------------




// Flip to true (or wire VITE_SIM_USE_MOCK) until backend R1/R2 are live in your environment.
function useMock(env: Record<string, any> = import.meta.env): boolean {
  return (env && String(env.VITE_SIM_USE_MOCK)) === "true";
}

/** List persisted simulations (R1). Returns { headers, total }. */
export async function fetchPastSimulations(f: PastSimulationsFilters): Promise<{ headers: any[]; total: number }> {
  if (useMock()) { const { mockPastSimulations } = await import("../mock/pastSimulationsMock"); return mockPastSimulations(f); }
  const params = pastSimulationsQuery(f);
  const resp: any = await api({
    url: "sim-routing/brokeringSimulations",
    method: "GET",
    baseURL: simApiBaseUrl(),
    params,
  });
  if (commonUtil.hasError(resp)) throw new Error(`Failed to load past simulations: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  // Confirmed contract: { simulationList: [...headers], totalCount }.
  const headers = resp.data?.simulationList ?? (Array.isArray(resp.data) ? resp.data : []);
  const total = Number(resp.data?.totalCount ?? headers.length);
  return { headers, total };
}

/** Fetch one persisted simulation with its variants (R2). Returns the raw response for the adapter. */
export async function fetchPastSimulation(simulationId: string): Promise<any> {
  if (useMock()) { const { mockPastSimulation } = await import("../mock/pastSimulationsMock"); return mockPastSimulation(simulationId); }
  const resp: any = await api({
    url: `sim-routing/brokeringSimulations/${simulationId}`,
    method: "GET",
    baseURL: simApiBaseUrl(),
  });
  if (commonUtil.hasError(resp)) throw new Error(`Failed to load simulation ${simulationId}: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  return resp.data;
}

export const SimulationService = {
  submitBatch,
  pollJob,
  runParentLiveConfig,
  fetchPastSimulations,
  fetchPastSimulation,
  isFilteredQuery,
};
