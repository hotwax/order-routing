import { expect, it } from "vitest";
import { readAssistantStream } from "../src/utils/assistantStream";

const frame = (event: string, data: unknown) => `event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
function response(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      // Deliberately split CRLF, JSON and multibyte characters between reads.
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    }
  }));
}
it("streams readable updates across chunk boundaries and returns only the final result", async () => {
  const events: any[] = [];
  const final = { intent: "inquiry", message: "Nearest café" };
  const result = await readAssistantStream(response(
    ': heartbeat\r\n\r\n' + frame('status', { type: 'status', phase: 'answering' }) +
    frame('text', { type: 'text', text: 'Nearest café' }) + frame('result', final)
  ), event => events.push(event));
  expect(events).toEqual([{ type: 'status', phase: 'answering' }, { type: 'text', text: 'Nearest café' }]);
  expect(result).toEqual(final);
});
it("never turns a disconnected partial answer into a proposal", async () => {
  await expect(readAssistantStream(response(frame('text', { type: 'text', text: 'Proposed change' })), () => {}))
    .rejects.toThrow('interrupted');
});
it("reports a validation failure instead of returning a partial result", async () => {
  await expect(readAssistantStream(response(frame('text', { type: 'text', text: 'Change stores' }) +
    frame('error', { message: 'Draft validation failed' })), () => {})).rejects.toThrow('Draft validation failed');
});
it("rejects malformed event data", async () => {
  await expect(readAssistantStream(response('event: result\ndata: {broken}\n\n'), () => {})).rejects.toThrow();
});
