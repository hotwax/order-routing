import { ActionTree } from 'vuex'
import RootState from '@/store/RootState'
import CircuitState from './CircuitState'
import * as types from './mutation-types'

const actions: ActionTree<CircuitState, RootState> = {
  setIntroDone({ commit }, payload: boolean) {
    commit(types.SET_INTRO_DONE, payload)
  },
  setChatStarted({ commit }, payload: boolean) {
    commit(types.SET_CHAT_STARTED, payload)
  },
  resetCircuit({ commit }) {
    commit(types.SET_INTRO_DONE, false)
    commit(types.SET_CHAT_STARTED, false)
  },
  startNewChat({ commit }) {
    commit(types.SET_CHAT_STARTED, false)
  }
}


export default actions;
