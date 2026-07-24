import { client } from "@common";
import type { ProposalPayload, ProposalErrorStage, ProposalResult, ApproveErrorStage, ApproveResult, SuggestPromptErrorStage, SuggestPromptRequest, SuggestPromptResult, ProposeRequest, RefineRequest, ApproveRequest } from "@/types/circuit";

import { requireDraftAssistantUrl } from "../utils/simConfig";

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

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Draft assistant configuration is invalid.";
}

function draftAssistantBaseUrl(): { ok: true; baseURL: string } | { ok: false; error: string } {
  try {
    return { ok: true, baseURL: requireDraftAssistantUrl() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isProposalPayload(value: unknown): value is ProposalPayload {
  return isRecord(value)
    && typeof value.proposalId === "string" && value.proposalId.length > 0
    && typeof value.summary === "string"
    && typeof value.rationale === "string"
    && Array.isArray(value.edits)
    && Array.isArray(value.editDescriptions);
}

async function postProposal(endpoint: string, body: unknown): Promise<ProposalResult> {
  const assistant = draftAssistantBaseUrl();
  if (!assistant.ok) return { ok: false, stage: "validation", error: assistant.error };

  try {
    const response = await client({
      url: endpoint,
      method: "POST",
      baseURL: assistant.baseURL,
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const parsed = response.data;
    if (parsed?.ok === false) {
      const stage: ProposalErrorStage = VALID_PROPOSAL_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return { ok: false, stage, error: typeof parsed?.error === "string" && parsed.error ? parsed.error : "Feedback proposal failed" };
    }
    if (parsed?.ok !== true || !isProposalPayload(parsed.proposal)) {
      return { ok: false, stage: "validation", error: "Circuit returned an invalid feedback proposal." };
    }
    return { ok: true, proposal: parsed.proposal };
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
  const assistant = draftAssistantBaseUrl();
  if (!assistant.ok) return { ok: false, stage: "validation", error: assistant.error };

  try {
    const response = await client({
      url: "/knowledge-feedback/approve",
      method: "POST",
      baseURL: assistant.baseURL,
      data: request,
      headers: { "Content-Type": "application/json" },
    });
    const parsed = response.data;
    if (parsed?.ok === false) {
      const stage: ApproveErrorStage = VALID_APPROVE_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return { ok: false, stage, error: typeof parsed?.error === "string" && parsed.error ? parsed.error : "Feedback approval failed" };
    }
    const editCount = Number(parsed?.editCount);
    if (parsed?.ok !== true
      || typeof parsed.commitSha !== "string" || !parsed.commitSha
      || typeof parsed.shortSha !== "string" || !parsed.shortSha
      || typeof parsed.summary !== "string"
      || !Number.isInteger(editCount) || editCount < 0) {
      return { ok: false, stage: "validation", error: "Circuit returned an invalid feedback approval result." };
    }
    return {
      ok: true,
      commitSha: parsed.commitSha,
      shortSha: parsed.shortSha,
      summary: parsed.summary,
      editCount
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
  const assistant = draftAssistantBaseUrl();
  if (!assistant.ok) return { ok: false, stage: "validation", error: assistant.error };

  try {
    const response = await client({
      url: "/knowledge-feedback/suggest-prompt",
      method: "POST",
      baseURL: assistant.baseURL,
      data: request,
      signal,
      headers: { "Content-Type": "application/json" },
    });
    const parsed = response.data;
    if (parsed?.ok === false) {
      const stage: SuggestPromptErrorStage = VALID_SUGGEST_STAGES.has(parsed?.stage) ? parsed.stage : "network";
      return { ok: false, stage, error: typeof parsed?.error === "string" && parsed.error ? parsed.error : "Suggestion failed" };
    }
    if (parsed?.ok !== true || typeof parsed.suggestedPrompt !== "string" || !parsed.suggestedPrompt.trim()) {
      return { ok: false, stage: "validation", error: "Circuit returned an invalid feedback suggestion." };
    }
    return { ok: true, suggestedPrompt: parsed.suggestedPrompt };
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
