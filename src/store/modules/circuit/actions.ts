import { ActionTree } from 'vuex'
import RootState from '@/store/RootState'
import CircuitState from './CircuitState'
import * as types from './mutation-types'
import { CircuitStorageService, ChatThread, ChatMessage } from '@/services/CircuitStorageService'
import CircuitLLMService from '@/services/CircuitLLMService';
import { translate } from '@/i18n';

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
      const threads = await CircuitStorageService.getThreads();
      commit(types.SET_THREADS, threads);
      
      // If no current thread is selected, select the most recent one
      if (threads.length > 0 && !state.currentThreadId) {
        // Find most recent thread based on id (timestamp) or createdAt
        const mostRecent = threads.reduce((prev, current) => (prev.createdAt > current.createdAt) ? prev : current);
        dispatch('switchThread', mostRecent.id);
      } else if (state.currentThreadId) {
        // If there is already a current thread ID (e.g., from persistence), load its messages
        const messages = await CircuitStorageService.getMessages(state.currentThreadId);
        commit(types.SET_MESSAGES, messages);
      }
    } catch (error) {
      console.error('Failed to load threads', error);
    }
  },
  async createThread({ commit, dispatch }, name = 'New Chat'): Promise<string | undefined> {
    const thread: ChatThread = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now()
    };
    try {
      console.log('Saving thread to IndexedDB:', thread);
      await CircuitStorageService.saveThread(thread);
      console.log('Thread saved, switching to new thread:', thread.id);
      await dispatch('switchThread', thread.id);
      await dispatch('loadAllThreads');
      return thread.id;
    } catch (error) {
      console.error('Failed to create thread', error);
    }
  },
  async switchThread({ commit }, threadId: string | null) {
    commit(types.SET_CURRENT_THREAD_ID, threadId);
    commit(types.SET_ACTIVE_CONTEXT, null);
    if (!threadId) {
      commit(types.SET_MESSAGES, []);
      return;
    }
    try {
      const messages = await CircuitStorageService.getMessages(threadId);
      commit(types.SET_MESSAGES, messages);
    } catch (error) {
      console.error('Failed to load messages', error);
    }
  },
  async deleteThread({ dispatch, state, commit }, threadId: string) {
    try {
      await CircuitStorageService.deleteThread(threadId);
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
  async sendAgentMessage({ commit, state, dispatch }, payload: string) {
    console.log('sendAgentMessage action called with payload:', payload);
    commit(types.SET_CHAT_STARTED, true)
    
    let threadId = state.currentThreadId;
    console.log('Current threadId:', threadId);

    // If no thread exists, create one and wait for it
    if (!threadId) {
      console.log('No threadId found, creating new thread...');
      threadId = await dispatch('createThread', payload.substring(0, 30) || 'New Chat');
      console.log('New thread created with ID:', threadId);
      if (!threadId) {
        console.error('Failed to resolve threadId');
        return;
      }
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: payload,
      id: Date.now().toString(),
      threadId: threadId!,
      createdAt: Date.now()
    }
    
    try {
      await CircuitStorageService.saveMessage(userMessage);
      commit(types.ADD_MESSAGE, userMessage);

      // Check if local LLM is available
      const modelStatus = state.modelInfo.status;
      console.log(`Checking model status in sendAgentMessage: ${modelStatus}`);
      if (modelStatus === 'installed') {
        let fullResponse = "";
        try {
          // Prepare chat history
          const history = state.messages
            .map(msg => ({
              role: (msg.role === 'circuit' ? 'assistant' : 'user') as "assistant" | "user",
              content: msg.content
            }));
          
          // Simple system prompt
        let systemContent = "You are Circuit, an AI assistant for HotWax Commerce. You help users manage routing rules and orders.";

        // If activeContext is present, append its data to the system prompt
        if (state.activeContext) {
          systemContent += `\n\nThe following is the JSON context for the routing group "${state.activeContext.routingName}":\n${JSON.stringify(state.activeContext, null, 2)}`;
        }

        const systemPrompt = {
          role: 'system' as const,
          content: systemContent
        };
        
        // Create an initial empty message for the assistant
        const assistantMessage: ChatMessage = {
          role: 'circuit',
          content: '',
          id: (Date.now() + 1).toString(),
          threadId: threadId!,
          createdAt: Date.now()
        };
        commit(types.ADD_MESSAGE, assistantMessage);
        
        const messages = [systemPrompt, ...history];

        commit(types.SET_LAST_PROMPT, messages);

        const result = await CircuitLLMService.generateResponse(
          messages,
          (chunk: string) => {
            if (state.currentThreadId === threadId) {
              commit(types.UPDATE_LAST_MESSAGE, chunk);
            }
            fullResponse += chunk;
          }
        );

        // Update the full response in IndexedDB
        try {
           await CircuitStorageService.saveMessage({ ...assistantMessage, content: fullResponse });
        } catch (error) {
           console.error('Failed to save assistant message', error);
        }

      } catch (error) {
           console.error('Failed to generate response from local LLM', error);
           
           const errorMessage: ChatMessage = {
             role: 'circuit',
             content: "Sorry, I encountered an error generating a response locally.",
             id: (Date.now() + 1).toString(),
             threadId: threadId!,
             createdAt: Date.now()
           }
           await CircuitStorageService.saveMessage(errorMessage);
           if (state.currentThreadId === threadId) {
             commit(types.ADD_MESSAGE, errorMessage);
           }
         }
      } else {
        // Model not installed or not ready
        const statusMessage: ChatMessage = {
          role: 'circuit',
          content: state.modelInfo.status === 'installing' 
            ? "I'm still preparing my local knowledge. Please wait a moment until the model is fully installed."
            : "I need to be installed before I can help you. Please head to the Settings tab to install the local model.",
          id: (Date.now() + 1).toString(),
          threadId: threadId!,
          createdAt: Date.now()
        };
        await CircuitStorageService.saveMessage(statusMessage);
        if (state.currentThreadId === threadId) {
          commit(types.ADD_MESSAGE, statusMessage);
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
