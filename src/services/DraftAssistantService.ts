import { client, commonUtil } from "@common";
import type { DraftConversationMessage, DraftOperationSet, PageCapabilityManifest } from "@/types/draft";
import type { BrokeringRunsListInquiryResult } from "@/types/circuit";
import {
  normalizeConversationHistory,
  convertBrokeringRouteDraftToOperations,
  createDraftProposal, validateDraftOperations,
  applyDraftProposal, summarizeDraftOperations, formatDraftProposalSections,
} from "../utils/draftUtils";
import { mastraUrl } from "../utils/simConfig";

type DraftRequestOptions = {
  conversationHistory?: DraftConversationMessage[];
};

export async function requestBrokeringRouteDraftOperations(prompt: string, manifest: PageCapabilityManifest, options: DraftRequestOptions = {}): Promise<DraftOperationSet> {
  const conversationHistory = normalizeConversationHistory(options.conversationHistory || []);
  const omsBaseUrl = commonUtil.getMaargURL() || commonUtil.getOmsURL();
  const authToken = commonUtil.getToken();
  let response: any;
  try {
    response = await client({
      url: "/brokering-route-assistant",
      method: "POST",
      baseURL : mastraUrl(),
      data: { prompt, conversationHistory, pageCapabilityManifest: manifest, outputContract: manifest.outputContract, ...(omsBaseUrl ? { omsBaseUrl } : {}), ...(authToken ? { authToken } : {}) },
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    if (err.response) {
      const errorBody = err.response.data as { error?: string; issues?: string[] } | null;
      const issues = errorBody?.issues?.length ? ` ${errorBody.issues.join(" ")}` : "";
      throw new Error(errorBody?.error ? `${errorBody.error}${issues}` : `Draft assistant failed with ${err.response.status}`);
    }
    throw new Error(`Mastra is not reachable at ${mastraUrl()}. Start the circuit server (pnpm dev in sandbox/circuit).`);
  }

  const providerPlan = response.data;
  if (providerPlan?.schemaVersion === "brokering-route-assistant.v1") {
    if (providerPlan.intent === "inquiry") {
      return {
        operations: [],
        unansweredQuestions: Array.isArray(providerPlan.questions) ? providerPlan.questions.map(String).filter(Boolean) : [],
        summary: String(providerPlan.message || providerPlan.summary || "Answered routing question."),
        intent: "inquiry"
      };
    }
    return { ...convertBrokeringRouteDraftToOperations(providerPlan.draft, manifest), intent: "edit" };
  }
  return { ...convertBrokeringRouteDraftToOperations(providerPlan, manifest), intent: "edit" };
}

export async function requestBrokeringRunsListInquiry(prompt: string, manifest: PageCapabilityManifest, conversationHistory: DraftConversationMessage[] = []): Promise<BrokeringRunsListInquiryResult> {
  // The order-routing/facility-changes endpoint lives on Moqui (Maarg), not OFBiz/OMS,
  // so the assistant tool needs the Maarg base URL and OMS Bearer token to make Moqui calls.
  const omsBaseUrl = commonUtil.getMaargURL() || commonUtil.getOmsURL();
  const authToken = commonUtil.getToken();
  try {
    const response = await client({
      url: "/brokering-runs-list-inquiry",
      method: "POST",
      baseURL: mastraUrl(),
      data: { prompt, conversationHistory, pageCapabilityManifest: manifest, ...(omsBaseUrl ? { omsBaseUrl } : {}), ...(authToken ? { authToken } : {}) },
      headers: { "Content-Type": "application/json" },
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
    throw new Error(`Mastra is not reachable at ${mastraUrl()}. Start the circuit server (pnpm dev in sandbox/circuit).`);
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
