import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

export function createFacilityOrderLimitsTool(omsBaseUrl: string, authToken: string) {
  return createTool({
    id: "getFacilityOrderLimits",
    description:
      "Fetches facilities (scoped to the product store's brokering facility groups) that have a non-null " +
      "maximumOrderLimit. Returns facilities[] with { facilityId, facilityName, maximumOrderLimit }. " +
      "An empty array means no facility caps are configured for this store's brokering set. " +
      "Use this to answer whether facility order limits could be blocking allocation — cross-reference the returned " +
      "facility IDs against each inventory rule's FACILITY_ORDER_LIMIT setting in " +
      "pageCapabilityManifest.visibleEntities.brokeringRuns to identify which rules actually enforce these caps.",
    inputSchema: z.object({
      productStoreId: z.string().describe("The product store to query — always read from pageCapabilityManifest.visibleEntities.productStoreId. Never ask the user for this value.")
    }),
    execute: async ({ productStoreId }) => {
      const params = new URLSearchParams({ productStoreId });
      const base = omsBaseUrl.replace(/\/$/, "").replace(/\/api$/, "/rest/s1");
      const resp = await fetch(
        `${base}/order-routing/facilities/order-limits?${params}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        const msg = `facilities/order-limits failed: HTTP ${resp.status} ${resp.url}${body ? ` — ${body.substring(0, 400)}` : ""}`;
        console.error("[getFacilityOrderLimits]", msg);
        throw new Error(msg);
      }
      return resp.json();
    }
  });
}
