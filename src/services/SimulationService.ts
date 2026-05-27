import { JobStatusResponse, SimVariant } from "../types/simulation";

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

// Verified: each round runs ~10–12 min on the current source DB; a 5-variant batch can approach
// an hour. Poll every 15s (backend guidance: 10–20s, don't hammer) and cap generously at 90 min.
const POLL_INTERVAL_MS = 15_000;
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
    url: `order-routing/routingGroups/${routingGroupId}/brokeringSimulation/jobs`,
    method: "POST",
    data: { variants, ...(sampleCap != null ? { sampleCap } : {}) },
  });
  if (commonUtil.hasError(resp) || !resp.data?.jobId) {
    throw new Error(`Failed to submit simulation batch: ${JSON.stringify(resp?.data ?? resp)?.slice(0, 300)}`);
  }
  return resp.data.jobId;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll a job to completion. Resolves with { groupRun?, variation? } on success; throws on failure/timeout.
 *  `onPhase` is called with the raw status string after each poll so the UI can show progress. */
export async function pollJob(
  routingGroupId: string,
  jobId: string,
  onPhase?: (status: string) => void,
): Promise<{ groupRun?: any; variation?: any }> {
  const { api, commonUtil } = await import("@common");
  const deadline = Date.now() + MAX_POLL_DURATION_MS;
  while (Date.now() < deadline) {
    const resp: any = await api({
      url: `order-routing/routingGroups/${routingGroupId}/brokeringSimulation/jobs/${jobId}`,
      method: "GET",
    });
    if (commonUtil.hasError(resp)) throw new Error(`Polling failed: ${JSON.stringify(resp?.data)?.slice(0, 300)}`);
    const status = resp.data as JobStatusResponse;
    onPhase?.(status.status);
    const outcome = interpretJobStatus(status); // same module — call directly
    if (outcome.done) {
      if (outcome.error) throw new Error(outcome.error);
      return outcome.result ?? {};
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Simulation timed out. Please re-run this batch.");
}
