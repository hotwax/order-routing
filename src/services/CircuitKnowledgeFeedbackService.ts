export type KnowledgeFeedbackMessage = {
  role: "user" | "assistant";
  content: string;
};

export type KnowledgeFeedbackRequest = {
  messages: KnowledgeFeedbackMessage[];
  userCorrection: string;
  context?: {
    routingGroupId?: string | null;
    routingRuleId?: string | null;
    activeContextLabel?: string;
  };
};

export type KnowledgeFeedbackStage = "network" | "llm" | "validation" | "yaml_parse" | "git";

export type KnowledgeFeedbackResult =
  | {
      ok: true;
      commitSha: string;
      shortSha: string;
      summary: string;
      editCount: number;
    }
  | {
      ok: false;
      error: string;
      stage: KnowledgeFeedbackStage;
    };

const ENDPOINT = "/knowledge-feedback";

function resolveMastraUrl(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const raw = env.VITE_VUE_APP_MASTRA_URL || "http://localhost:4111";
  return raw.replace(/\/$/, "");
}

function isValidStage(value: unknown): value is KnowledgeFeedbackStage {
  return value === "network" || value === "llm" || value === "validation" || value === "yaml_parse" || value === "git";
}

export async function submitKnowledgeFeedback(
  request: KnowledgeFeedbackRequest
): Promise<KnowledgeFeedbackResult> {
  const url = `${resolveMastraUrl()}${ENDPOINT}`;
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

  let body: any;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      stage: "network",
      error: `Unexpected non-JSON response (HTTP ${response.status}).`
    };
  }

  if (!response.ok || body?.ok === false) {
    const stage = isValidStage(body?.stage) ? body.stage : "network";
    const error = typeof body?.error === "string" && body.error
      ? body.error
      : `Knowledge feedback failed with HTTP ${response.status}`;
    return { ok: false, stage, error };
  }

  return {
    ok: true,
    commitSha: String(body.commitSha || ""),
    shortSha: String(body.shortSha || ""),
    summary: String(body.summary || ""),
    editCount: Number(body.editCount || 0)
  };
}
