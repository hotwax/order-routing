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
    threads: [],
    currentThreadId: null,
    messages: [],
    modelInfo: {
      name: '',
      size: '',
      status: 'not_installed',
      progress: 0
    },
    gpuInfo: {
      vendor: 'Unknown',
      maxStorageBufferBindingSize: '0 MB'
    },
    activeContext: null,
    lastPrompt: null
  },
  getters,
  actions,
  mutations,
}

export default circuitModule;
