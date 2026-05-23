import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

export function createFacilityChangeSummaryTool(omsBaseUrl: string, authToken: string) {
  return createTool({
    id: "getFacilityChangeSummary",
    description:
      "Fetches aggregate OrderFacilityChange data for a product store over a TIME WINDOW (default 7 days). " +
      "This is a decisions LOG, not current item state — it does not show items still at facilityId='_NA_' " +
      "in the brokering queue that no rule attempted. Do not use this tool to answer 'how many items are stuck', " +
      "'how many are still in queue', 'how many were not attempted', or similar current-state questions. " +
      "It is also NOT scoped to a single brokering run; when reporting counts, always cite the window from " +
      "windowFrom/windowTo and never claim 'most recent run' attribution from this response. " +
      "Returns three parallel dimensions over the same brokering decisions: " +
      "(1) byDestinationFacility — per-facility order counts, change reason breakdown, per-rule breakdown, and distinct engine comments; " +
      "(2) byRoutingGroup — routing group → rule → facility drill-down, mirroring the page hierarchy of brokering runs → routings → rules; " +
      "(3) byRule — flat ranking of which rules drove the most decisions (note: groupName/routingGroupId/sequenceNum may be undefined on byRule entries due to a known backend gap — read those identifiers from byRoutingGroup or from the pageCapabilityManifest). " +
      "Also returns totalChanges, windowFrom, and windowTo. " +
      "Use this to answer questions about why orders went to specific facilities or queues (use byDestinationFacility), " +
      "which brokering run or rule sent the most orders somewhere over the window (use byRoutingGroup).",
    inputSchema: z.object({
      productStoreId: z.string().describe("The product store to query — always read from pageCapabilityManifest.visibleEntities.productStoreId. Never ask the user for this value."),
      fromDate: z.string().nullish().describe("ISO timestamp — defaults to 7 days ago on the server"),
      facilityId: z.string().nullish().describe("Optionally filter to one destination facility")
    }),
    execute: async ({ productStoreId, fromDate, facilityId }) => {
      const params = new URLSearchParams({ productStoreId });
      if (fromDate) params.set("fromDate", fromDate);
      if (facilityId) params.set("facilityId", facilityId);
      // getOmsURL() returns …/api/ — Moqui REST endpoints live at …/rest/s1/.
      // Normalise by replacing the /api suffix with /rest/s1, then strip trailing slash.
      const base = omsBaseUrl.replace(/\/$/, "").replace(/\/api$/, "/rest/s1");
      const resp = await fetch(
        `${base}/order-routing/facility-changes/summary?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        const msg = `facility-changes/summary failed: HTTP ${resp.status} ${resp.url}${body ? ` — ${body.substring(0, 400)}` : ""}`;
        console.error("[getFacilityChangeSummary]", msg);
        throw new Error(msg);
      }
      return resp.json();
    }
  });
}
