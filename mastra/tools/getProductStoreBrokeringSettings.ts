import { createTool } from "@mastra/core/tools";
import { z } from "zod/v4";

export function createProductStoreBrokeringSettingsTool(omsBaseUrl: string, authToken: string) {
  return createTool({
    id: "getProductStoreBrokeringSettings",
    description:
      "Fetches product-store-level brokering settings (e.g. brokeringShipmentThreshold). " +
      "Returns settings as an object keyed by setting name. A value of null means the setting is not configured at the " +
      "product store level — do not infer a default. Use this only when the question asks about store-level brokering " +
      "configuration (thresholds, store-wide knobs). For per-rule shipment thresholds (SHIP_THRESHOLD), the value is " +
      "already present on each inventory rule in pageCapabilityManifest.visibleEntities.brokeringRuns and this tool is not needed.",
    inputSchema: z.object({
      productStoreId: z.string().describe("The product store to query — always read from pageCapabilityManifest.visibleEntities.productStoreId. Never ask the user for this value.")
    }),
    execute: async ({ productStoreId }) => {
      const base = omsBaseUrl.replace(/\/$/, "").replace(/\/api$/, "/rest/s1");
      const resp = await fetch(
        `${base}/order-routing/productStores/${encodeURIComponent(productStoreId)}/brokeringSettings`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        const msg = `productStores/${productStoreId}/brokeringSettings failed: HTTP ${resp.status} ${resp.url}${body ? ` — ${body.substring(0, 400)}` : ""}`;
        console.error("[getProductStoreBrokeringSettings]", msg);
        throw new Error(msg);
      }
      return resp.json();
    }
  });
}
