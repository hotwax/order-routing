import { CircuitStorageService } from '@/services/CircuitStorageService'
import * as types from './mutation-types'

type ClearHistoryContext = {
  commit: (type: string, payload?: unknown) => void;
  state: {
    currentThreadId: string | null;
  };
};

export async function clearCurrentChatHistory({ commit, state }: ClearHistoryContext) {
  if (state.currentThreadId) {
    await CircuitStorageService.deleteMessages(state.currentThreadId);
  }

  commit(types.CLEAR_HISTORY);
  commit(types.SET_LAST_PROMPT, null);
}
