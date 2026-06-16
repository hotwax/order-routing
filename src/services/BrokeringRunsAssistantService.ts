import { client, commonUtil } from "@common";
import type { DraftConversationMessage, PageCapabilityManifest } from "@/services/DraftAssistantService";
import type { BrokeringRunsListInquiryResult } from "@/types/circuit";

export { BrokeringRunsListInquiryResult };

export function getMastraUrl(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_MASTRA_URL) || "http://localhost:4111").replace(/\/$/, "");
}

async function requestBrokeringRunsListInquiry(
  prompt: string,
  manifest: PageCapabilityManifest,
  conversationHistory: DraftConversationMessage[] = []
): Promise<BrokeringRunsListInquiryResult> {
  const mastraUrl = getMastraUrl();
  // The order-routing/facility-changes endpoint lives on Moqui (Maarg), not OFBiz/OMS,
  // so the assistant tool needs the Maarg base URL and OMS Bearer token to make Moqui calls.
  const omsBaseUrl = commonUtil.getMaargURL() || commonUtil.getOmsURL();
  const authToken = commonUtil.getToken();
  try {
    const response = await client({
      url: "/brokering-runs-list-inquiry",
      method: "POST",
      baseURL: mastraUrl,
      headers: { "Content-Type": "application/json" },
      data: {
        prompt,
        conversationHistory,
        pageCapabilityManifest: manifest,
        ...(omsBaseUrl ? { omsBaseUrl } : {}),
        ...(authToken ? { authToken } : {})
      }
    });
    const body = response.data as { schemaVersion?: string; message?: string; questions?: string[]; summary?: string };
    return {
      message: String(body?.message || "").trim(),
      questions: Array.isArray(body?.questions) ? body.questions.map(String).filter(Boolean) : [],
      summary: String(body?.summary || "").trim()
    };
  } catch (err: any) {
    if (err.response) {
      const errorBody = err.response.data as { error?: string; issues?: string[] } | null;
      const issues = errorBody?.issues?.length ? ` ${errorBody.issues.join(" ")}` : "";
      throw new Error(errorBody?.error ? `${errorBody.error}${issues}` : `Inquiry assistant failed with ${err.response.status}`);
    }
    throw new Error(`Mastra is not reachable at ${mastraUrl}. Start the circuit server (pnpm dev in sandbox/circuit).`);
  }
}

export const BrokeringRunAssistantService = {
  requestBrokeringRunsListInquiry,
};
