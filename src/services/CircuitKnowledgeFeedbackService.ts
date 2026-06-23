import { client } from "@common";
import type { ProposalPayload, ProposalErrorStage, ProposalResult, ApproveErrorStage, ApproveResult, SuggestPromptErrorStage, SuggestPromptRequest, SuggestPromptResult, ProposeRequest, RefineRequest, ApproveRequest } from "@/types/circuit";

import { mastraUrl } from "../utils/simConfig";

const VALID_PROPOSAL_STAGES = new Set<ProposalErrorStage>([
  "validation",
  "llm",
  "applier_dry_run",
  "network"
]);

const VALID_APPROVE_STAGES = new Set<ApproveErrorStage>([
  "validation",
  "applier",
  "yaml_parse",
  "git",
  "network"
]);

const VALID_SUGGEST_STAGES = new Set<SuggestPromptErrorStage>([
  "validation",
  "llm",
  "network"
]);

async function postProposal(endpoint: string, body: unknown): Promise<ProposalResult> {
  try {
    const response = await client({
      url: endpoint,
      method: "POST",
      baseURL: mastraUrl(),
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const parsed = response.data;
    if (parsed?.ok === false) {
      const stage: ProposalErrorStage = VALID_PROPOSAL_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return { ok: false, stage, error: typeof parsed?.error === "string" && parsed.error ? parsed.error : "Feedback proposal failed" };
    }
    return { ok: true, proposal: parsed.proposal as ProposalPayload };
  } catch (err: any) {
    if (err.response) {
      const parsed = err.response.data;
      const stage: ProposalErrorStage = VALID_PROPOSAL_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return {
        ok: false,
        stage,
        error: typeof parsed?.error === "string" && parsed.error
          ? parsed.error
          : `Feedback proposal failed with HTTP ${err.response.status}`
      };
    }
    return { ok: false, stage: "network", error: err?.message ? `Circuit unreachable: ${err.message}` : "Circuit unreachable." };
  }
}

export async function proposeKnowledgeFeedback(request: ProposeRequest): Promise<ProposalResult> {
  return postProposal("/knowledge-feedback/propose", request);
}

export async function refineKnowledgeFeedback(request: RefineRequest): Promise<ProposalResult> {
  return postProposal("/knowledge-feedback/refine", request);
}

export async function approveKnowledgeFeedback(request: ApproveRequest): Promise<ApproveResult> {
  try {
    const response = await client({
      url: "/knowledge-feedback/approve",
      method: "POST",
      baseURL: mastraUrl(),
      data: request,
      headers: { "Content-Type": "application/json" },
    });
    const parsed = response.data;
    if (parsed?.ok === false) {
      const stage: ApproveErrorStage = VALID_APPROVE_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return { ok: false, stage, error: typeof parsed?.error === "string" && parsed.error ? parsed.error : "Feedback approval failed" };
    }
    return {
      ok: true,
      commitSha: String(parsed.commitSha || ""),
      shortSha: String(parsed.shortSha || ""),
      summary: String(parsed.summary || ""),
      editCount: Number(parsed.editCount || 0)
    };
  } catch (err: any) {
    if (err.response) {
      const parsed = err.response.data;
      const stage: ApproveErrorStage = VALID_APPROVE_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return {
        ok: false,
        stage,
        error: typeof parsed?.error === "string" && parsed.error
          ? parsed.error
          : `Feedback approval failed with HTTP ${err.response.status}`
      };
    }
    return { ok: false, stage: "network", error: err?.message ? `Circuit unreachable: ${err.message}` : "Circuit unreachable." };
  }
}

export async function suggestKnowledgeFeedbackPrompt(request: SuggestPromptRequest, signal?: AbortSignal): Promise<SuggestPromptResult> {
  try {
    const response = await client({
      url: "/knowledge-feedback/suggest-prompt",
      method: "POST",
      baseURL: mastraUrl(),
      data: request,
      signal,
      headers: { "Content-Type": "application/json" },
    });
    const parsed = response.data;
    if (parsed?.ok === false) {
      const stage: SuggestPromptErrorStage = VALID_SUGGEST_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return { ok: false, stage, error: typeof parsed?.error === "string" && parsed.error ? parsed.error : "Suggestion failed" };
    }
    return { ok: true, suggestedPrompt: String(parsed.suggestedPrompt || "") };
  } catch (err: any) {
    if (err.response) {
      const parsed = err.response.data;
      const stage: SuggestPromptErrorStage = VALID_SUGGEST_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return {
        ok: false,
        stage,
        error: typeof parsed?.error === "string" && parsed.error
          ? parsed.error
          : `Suggestion failed with HTTP ${err.response.status}`
      };
    }
    return { ok: false, stage: "network", error: err?.message ? `Circuit unreachable: ${err.message}` : "Circuit unreachable." };
  }
}

export const CircuitKnowledgeFeedbackService = {
  proposeKnowledgeFeedback,
  refineKnowledgeFeedback,
  approveKnowledgeFeedback,
  suggestKnowledgeFeedbackPrompt,
};
