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
  }
}

export default mutations;
