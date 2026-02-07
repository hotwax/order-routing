import { GetterTree } from 'vuex'
import RootState from '@/store/RootState'
import CircuitState from './CircuitState'

const getters: GetterTree<CircuitState, RootState> = {
  isIntroDone: (state) => state.isIntroDone,
  isChatStarted: (state: CircuitState) => state.isChatStarted,
  getThreads: (state: CircuitState) => state.threads,
  getCurrentThreadId: (state: CircuitState) => state.currentThreadId,
  getMessages: (state: CircuitState) => state.messages
}

export default getters;
