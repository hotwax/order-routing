import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

export function createBrokeringFacilityGroupsTool(omsBaseUrl: string, authToken: string) {
  return createTool({
    id: "getBrokeringFacilityGroups",
    description:
      "Fetches the brokering facility groups configured for a product store and the facilities that belong to each. " +
      "Returns groups[] where each entry has facilityGroupId, facilityGroupName, optional description, and members[] with " +
      "{ facilityId, facilityName, facilityTypeId }. Use this to answer questions about which facility groups exist for " +
      "warehouses, stores, or other facility roles, and which facilities belong to each group. " +
      "Do not call this for run-config questions — those are answered from pageCapabilityManifest.visibleEntities.brokeringRuns.",
    inputSchema: z.object({
      productStoreId: z.string().describe("The product store to query — always read from pageCapabilityManifest.visibleEntities.productStoreId. Never ask the user for this value.")
    }),
    execute: async ({ productStoreId }) => {
      const base = omsBaseUrl.replace(/\/$/, "").replace(/\/api$/, "/rest/s1");
      const resp = await fetch(
        `${base}/order-routing/productStores/${encodeURIComponent(productStoreId)}/brokeringFacilityGroups`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        const msg = `brokeringFacilityGroups failed: HTTP ${resp.status} ${resp.url}${body ? ` — ${body.substring(0, 400)}` : ""}`;
        console.error("[getBrokeringFacilityGroups]", msg);
        throw new Error(msg);
      }
      return resp.json();
    }
  });
}
