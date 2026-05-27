import { JobStatusResponse } from "../types/simulation";

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
