// Pure prompt-building utilities for Circuit draft feedback flows.
// No external system calls — all functions are synchronous transformations.

import type { DraftFeedbackType, DraftFeedbackProposalSummary } from "@/types/circuit";
export type { DraftFeedbackType, DraftFeedbackProposalSummary };

export function buildDiscardFeedbackPrompt(proposal: DraftFeedbackProposalSummary) {
  const summary = String(proposal.summary || "").trim();
  return [
    "Proposal discarded.",
    summary ? `Discarded proposal: ${summary}` : "",
    "What should Circuit change next time? Share the correction or reason so I can use it as feedback."
  ].filter(Boolean).join("\n\n");
}

export function buildFeedbackSavedMessage() {
  return "Feedback saved. I will use it to improve future proposals.";
}

export function buildFeedbackRevisionPrompt(originalPrompt: string, feedback: string, proposal: DraftFeedbackProposalSummary) {
  const summary = String(proposal.summary || "").trim();
  return [
    `Original request: ${originalPrompt.trim()}`,
    summary ? `Discarded proposal: ${summary}` : "",
    `User feedback: ${feedback.trim()}`,
    "Create a revised proposal that still satisfies the original request, but applies the feedback.",
    "Do not include changes that the feedback rejected."
  ].filter(Boolean).join("\n\n");
}

export function buildFeedbackRevisionMessage(proposalMessage: string, hasProposal: boolean) {
  const intro = hasProposal
    ? "Feedback saved. I created a revised proposal from your original request."
    : "Feedback saved. I used it to revise the original request.";

  return [intro, proposalMessage].filter(Boolean).join("\n\n");
}
