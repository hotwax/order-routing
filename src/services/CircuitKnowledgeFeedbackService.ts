export type KnowledgeFeedbackMessage = {
  role: "user" | "assistant";
  content: string;
};

export type KnowledgeFeedbackContext = {
  routingGroupId?: string | null;
  routingRuleId?: string | null;
  activeContextLabel?: string;
};

export type CorrectionCategory =
  | "wrong_recommendation"
  | "missed_clarifying_question"
  | "misnamed_entity"
  | "should_have_used_tool"
  | "other";

export type EditOp =
  | { op: "append"; path: string; value: unknown }
  | { op: "set"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "insertAt"; path: string; index: number; value: unknown };

export type EditDescription = {
  op: "append" | "set" | "remove" | "insertAt";
  path: string;
  text: string;
};

export type ProposalPayload = {
  proposalId: string;
  summary: string;
  rationale: string;
  edits: EditOp[];
  editDescriptions: EditDescription[];
};

export type CarriedProposal = {
  proposalId: string;
  summary: string;
  rationale: string;
  edits: EditOp[];
};

export type ProposalErrorStage = "validation" | "llm" | "applier_dry_run" | "network";

export type ProposalResult =
  | { ok: true; proposal: ProposalPayload }
  | { ok: false; stage: ProposalErrorStage; error: string };

export type ApproveErrorStage = "validation" | "applier" | "yaml_parse" | "git" | "network";

export type ApproveResult =
  | {
      ok: true;
      commitSha: string;
      shortSha: string;
      summary: string;
      editCount: number;
    }
  | { ok: false; stage: ApproveErrorStage; error: string };

export type ProposeRequest = {
  messages: KnowledgeFeedbackMessage[];
  userCorrection: string;
  correctionCategory?: CorrectionCategory;
  context?: KnowledgeFeedbackContext;
};

export type RefineRequest = ProposeRequest & {
  previousProposal: CarriedProposal;
  refinementFeedback: string;
};

export type ApproveRequest = {
  proposal: CarriedProposal;
  userCorrection: string;
  refinementHistory?: string[];
  messages: KnowledgeFeedbackMessage[];
};

const ENDPOINT_PROPOSE = "/knowledge-feedback/propose";
const ENDPOINT_REFINE = "/knowledge-feedback/refine";
const ENDPOINT_APPROVE = "/knowledge-feedback/approve";

function resolveMastraUrl(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const raw = env.VITE_VUE_APP_MASTRA_URL || "http://localhost:4111";
  return raw.replace(/\/$/, "");
}

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
