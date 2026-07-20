import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.fn();

vi.mock("@common", () => ({ client: (...args: any[]) => client(...args) }));
vi.mock("@/utils/simConfig", () => ({ mastraUrl: () => "https://circuit.example" }));

import {
  approveKnowledgeFeedback,
  proposeKnowledgeFeedback,
} from "@/services/CircuitKnowledgeFeedbackService";

describe("CircuitKnowledgeFeedbackService", () => {
  beforeEach(() => client.mockReset());

  it("submits a correction and returns the proposed knowledge edit", async () => {
    client.mockResolvedValue({
      data: {
        ok: true,
        proposal: {
          proposalId: "P1",
          summary: "Add a missing example",
          rationale: "User correction",
          edits: [{ op: "append", path: "patterns[0].examples", value: "Why did this order queue?" }],
        },
      },
    });

    const request = {
      messages: [{ role: "user" as const, content: "Why did this order queue?" }],
      userCorrection: "Circuit should ask for the order id first",
      correctionCategory: "missed_clarifying_question" as const,
    };

    await expect(proposeKnowledgeFeedback(request)).resolves.toMatchObject({
      ok: true,
      proposal: { proposalId: "P1" },
    });
    expect(client).toHaveBeenCalledWith({
      url: "/knowledge-feedback/propose",
      method: "POST",
      baseURL: "https://circuit.example",
      data: request,
      headers: { "Content-Type": "application/json" },
    });
  });

  it("preserves a known server error stage and normalizes unknown stages", async () => {
    client.mockRejectedValueOnce({ response: { status: 422, data: { stage: "validation", error: "Missing correction" } } });
    await expect(proposeKnowledgeFeedback({ messages: [], userCorrection: "" }))
      .resolves.toEqual({ ok: false, stage: "validation", error: "Missing correction" });

    client.mockResolvedValueOnce({ data: { ok: false, stage: "unexpected", error: "Unknown" } });
    await expect(proposeKnowledgeFeedback({ messages: [], userCorrection: "x" }))
      .resolves.toEqual({ ok: false, stage: "network", error: "Unknown" });
  });

  it("maps approval metadata used by the confirmation UI", async () => {
    client.mockResolvedValue({
      data: { ok: true, commitSha: "abc123", shortSha: "abc123", summary: "Added example", editCount: 1 },
    });

    await expect(approveKnowledgeFeedback({
      proposal: { proposalId: "P1", summary: "Added example", rationale: "Correction", edits: [] },
      userCorrection: "Use this example",
      messages: [],
    })).resolves.toEqual({
      ok: true,
      commitSha: "abc123",
      shortSha: "abc123",
      summary: "Added example",
      editCount: 1,
    });
  });

});
