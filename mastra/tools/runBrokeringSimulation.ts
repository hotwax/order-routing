import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

const SWEEP_PARAMETER = z.enum([
  "distance",
  "brokeringSafetyStock",
  "weekOfSupplyThreshold",
  "facilityGroupId",
  "assignmentEnumId",
  "ignoreFacilityOrderLimit",
  "splitOrderItemGroup"
]);

const runBrokeringSimulationInputSchema = z.object({
  productStoreId: z.string().describe(
    "The product store to simulate against — always read from pageCapabilityManifest.visibleEntities.productStoreId. Never ask the user for this value."
  ),

  // --- parameter changes (in-memory only) ---
  distance: z.number().int().nullish().describe(
    "Max facility-to-order distance. Units match the rule's measurement system (mi for IMPERIAL, km for METRIC)."
  ),
  brokeringSafetyStock: z.number().int().nullish().describe(
    "Safety stock buffer subtracted from on-hand inventory when scoring facility candidates."
  ),
  weekOfSupplyFilterEnabled: z.boolean().nullish(),
  weekOfSupplyThreshold: z.number().int().nullish(),
  facilityGroupId: z.string().nullish().describe(
    "Brokering facility group to use for the simulation (advisory; the rule's group is the live default)."
  ),
  ignoreFacilityOrderLimit: z.boolean().nullish(),
  splitOrderItemGroup: z.boolean().nullish(),
  assignmentEnumId: z.enum(["ORA_SINGLE", "ORA_MULTI"]).nullish().describe(
    "Routing strategy. ORA_SINGLE = all items to one facility; ORA_MULTI = items may split. Advisory: currently passed to the FTL context but not fully wired end-to-end."
  ),
  inventorySortByList: z.array(z.string()).nullish().describe(
    "Sort fields for facility ranking (e.g. ['salesVelocity', 'weekOfSupply'])."
  ),

  // --- data overrides (write to sim_* snapshot tables; reverted at end of round) ---
  minimumStockOverrides: z.record(z.string(), z.number().int()).nullish().describe(
    "Map of productId → integer. Sets minimum_stock on the snapshot."
  ),
  inventoryCountOverrides: z.record(z.string(), z.number().int()).nullish().describe(
    "Map of productId → integer. Sets last_inventory_count on the snapshot."
  ),
  allowBrokeringOverrides: z.record(z.string(), z.boolean()).nullish().describe(
    "Map of productId → boolean. Stored as Y/N on the snapshot."
  ),
  maximumOrderLimitOverrides: z.record(z.string(), z.number().int()).nullish().describe(
    "Map of facilityId → integer. Sets maximum_order_limit on the snapshot."
  ),
  facilitiesToSimulateAtLimit: z.array(z.string()).nullish().describe(
    "Facility IDs to push 'at the limit' — sets last_order_count = maximum_order_limit so the brokering FTL treats them as exhausted."
  ),
  facilitiesToAddToGroup: z.array(z.string()).nullish().describe(
    "Facility IDs to INSERT into facilityGroupId. REQUIRES facilityGroupId."
  ),
  facilitiesToRemoveFromGroup: z.array(z.string()).nullish().describe(
    "Facility IDs to DELETE from facilityGroupId. REQUIRES facilityGroupId."
  ),

  // --- sensitivity sweep (one POST returns multiple variants) ---
  sweepParameter: SWEEP_PARAMETER.nullish(),
  sweepValues: z.array(z.union([z.number(), z.string(), z.boolean()])).nullish().describe(
    "Values to iterate. Length matches the number of variants in the response's sweepResults."
  ),

  // --- operational ---
  routingRuleId: z.string().nullish().describe(
    "Override which OrderRoutingRule to simulate against. Default: first RULE_ACTIVE rule."
  )
});

/**
 * Reference output shape (not enforced — backend response is returned as-is):
 *
 * {
 *   impact: {
 *     proposedChange: string,            // e.g. "distance=100, safetyStock=3"
 *     ordersInScope: number,             // capped at simulation.sampleCap (default 500)
 *     round1Routed: number,              // baseline
 *     round2Routed: number,              // with proposed change
 *     additionalOrdersRouted: number,    // round2 - round1 (negative = fewer routed)
 *     backorderRateBefore: string,       // "47.0%"
 *     backorderRateAfter: string,        // "37.6%"
 *     avgDistanceBefore: string,         // "578mi" or "920km"
 *     avgDistanceAfter: string,
 *     topNewFacilities: Array<{ facilityId: string, additionalOrders: number, avgDistance: string }>,
 *     facilitiesNearingLimit: string[],  // >=90% of maximum_order_limit in round 2
 *     replicaLagSeconds: number,
 *     sampleSize: number,
 *     simulationRan: boolean,            // false = unavailable; do not fabricate numbers
 *     sweepResults: Array<{ parameterValue: any, round2Routed: number, additionalOrdersRouted: number, backorderRateAfter: string }> | null
 *   }
 * }
 */

// Submit + poll: the backend wraps the sync endpoint in an async job to avoid holding
// an XA transaction open for the full simulation. Jobs are GC'd ~5min after completion,
// so the polling deadline stays safely under that.
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 4 * 60_000;
const INITIAL_DELAY_MS = 2_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createRunBrokeringSimulationTool(omsBaseUrl: string, authToken: string) {
  return createTool({
    id: "runBrokeringSimulation",
    description:
      "Predict the impact of a proposed brokering change on a product store WITHOUT modifying production data. " +
      "Returns predicted orders routed, backorder rate, average distance, top-impact facilities, and optional " +
      "sensitivity-sweep variants. Use when a user asks 'what if we...' about any brokering parameter (distance, " +
      "safety stock, facility groups, etc). All parameters are optional except productStoreId — omit fields you " +
      "don't want to change. For 'show me the effect across a range' questions, pass sweepParameter + sweepValues. " +
      "Blocks for ~30-90s while the simulator runs both baseline and proposed rounds.",
    inputSchema: runBrokeringSimulationInputSchema,
    execute: async ({ productStoreId, ...body }) => {
      const base = omsBaseUrl.replace(/\/$/, "").replace(/\/api$/, "/rest/s1");
      const jobsUrl = `${base}/order-routing/productStores/${encodeURIComponent(productStoreId)}/brokeringSimulation/jobs`;
      const headers = {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      };
      const cleanBody = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined && v !== null)
      );

      console.log(`[runBrokeringSimulation] SUBMIT productStoreId=${productStoreId} body=${JSON.stringify(cleanBody)}`);
      const submitResp = await fetch(jobsUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(cleanBody)
      });
      if (!submitResp.ok) {
        const text = await submitResp.text().catch(() => "");
        const msg = `brokeringSimulation submit failed: HTTP ${submitResp.status} ${submitResp.url}${text ? ` — ${text.substring(0, 400)}` : ""}`;
        console.error("[runBrokeringSimulation]", msg);
        throw new Error(msg);
      }
      const submitJson = (await submitResp.json()) as { jobId?: string; status?: string };
      const jobId = submitJson?.jobId;
      if (!jobId) {
        throw new Error("brokeringSimulation submit response missing jobId");
      }
      console.log(`[runBrokeringSimulation] SUBMITTED jobId=${jobId} status=${submitJson.status ?? "submitted"}`);

      await sleep(INITIAL_DELAY_MS);
      const pollUrl = `${jobsUrl}/${encodeURIComponent(jobId)}`;
      const deadline = Date.now() + MAX_POLL_DURATION_MS;
      const pollHeaders = { Authorization: `Bearer ${authToken}` };

      while (Date.now() < deadline) {
        const pollResp = await fetch(pollUrl, { method: "GET", headers: pollHeaders });
        if (!pollResp.ok) {
          const text = await pollResp.text().catch(() => "");
          const msg = `brokeringSimulation poll failed: HTTP ${pollResp.status} ${pollResp.url}${text ? ` — ${text.substring(0, 400)}` : ""}`;
          console.error("[runBrokeringSimulation]", msg);
          throw new Error(msg);
        }
        const payload = (await pollResp.json()) as {
          jobId?: string;
          status?: string;
          impact?: any;
          error?: string;
        };

        switch (payload.status) {
          case "complete": {
            const impact = payload.impact || {};
            console.log(`[runBrokeringSimulation] COMPLETE jobId=${jobId} ordersInScope=${impact.ordersInScope} round1=${impact.round1Routed} round2=${impact.round2Routed} simulationRan=${impact.simulationRan} replicaLag=${impact.replicaLagSeconds}`);
            return { impact };
          }
          case "failed":
            throw new Error(`Simulation failed: ${payload.error ?? "unknown"}`);
          case "not_found":
            throw new Error(`Simulation jobId ${jobId} expired before completion`);
          case "submitted":
          case "running":
            await sleep(POLL_INTERVAL_MS);
            continue;
          default:
            throw new Error(`Unexpected simulation status: ${payload.status}`);
        }
      }
      throw new Error(`Simulation jobId ${jobId} did not complete within ${MAX_POLL_DURATION_MS / 1000}s`);
    }
  });
}
