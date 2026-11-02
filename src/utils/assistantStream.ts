export type AssistantProgress =
  | { type: "status"; phase: "classifying" | "answering" | "drafting" | "validating" | "retrying" }
  | { type: "text"; text: string };

// SSE frames may span network chunks, including UTF-8 characters. Only a final
// result is returned to the proposal converter; partial text is display-only.
export async function readAssistantStream(response: Response, onProgress: (event: AssistantProgress) => void): Promise<any> {
  if (!response.body) throw new Error("Circuit returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = frame.split("\n");
        const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
        const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        const payload = JSON.parse(data);
        if (event === "error") throw new Error(payload.message || "Circuit could not finish this response.");
        if (event === "result") return payload;
        if (event === "status" || event === "text") onProgress(payload);
      }
      if (done) throw new Error("Circuit's response was interrupted. Please try again.");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
