import { readAssistantStream, type AssistantProgress } from "@/utils/assistantStream";
import { client, commonUtil, useAuth } from "@common";
import type { DraftConversationMessage, DraftOperationSet, PageCapabilityManifest } from "@/types/draft";
import type { BrokeringRunsListInquiryResult } from "@/types/circuit";
import {
  normalizeConversationHistory,
  convertBrokeringRouteDraftToOperations,
  createDraftProposal, validateDraftOperations,
  applyDraftProposal, summarizeDraftOperations, formatDraftProposalSections,
} from "../utils/draftUtils";
import { requireDraftAssistantUrl } from "../utils/simConfig";
import { prepareDraftAssistantManifest, serializeDraftAssistantManifest } from "../utils/draftAssistantContext";

type DraftRequestOptions = {
  conversationHistory?: DraftConversationMessage[];
  onProgress?: (event: AssistantProgress) => void;
};

export async function requestBrokeringRouteDraftOperations(prompt: string, manifest: PageCapabilityManifest, options: DraftRequestOptions = {}): Promise<DraftOperationSet> {
  const conversationHistory = normalizeConversationHistory(options.conversationHistory || []);
  const assistantManifest = prepareDraftAssistantManifest(manifest);
  const transportManifest = serializeDraftAssistantManifest(assistantManifest);
  const assistantUrl = requireDraftAssistantUrl();
  let response: any;
  try {
    if (options.onProgress) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const streamed = await fetch(`${assistantUrl}/brokering-route-assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          credentials: "omit",
          signal: controller.signal,
          body: JSON.stringify({ prompt, conversationHistory, pageCapabilityManifest: transportManifest, outputContract: transportManifest.outputContract })
        });
        if (!streamed.ok) {
          const error = await streamed.json().catch(() => ({}));
          throw new Error(error.error || `Draft assistant failed with ${streamed.status}`);
        }
        // Existing deployments can keep returning JSON during a staggered rollout.
        response = { data: streamed.headers.get("content-type")?.includes("text/event-stream")
          ? await readAssistantStream(streamed, options.onProgress)
          : await streamed.json() };
      } finally {
        clearTimeout(timeout);
      }
    } else response = await client({
      url: "/brokering-route-assistant",
      method: "POST",
      baseURL: assistantUrl,
      // Draft/editor requests do not delegate OMS credentials. Diagnostic delegation is
      // limited to the runs-list inquiry below; no token belongs in a request body.
      data: { prompt, conversationHistory, pageCapabilityManifest: transportManifest, outputContract: transportManifest.outputContract },
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    if (err.response) {
      const errorBody = err.response.data as { error?: string; issues?: string[] } | null;
      const issues = errorBody?.issues?.length ? ` ${errorBody.issues.join(" ")}` : "";
      throw new Error(errorBody?.error ? `${errorBody.error}${issues}` : `Draft assistant failed with ${err.response.status}`);
    }
    if (options.onProgress) {
      throw new Error(err?.name === "AbortError" ? "Circuit timed out. Please try again." : err?.message || "Circuit could not finish this response.");
    }
    throw new Error(`Draft assistant is not reachable at ${assistantUrl}.`);
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
    return { ...convertBrokeringRouteDraftToOperations(providerPlan.draft, assistantManifest), intent: "edit" };
  }
  return { ...convertBrokeringRouteDraftToOperations(providerPlan, assistantManifest), intent: "edit" };
}

export async function requestBrokeringRunsListInquiry(prompt: string, manifest: PageCapabilityManifest, conversationHistory: DraftConversationMessage[] = []): Promise<BrokeringRunsListInquiryResult> {
  const assistantUrl = requireDraftAssistantUrl();
  const maargUrl = commonUtil.getMaargURL();
  const token = commonUtil.getToken();
  let omsInstance: string | undefined;
  if (maargUrl && token) {
    try {
      const maarg = new URL(maargUrl);
      if (maarg.protocol === "https:" && !maarg.username && !maarg.password) omsInstance = maarg.origin;
    } catch {
      // Keep configuration questions available when the authenticated OMS connection is missing.
    }
  }
  if (omsInstance && !useAuth().isAuthenticated.value) {
    throw new Error("Your session has changed or expired. Refresh this page before requesting routing diagnostics.");
  }
  try {
    const response = await client({
      url: "/brokering-runs-list-inquiry",
      method: "POST",
      baseURL: assistantUrl,
      // Circuit resolves this non-secret origin against its server-side allowlist. The bearer
      // stays in the transport header and is used only for fixed, read-only OMS requests.
      data: { prompt, conversationHistory, pageCapabilityManifest: manifest, ...(omsInstance ? { omsInstance } : {}) },
      headers: { "Content-Type": "application/json", ...(omsInstance ? { Authorization: `Bearer ${token}` } : {}) },
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
    throw new Error(`Draft assistant is not reachable at ${assistantUrl}.`);
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
