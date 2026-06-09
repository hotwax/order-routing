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
