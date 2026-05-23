import { commonUtil, cookieHelper } from "@common";
import type { DraftConversationMessage, PageCapabilityManifest } from "@/services/DraftAssistantService";

export type BrokeringRunsListInquiryResult = {
  message: string;
  questions: string[];
  summary: string;
};

const ENDPOINT = "/brokering-runs-list-inquiry";

export async function requestBrokeringRunsListInquiry(
  prompt: string,
  manifest: PageCapabilityManifest,
  conversationHistory: DraftConversationMessage[] = []
): Promise<BrokeringRunsListInquiryResult> {
  const mastraUrl = (import.meta.env.VITE_VUE_APP_MASTRA_URL || "http://localhost:4111").replace(/\/$/, "");
  // The order-routing/facility-changes endpoint lives on Moqui (Maarg), not OFBiz/OMS,
  // so the assistant tool needs the Maarg base URL.
  const omsBaseUrl = commonUtil.getMaargURL() || commonUtil.getOmsURL();
  const authToken = cookieHelper().get("token");
  let response: Response;
  try {
    response = await fetch(`${mastraUrl}${ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        conversationHistory,
        pageCapabilityManifest: manifest,
        ...(omsBaseUrl ? { omsBaseUrl } : {}),
        ...(authToken ? { authToken } : {})
      })
    });
  } catch {
    throw new Error(`Mastra is not reachable at ${mastraUrl}. Start it with pnpm mastra:dev in sandbox/circuit.`);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: string; issues?: string[] } | null;
    const issues = errorBody?.issues?.length ? ` ${errorBody.issues.join(" ")}` : "";
    throw new Error(errorBody?.error ? `${errorBody.error}${issues}` : `Inquiry assistant failed with ${response.status}`);
  }

  const body = await response.json() as {
    schemaVersion?: string;
    message?: string;
    questions?: string[];
    summary?: string;
  };

  return {
    message: String(body?.message || "").trim(),
    questions: Array.isArray(body?.questions) ? body.questions.map(String).filter(Boolean) : [],
    summary: String(body?.summary || "").trim()
  };
}
