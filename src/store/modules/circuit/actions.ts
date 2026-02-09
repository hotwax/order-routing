import { ActionTree } from 'vuex'
import RootState from '@/store/RootState'
import CircuitState from './CircuitState'
import * as types from './mutation-types'
import { ChatMessage } from '@/services/CircuitStorageService'
import CircuitLLMService from '@/services/CircuitLLMService';
import MastraService from '@/services/MastraService';
import { translate } from '@/i18n';
import store from '@/store'
import { showToast } from '@/utils'

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
    commit(types.SET_CURRENT_THREAD_ID, null)
    commit(types.SET_MESSAGES, [])
    commit(types.SET_ACTIVE_CONTEXT, null)
  },
  async loadAllThreads({ commit, state, dispatch }) {
    try {
      const userProfile = store.getters['user/getUserProfile'];
      const resourceId = `order-routing-agent-${userProfile.partyId}`;
      const threads = await MastraService.getThreads(resourceId);
      commit(types.SET_THREADS, threads);
      
      // If no current thread is selected, select the most recent one
      if (threads.length > 0 && !state.currentThreadId) {
        // Find most recent thread based on id (timestamp) or createdAt
        const mostRecent = threads.reduce((prev, current) => (prev.createdAt > current.createdAt) ? prev : current);
        dispatch('switchThread', mostRecent.id);
      } else if (state.currentThreadId) {
        // If there is already a current thread ID (e.g., from persistence), load its messages
        const mastraMessages = await MastraService.getMessages(state.currentThreadId);
        const messages: any = mastraMessages?.map((msg: any) => ({
          id: msg.id,
          role: msg.role === 'assistant' ? 'circuit' : msg.role, 
          content: msg.content.content,
          threadId: msg.threadId,
          createdAt: new Date(msg.createdAt).getTime()
        }));
        commit(types.SET_MESSAGES, messages);
      }
    } catch (error) {
      console.error('Failed to load threads', error);
    }
  },
  async createThread({ commit, dispatch }, name = 'New Chat'): Promise<string | undefined> {
    try {
      const { id } = await MastraService.createThread();
      if (!id) {
        throw 'Failed to create thread';
      }
      console.log('Thread saved, switching to new thread:', id);
      await dispatch('switchThread', id);
      await dispatch('loadAllThreads');
      return id;
    } catch (error) {
      console.error('Failed to create thread', error);
      showToast('Failed to create new Chat.')
    }
  },
  async switchThread({ commit }, threadId: string | null) {
    commit(types.SET_CURRENT_THREAD_ID, threadId);
    commit(types.SET_MESSAGES, null);
    if (!threadId) {
      commit(types.SET_MESSAGES, []);
      return;
    }
    try {
      // Map Mastra messages to ChatMessage
      const mastraMessages = await MastraService.getMessages(threadId);
      const messages: any = mastraMessages?.map((msg: any) => ({
        id: msg.id,
        role: msg.role === 'assistant' ? 'circuit' : msg.role, 
        content: msg.content.content,
        threadId: msg.threadId,
        createdAt: new Date(msg.createdAt).getTime()
      }));
      commit(types.SET_MESSAGES, messages);
    } catch (error) {
      console.error('Failed to load messages', error);
    }
  },
  async deleteThread({ dispatch, state, commit }, threadId: string) {
    try {
      await MastraService.deleteThread(threadId);
      if (state.currentThreadId === threadId) {
        commit(types.SET_CURRENT_THREAD_ID, null);
        commit(types.SET_MESSAGES, []);
        commit(types.SET_CHAT_STARTED, false);
      }
      dispatch('loadAllThreads');
    } catch (error) {
      console.error('Failed to delete thread', error);
    }
  },
  async sendAgentMessage({ commit, state, dispatch }, payload: any) {
    console.log('sendAgentMessage action called with payload:', payload);
    commit(types.SET_CHAT_STARTED, true)
    
    let threadId = state.currentThreadId;
    console.log('Current threadId:', threadId);

    // If no thread exists, create one and wait for it
    if (!threadId) {
      console.log('No threadId found, creating new thread...');
      threadId = await dispatch('createThread', payload.message.substring(0, 30) || 'New Chat');
      console.log('New thread created with ID:', threadId);
      if (!threadId) {
        console.error('Failed to resolve threadId');
        return;
      }
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: payload.message,
      id: Date.now().toString(),
      threadId: threadId!,
      createdAt: Date.now()
    }
    
    try {
      commit(types.ADD_MESSAGE, userMessage);

        try {
          // Create an initial empty message for the assistant
        const assistantMessage: ChatMessage = {
          role: 'circuit',
          content: '',
          id: (Date.now() + 1).toString(),
          threadId: threadId!,
          createdAt: Date.now()
        };
        // Generate response using Mastra API
        const agentResponse = await MastraService.askRoutingAgent(payload.message, threadId, payload.context);
        const responseText = agentResponse.text || JSON.stringify(agentResponse);

        assistantMessage.content = responseText;
        commit(types.ADD_MESSAGE, assistantMessage);

      } catch (error) {
          console.error('Failed to generate response from Mastra API', error);
          const errorMessage: ChatMessage = {
            role: 'circuit',
            content: "Sorry, I encountered an error generating a response.",
            id: (Date.now() + 1).toString(),
            threadId: threadId!,
            createdAt: Date.now()
          }
          if (state.currentThreadId === threadId) {
            commit(types.ADD_MESSAGE, errorMessage);
          }
        }
    } catch (error) {
      console.error('Failed to save message', error);
    }
  },
  async checkWebGPUSupport({ commit, dispatch, state }) {
    const { supported, error } = await CircuitLLMService.isWebGPUSupported();
    const modelInfo = CircuitLLMService.getModelInfo();

    if (!supported) {
      commit(types.SET_MODEL_INFO, {
        ...modelInfo,
        status: 'unsupported',
        supportError: error
      });
    } else {
      // Check if previously installed
      const wasInstalled = localStorage.getItem('circuit_model_installed') === 'true';
      
      // Fetch GPU info
      const gpuInfo = await CircuitLLMService.getGPUInfo();
      commit(types.SET_GPU_INFO, gpuInfo);

      console.log(`checkWebGPUSupport: wasInstalled=${wasInstalled}, currentStatus=${state.modelInfo.status}`);
      // Only reset status if not already installed or installing
      if (state.modelInfo.status !== 'installed' && state.modelInfo.status !== 'installing') {
        console.log('Setting status to not_installed and triggering initLLM if wasInstalled');
        commit(types.SET_MODEL_INFO, {
          ...modelInfo,
          status: 'not_installed',
          progress: 0
        });

        if (wasInstalled) {
          dispatch('initLLM');
        }
      }
    }
  },
  async initLLM({ commit, state }) {
    const modelInfo = CircuitLLMService.getModelInfo();

    // Prevent re-initialization if already installed or installing
    if (state.modelInfo.status === 'installed' || state.modelInfo.status === 'installing') {
      console.log(`initLLM: early return as status is ${state.modelInfo.status}`);
      return;
    }

    console.log('initLLM: starting initialization');
    commit(types.SET_MODEL_INFO, {
      ...modelInfo,
      status: 'installing',
      progress: 0
    });

    try {
      await CircuitLLMService.initEngine((progress: any) => {
        // progress object from web-llm: { progress: number, text: string }
        // We only care about the progress number for the bar
        // progress.progress is a value between 0 and 1
        commit(types.SET_MODEL_INFO, {
          ...modelInfo,
          status: 'installing',
          progress: progress.progress || 0,
          progressText: progress.text
        });
      });

      commit(types.SET_MODEL_INFO, {
        ...modelInfo,
        status: 'installed',
        progress: 1,
        progressText: translate('Model ready')
      });
      localStorage.setItem('circuit_model_installed', 'true');
      console.log('initLLM: successfully initialized');

      // Update GPU info as vendor is now available from engine
      const gpuInfo = await CircuitLLMService.getGPUInfo();
      commit(types.SET_GPU_INFO, gpuInfo);
    } catch (error) {
      console.error('Failed to initialize WebLLM engine', error);
      localStorage.removeItem('circuit_model_installed');
      commit(types.SET_MODEL_INFO, {
        ...modelInfo,
        status: 'not_installed', // Reset to allow retry
        progress: 0,
        supportError: (error as Error).message
      });
    }
  },
  async unloadLLM({ commit, state }) {
    console.log('unloadLLM: starting disposal');
    try {
      await CircuitLLMService.unloadEngine();
      const modelInfo = CircuitLLMService.getModelInfo();
      commit(types.SET_MODEL_INFO, {
        ...modelInfo,
        status: 'not_installed',
        progress: 0
      });
      // Optional: keep circuit_model_installed in localStorage 
      // as it only means the files are in cache, not that it's in RAM.
      console.log('unloadLLM: successfully disposed');
    } catch (error) {
      console.error('Failed to unload WebLLM engine', error);
    }
  }
}

export default actions;
