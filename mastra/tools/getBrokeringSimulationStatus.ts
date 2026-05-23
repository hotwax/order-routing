import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

const STATUS_TIMEOUT_MS = 5_000;

export function createGetBrokeringSimulationStatusTool(omsBaseUrl: string, authToken: string) {
  return createTool({
    id: "getBrokeringSimulationStatus",
    description:
      "Check the status of an async brokering simulation submitted via submitBrokeringSimulation. " +
      "Returns { jobId, status, impact?, error? } where status is one of 'running', 'complete', 'failed', or 'not_found'. " +
      "When status === 'complete' the response includes the same impact payload runBrokeringSimulation returns. " +
      "Poll every 5-10 seconds while running. Completed jobs stay pollable for ~5 minutes; after that the job " +
      "returns 'not_found' and must be resubmitted.",
    inputSchema: z.object({
      productStoreId: z.string().describe(
        "The product store the simulation was submitted against — always read from pageCapabilityManifest.visibleEntities.productStoreId."
      ),
      jobId: z.string().describe("The job UUID returned by submitBrokeringSimulation.")
    }),
    execute: async ({ productStoreId, jobId }) => {
      const base = omsBaseUrl.replace(/\/$/, "").replace(/\/api$/, "/rest/s1");
      const url = `${base}/order-routing/productStores/${encodeURIComponent(productStoreId)}/brokeringSimulation/jobs/${encodeURIComponent(jobId)}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
        signal: AbortSignal.timeout(STATUS_TIMEOUT_MS)
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        const msg = `brokeringSimulation/jobs/${jobId} (status) failed: HTTP ${resp.status} ${resp.url}${text ? ` — ${text.substring(0, 400)}` : ""}`;
        console.error("[getBrokeringSimulationStatus]", msg);
        throw new Error(msg);
      }
      return resp.json();
    }
  });
}
