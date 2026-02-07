import { MutationTree } from 'vuex'
import CircuitState from './CircuitState'
import * as types from './mutation-types'

const mutations: MutationTree<CircuitState> = {
  [types.SET_INTRO_DONE](state, payload: boolean) {
    state.isIntroDone = payload
  },
  [types.SET_CHAT_STARTED](state, payload: boolean) {
    state.isChatStarted = payload
  },
  [types.SET_THREADS](state, payload: any[]) {
    state.threads = payload
  },
  [types.SET_CURRENT_THREAD_ID](state, payload: string | null) {
    state.currentThreadId = payload
  },
  [types.SET_MESSAGES](state, payload: any[]) {
    state.messages = payload
  },
  [types.ADD_MESSAGE](state, payload: any) {
    state.messages.push(payload)
  },
  [types.CLEAR_HISTORY](state) {
    state.messages = []
  },
  [types.SET_MODEL_INFO](state, payload: any) {
    state.modelInfo = payload;
  },
  [types.UPDATE_LAST_MESSAGE](state, payload: string) {
    if (state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1];
      // Create a new object to ensure reactivity
      state.messages.splice(state.messages.length - 1, 1, {
        ...lastMessage,
        content: lastMessage.content + payload
      });
    }
  }
}

export default mutations;
