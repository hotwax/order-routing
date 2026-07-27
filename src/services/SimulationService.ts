import { commonUtil } from "@common";
import { simApi } from "./SimApiService";
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
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

/** POST one batch (≤5 variants). Returns the jobId. Throws on non-2xx. */
export async function submitBatch({ routingGroupId, variants, sampleCap, signal }: SubmitBatchArgs): Promise<string> {
  const resp: any = await simApi({
    url: `sim-routing/routingGroups/${routingGroupId}/brokeringSimulation/jobs`,
    method: "POST",
    data: { variants, ...(sampleCap != null ? { sampleCap } : {}) },
    ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(resp) || !resp.data?.jobId) {
    throw new Error(`Failed to submit simulation batch: ${JSON.stringify(resp?.data ?? resp)?.slice(0, 300)}`);
  }
  return resp.data.jobId;
}

export class SimulationPollError extends Error {
  readonly recoverable: boolean;

  constructor(message: string, recoverable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "SimulationPollError";
    this.recoverable = recoverable;
  }
}

export function isRecoverableSimulationPollError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as any).recoverable === true);
}

const abortError = () => Object.assign(
  new DOMException("Simulation request was cancelled.", "AbortError"),
  { recoverable: true },
);

const isTransientRequestError = (error: any): boolean => {
  const status = Number(error?.response?.status);
  return !Number.isFinite(status) || status === 408 || status === 429 || status >= 500;
};

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(abortError());
  const onAbort = () => {
    clearTimeout(timer);
    reject(abortError());
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, ms);
  signal?.addEventListener("abort", onAbort, { once: true });
});

/** Poll a job to completion with a sinceSeq cursor for the live progress feed.
 *  Resolves with { groupRun?, variation? } on success; throws on failure/timeout.
 *  `onPhase` gets the raw status each poll; `onProgress` gets the `progress` object each poll
 *  that carries one (running ticks and the terminal flush). */
export async function pollJob(routingGroupId: string, jobId: string, onPhase?: (status: string) => void, onProgress?: (progress: GroupRunProgress) => void, signal?: AbortSignal): Promise<{ groupRun?: any; variation?: any }> {
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  let sinceSeq = 0;
  let consecutivePollErrors = 0;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw abortError();
    let resp: any;
    try {
      resp = await simApi({
        url: `sim-routing/routingGroups/${routingGroupId}/brokeringSimulation/jobs/${jobId}`,
        method: "GET",
        params: { sinceSeq },
        ...(signal ? { signal } : {}),
      });
      consecutivePollErrors = 0;
    } catch (error: any) {
      if (signal?.aborted) throw abortError();
      if (!isTransientRequestError(error)) throw error;
      consecutivePollErrors += 1;
      if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        throw new SimulationPollError(
          "Simulation status could not be refreshed. Reopen this routing group to resume the run.",
          true,
          { cause: error },
        );
      }
      await sleep(POLL_INTERVAL_MS, signal);
      continue;
    }
    if (commonUtil.hasError(resp)) throw new Error(`Polling failed: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
    const status = resp.data as JobStatusResponse;
    onPhase?.(status.status);
    if (status.progress) {
      onProgress?.(status.progress);
      if (typeof status.progress.nextSeq === "number") sinceSeq = Math.max(sinceSeq, status.progress.nextSeq);
    }
    const outcome = interpretJobStatus(status); // same module — call directly
    if (outcome.done) {
      if (outcome.error) throw new Error(outcome.error);
      if (!outcome.result || (outcome.result.groupRun == null && outcome.result.variation == null)) {
        throw new Error("Simulation completed without a result. Please re-run this batch.");
      }
      return outcome.result;
    }
    await sleep(POLL_INTERVAL_MS, signal);
  }
  throw new SimulationPollError(
    "Simulation timed out. Reopen this routing group to resume the run, or re-run the batch.",
    true,
  );
}

/** Run the parent group's live config (no variants) via the existing job endpoint, returning its
 *  GroupRunResult. Reuses submitBatch (empty variants -> baseline groupRun) + pollJob for live
 *  progress. `onProgress` receives each progress tick for the parent-side progress bar. */
export async function runParentLiveConfig(parentRoutingGroupId: string, sampleCap: number | undefined, onProgress?: (progress: GroupRunProgress) => void, signal?: AbortSignal): Promise<any> {
  const jobId = await submitBatch({ routingGroupId: parentRoutingGroupId, variants: [], sampleCap, signal });
  const result = await pollJob(parentRoutingGroupId, jobId, undefined, onProgress, signal);

  return (result as any).groupRun ?? (result as any).variation ?? result;
}

// ---- Past simulations (read-only: backend request R1/R2) -------------------------------------

/** List persisted simulations (R1). Returns { headers, total }. */
export async function fetchPastSimulations(f: PastSimulationsFilters, signal?: AbortSignal): Promise<{ headers: any[]; total: number }> {
  if (!String(f.productStoreId || "").trim()) {
    throw new Error("A product store is required to load simulation history.");
  }
  const params = pastSimulationsQuery(f);
  const resp: any = await simApi({
    url: "sim-routing/brokeringSimulations",
    method: "GET",
    params,
    ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(resp)) throw new Error(`Failed to load past simulations: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  // Confirmed contract: { simulationList: [...headers], totalCount }.
  const headers = resp.data?.simulationList ?? (Array.isArray(resp.data) ? resp.data : []);
  const total = Number(resp.data?.totalCount ?? headers.length);
  return { headers, total };
}

/** Fetch one persisted simulation with its variants (R2). Returns the raw response for the adapter. */
export async function fetchPastSimulation(simulationId: string, signal?: AbortSignal): Promise<any> {
  const resp: any = await simApi({
    url: `sim-routing/brokeringSimulations/${simulationId}`,
    method: "GET",
    ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(resp)) throw new Error(`Failed to load simulation ${simulationId}: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
  return resp.data;
}

/** List routing groups from the simulation instance without touching the live OMS routing store. */
export async function fetchRoutingGroups(productStoreId: string, signal?: AbortSignal): Promise<any[]> {
  const scopedStoreId = String(productStoreId || "").trim();
  if (!scopedStoreId) throw new Error("A product store is required to load simulation routing groups.");
  const resp: any = await simApi({
    url: "order-routing/groups",
    method: "GET",
    params: { productStoreId: scopedStoreId, pageSize: 200 },
    ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(resp) || !Array.isArray(resp.data)) {
    throw new Error("Failed to load routing groups from the simulation backend.");
  }
  return resp.data;
}

/** Fetch the authoritative raw group tree from the simulation instance. */
export async function fetchRoutingGroupDetail(routingGroupId: string, signal?: AbortSignal): Promise<any> {
  const resp: any = await simApi({
    url: `order-routing/groups/${routingGroupId}/raw`,
    method: "GET",
    ...(signal ? { signal } : {}),
  });
  if (commonUtil.hasError(resp) || !resp.data || typeof resp.data !== "object" || Array.isArray(resp.data)) {
    throw new Error(`Routing group ${routingGroupId} could not be loaded from the simulation backend.`);
  }
  return resp.data;
}

export const SimulationService = {
  submitBatch,
  pollJob,
  runParentLiveConfig,
  fetchPastSimulations,
  fetchPastSimulation,
  fetchRoutingGroups,
  fetchRoutingGroupDetail,
  isFilteredQuery,
};
