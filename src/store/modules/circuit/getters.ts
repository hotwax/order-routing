import { GetterTree } from 'vuex'
import RootState from '@/store/RootState'
import CircuitState from './CircuitState'

const getters: GetterTree<CircuitState, RootState> = {
  isIntroDone: (state) => state.isIntroDone,
  isChatStarted: (state) => state.isChatStarted,
  getThreads: (state) => state.threads
}

export default getters;
