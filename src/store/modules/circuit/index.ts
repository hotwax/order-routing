import actions from './actions'
import getters from './getters'
import mutations from './mutations'
import CircuitState from './CircuitState'
import { Module } from 'vuex'
import RootState from '@/store/RootState'

const circuitModule: Module<CircuitState, RootState> = {
  namespaced: true,
  state: {
    isIntroDone: false,
    isChatStarted: false,
    threads: []
  },
  getters,
  actions,
  mutations,
}

export default circuitModule;
