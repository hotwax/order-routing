import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

// Input shape mirrors runBrokeringSimulation. Kept inline (rather than imported) so the tool
// is self-contained and Mastra type inference stays simple. Update both files together if the
// simulator backend grows new override fields.
const submitBrokeringSimulationInputSchema = z.object({
  productStoreId: z.string().describe(
    "The product store to simulate against — always read from pageCapabilityManifest.visibleEntities.productStoreId. Never ask the user for this value."
  ),

  distance: z.number().int().nullish(),
  brokeringSafetyStock: z.number().int().nullish(),
  weekOfSupplyFilterEnabled: z.boolean().nullish(),
  weekOfSupplyThreshold: z.number().int().nullish(),
  facilityGroupId: z.string().nullish(),
  ignoreFacilityOrderLimit: z.boolean().nullish(),
  splitOrderItemGroup: z.boolean().nullish(),
  assignmentEnumId: z.enum(["ORA_SINGLE", "ORA_MULTI"]).nullish(),
  inventorySortByList: z.array(z.string()).nullish(),

  minimumStockOverrides: z.record(z.string(), z.number().int()).nullish(),
  inventoryCountOverrides: z.record(z.string(), z.number().int()).nullish(),
  allowBrokeringOverrides: z.record(z.string(), z.boolean()).nullish(),
  maximumOrderLimitOverrides: z.record(z.string(), z.number().int()).nullish(),
  facilitiesToSimulateAtLimit: z.array(z.string()).nullish(),
  facilitiesToAddToGroup: z.array(z.string()).nullish(),
  facilitiesToRemoveFromGroup: z.array(z.string()).nullish(),

  sweepParameter: z.enum([
    "distance",
    "brokeringSafetyStock",
    "weekOfSupplyThreshold",
    "facilityGroupId",
    "assignmentEnumId",
    "ignoreFacilityOrderLimit",
    "splitOrderItemGroup"
  ]).nullish(),
  sweepValues: z.array(z.union([z.number(), z.string(), z.boolean()])).nullish(),

  routingRuleId: z.string().nullish()
});

const SUBMIT_TIMEOUT_MS = 5_000;

export function createSubmitBrokeringSimulationTool(omsBaseUrl: string, authToken: string) {
  return createTool({
    id: "submitBrokeringSimulation",
    description:
      "Submit a brokering 'what-if' simulation for async execution. Returns { jobId, status: 'submitted' }. " +
      "Call getBrokeringSimulationStatus({productStoreId, jobId}) to retrieve the result. " +
      "Use this only when you expect the simulation to take longer than the sync tool can wait, or when the user " +
      "explicitly wants to fire-and-forget. For typical scenarios prefer runBrokeringSimulation (sync).",
    inputSchema: submitBrokeringSimulationInputSchema,
    execute: async ({ productStoreId, ...body }) => {
      const base = omsBaseUrl.replace(/\/$/, "").replace(/\/api$/, "/rest/s1");
      const url = `${base}/order-routing/productStores/${encodeURIComponent(productStoreId)}/brokeringSimulation/jobs`;
      const cleanBody = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined && v !== null)
      );
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(cleanBody),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS)
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        const msg = `brokeringSimulation/jobs (submit) failed: HTTP ${resp.status} ${resp.url}${text ? ` — ${text.substring(0, 400)}` : ""}`;
        console.error("[submitBrokeringSimulation]", msg);
        throw new Error(msg);
      }
      return resp.json();
    }
  });
}
