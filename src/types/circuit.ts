// src/types/circuit.ts
// Types for the Circuit / Mastra AI assistant integration. Pure TS — no runtime imports.

export type BrokeringRunsListInquiryResult = {
  message: string;
  questions: string[];
  summary: string;
};

// --- Circuit storage (IndexedDB) ---

export interface ChatThread {
  id: string;
  name: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'circuit';
  content: string;
  createdAt: number;
}

export interface DraftFeedbackRecord {
  id: string;
  threadId: string;
  type: 'approved' | 'revision_requested' | 'rejected';
  userFeedback: string;
  sourcePrompt: string;
  proposalSummary: string;
  operations: any[];
  unansweredQuestions: string[];
  createdAt: number;
}

// --- Circuit feedback util types ---

export type DraftFeedbackType = "approved" | "revision_requested" | "rejected";

export type DraftFeedbackProposalSummary = {
  summary?: string;
};

// --- Knowledge feedback (Mastra /knowledge-feedback/* endpoints) ---

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
  | { ok: true; commitSha: string; shortSha: string; summary: string; editCount: number }
  | { ok: false; stage: ApproveErrorStage; error: string };

export type SuggestPromptErrorStage = "validation" | "llm" | "network";

export type SuggestPromptRequest = {
  messages: KnowledgeFeedbackMessage[];
  correctionCategory?: CorrectionCategory;
  context?: KnowledgeFeedbackContext;
};

export type SuggestPromptResult =
  | { ok: true; suggestedPrompt: string }
  | { ok: false; stage: SuggestPromptErrorStage; error: string };

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
