import { client, commonUtil, cookieHelper } from "@common";
import type { DraftConversationMessage, DraftOperationSet, PageCapabilityManifest } from "@/types/draft";
import type { BrokeringRunsListInquiryResult } from "@/types/circuit";
import {
  ROUTE_ASSISTANT_ENDPOINT,
  normalizeConversationHistory,
  convertBrokeringRouteDraftToOperations,
  createDraftProposal, validateDraftOperations,
  applyDraftProposal, summarizeDraftOperations, formatDraftProposalSections,
} from "../util/draftUtils";
import { mastraUrl } from "../util/simConfig";

type DraftRequestOptions = {
  conversationHistory?: DraftConversationMessage[];
};

export async function requestBrokeringRouteDraftOperations(prompt: string, manifest: PageCapabilityManifest, options: DraftRequestOptions = {}): Promise<DraftOperationSet> {
  const conversationHistory = normalizeConversationHistory(options.conversationHistory || []);
  const url = mastraUrl();
  const omsBaseUrl = commonUtil.getMaargURL() || commonUtil.getOmsURL();
  const authToken = cookieHelper().get("token");
  let response: Response;
  try {
    response = await fetch(`${url}${ROUTE_ASSISTANT_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        conversationHistory,
        pageCapabilityManifest: manifest,
        outputContract: manifest.outputContract,
        ...(omsBaseUrl ? { omsBaseUrl } : {}),
        ...(authToken ? { authToken } : {})
      })
    });
  } catch {
    throw new Error(`Mastra is not reachable at ${url}. Start the circuit server (pnpm dev in sandbox/circuit).`);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: string; issues?: string[] } | null;
    const issues = errorBody?.issues?.length ? ` ${errorBody.issues.join(" ")}` : "";
    throw new Error(errorBody?.error ? `${errorBody.error}${issues}` : `Draft assistant failed with ${response.status}`);
  }

  const providerPlan = await response.json();
  if (providerPlan?.schemaVersion === "brokering-route-assistant.v1") {
    if (providerPlan.intent === "inquiry") {
      return {
        operations: [],
        unansweredQuestions: Array.isArray(providerPlan.questions) ? providerPlan.questions.map(String).filter(Boolean) : [],
        summary: String(providerPlan.message || providerPlan.summary || "Answered routing question."),
        intent: "inquiry"
      };
    }

    return {
      ...convertBrokeringRouteDraftToOperations(providerPlan.draft, manifest),
      intent: "edit"
    };
  }

  return {
    ...convertBrokeringRouteDraftToOperations(providerPlan, manifest),
    intent: "edit"
  };
}

const BROKERING_RUNS_INQUIRY_ENDPOINT = "/brokering-runs-list-inquiry";

export async function requestBrokeringRunsListInquiry(
  prompt: string,
  manifest: PageCapabilityManifest,
  conversationHistory: DraftConversationMessage[] = []
): Promise<BrokeringRunsListInquiryResult> {
  const url = mastraUrl();
  // The order-routing/facility-changes endpoint lives on Moqui (Maarg), not OFBiz/OMS,
  // so the assistant tool needs the Maarg base URL and OMS Bearer token to make Moqui calls.
  const omsBaseUrl = commonUtil.getMaargURL() || commonUtil.getOmsURL();
  const authToken = commonUtil.getToken();
  try {
    const response = await client({
      url: BROKERING_RUNS_INQUIRY_ENDPOINT,
      method: "POST",
      baseURL: url,
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
    throw new Error(`Mastra is not reachable at ${url}. Start the circuit server (pnpm dev in sandbox/circuit).`);
  }
}

export const DraftAssistantService = {
  requestBrokeringRouteDraftOperations,
  requestBrokeringRunsListInquiry,
  createDraftProposal,
  applyDraftProposal,
  formatDraftProposalSections,
  validateDraftOperations,
  summarizeDraftOperations,
};
