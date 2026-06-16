import type {
  ProposalPayload,
  ProposalErrorStage,
  ProposalResult,
  ApproveErrorStage,
  ApproveResult,
  SuggestPromptErrorStage,
  SuggestPromptRequest,
  SuggestPromptResult,
  ProposeRequest,
  RefineRequest,
  ApproveRequest,
} from "@/types/circuit";


const ENDPOINT_PROPOSE = "/knowledge-feedback/propose";
const ENDPOINT_REFINE = "/knowledge-feedback/refine";
const ENDPOINT_APPROVE = "/knowledge-feedback/approve";
const ENDPOINT_SUGGEST = "/knowledge-feedback/suggest-prompt";

import { mastraUrl as resolveMastraUrl } from "../util/simConfig";

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

async function postProposal(
  endpoint: string,
  body: unknown
): Promise<ProposalResult> {
  const url = `${resolveMastraUrl()}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err: any) {
    return {
      ok: false,
      stage: "network",
      error: err?.message ? `Circuit unreachable: ${err.message}` : "Circuit unreachable."
    };
  }

  let parsed: any;
  try {
    parsed = await response.json();
  } catch {
    return {
      ok: false,
      stage: "network",
      error: `Unexpected non-JSON response (HTTP ${response.status}).`
    };
  }

  if (!response.ok || parsed?.ok === false) {
    const stage: ProposalErrorStage = VALID_PROPOSAL_STAGES.has(parsed?.stage)
      ? parsed.stage
      : "network";
    return {
      ok: false,
      stage,
      error:
        typeof parsed?.error === "string" && parsed.error
          ? parsed.error
          : `Feedback proposal failed with HTTP ${response.status}`
    };
  }

  return { ok: true, proposal: parsed.proposal as ProposalPayload };
}

export async function proposeKnowledgeFeedback(
  request: ProposeRequest
): Promise<ProposalResult> {
  return postProposal(ENDPOINT_PROPOSE, request);
}

export async function refineKnowledgeFeedback(
  request: RefineRequest
): Promise<ProposalResult> {
  return postProposal(ENDPOINT_REFINE, request);
}

export async function approveKnowledgeFeedback(
  request: ApproveRequest
): Promise<ApproveResult> {
  const url = `${resolveMastraUrl()}${ENDPOINT_APPROVE}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
  } catch (err: any) {
    return {
      ok: false,
      stage: "network",
      error: err?.message ? `Circuit unreachable: ${err.message}` : "Circuit unreachable."
    };
  }

  let parsed: any;
  try {
    parsed = await response.json();
  } catch {
    return {
      ok: false,
      stage: "network",
      error: `Unexpected non-JSON response (HTTP ${response.status}).`
    };
  }

  if (!response.ok || parsed?.ok === false) {
    const stage: ApproveErrorStage = VALID_APPROVE_STAGES.has(parsed?.stage)
      ? parsed.stage
      : "network";
    return {
      ok: false,
      stage,
      error:
        typeof parsed?.error === "string" && parsed.error
          ? parsed.error
          : `Feedback approval failed with HTTP ${response.status}`
    };
  }

  return {
    ok: true,
    commitSha: String(parsed.commitSha || ""),
    shortSha: String(parsed.shortSha || ""),
    summary: String(parsed.summary || ""),
    editCount: Number(parsed.editCount || 0)
  };
}

export async function suggestKnowledgeFeedbackPrompt(
  request: SuggestPromptRequest,
  signal?: AbortSignal
): Promise<SuggestPromptResult> {
  const url = `${resolveMastraUrl()}${ENDPOINT_SUGGEST}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal
    });
  } catch (err: any) {
    return {
      ok: false,
      stage: "network",
      error: err?.message ? `Circuit unreachable: ${err.message}` : "Circuit unreachable."
    };
  }

  let parsed: any;
  try {
    parsed = await response.json();
  } catch {
    return {
      ok: false,
      stage: "network",
      error: `Unexpected non-JSON response (HTTP ${response.status}).`
    };
  }

  if (!response.ok || parsed?.ok === false) {
    const stage: SuggestPromptErrorStage = VALID_SUGGEST_STAGES.has(parsed?.stage)
      ? parsed.stage
      : "network";
    return {
      ok: false,
      stage,
      error:
        typeof parsed?.error === "string" && parsed.error
          ? parsed.error
          : `Suggestion failed with HTTP ${response.status}`
    };
  }

  return {
    ok: true,
    suggestedPrompt: String(parsed.suggestedPrompt || "")
  };
}

export const CircuitKnowledgeFeedbackService = {
  proposeKnowledgeFeedback,
  refineKnowledgeFeedback,
  approveKnowledgeFeedback,
  suggestKnowledgeFeedbackPrompt,
};
