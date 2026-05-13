import assert from "assert";
import { clearCurrentChatHistory } from "../src/store/modules/circuit/historyActions";
import * as types from "../src/store/modules/circuit/mutation-types";
import { CircuitStorageService } from "../src/services/CircuitStorageService";

{
  const commits: { type: string; payload: unknown }[] = [];
  let deletedThreadId = "";
  const originalDeleteMessages = (CircuitStorageService as any).deleteMessages;
  (CircuitStorageService as any).deleteMessages = async (threadId: string) => {
    deletedThreadId = threadId;
  };

  await clearCurrentChatHistory({
    commit: (type: string, payload: unknown) => commits.push({ type, payload }),
    state: { currentThreadId: "thread-1" }
  });

  assert.equal(deletedThreadId, "thread-1");
  assert.deepEqual(commits, [
    { type: types.CLEAR_HISTORY, payload: undefined },
    { type: types.SET_LAST_PROMPT, payload: null }
  ]);

  (CircuitStorageService as any).deleteMessages = originalDeleteMessages;
}

{
  const commits: { type: string; payload: unknown }[] = [];
  const originalDeleteMessages = (CircuitStorageService as any).deleteMessages;
  (CircuitStorageService as any).deleteMessages = async () => {
    throw new Error("deleteMessages should not run without a current thread");
  };

  await clearCurrentChatHistory({
    commit: (type: string, payload: unknown) => commits.push({ type, payload }),
    state: { currentThreadId: null }
  });

  assert.deepEqual(commits, [
    { type: types.CLEAR_HISTORY, payload: undefined },
    { type: types.SET_LAST_PROMPT, payload: null }
  ]);

  (CircuitStorageService as any).deleteMessages = originalDeleteMessages;
}

console.log("Circuit clear history tests passed");
