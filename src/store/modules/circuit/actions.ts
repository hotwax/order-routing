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
  async switchThread({ commit }, threadId: string) {
    commit(types.SET_CURRENT_THREAD_ID, threadId);
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
  async sendMessage({ commit, state, dispatch }, payload: string) {
    console.log('sendMessage action called with payload:', payload);
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
      if (state.modelInfo.status === 'installed') {
        try {
          // Prepare chat history
          const history = state.messages.map(msg => ({
            role: (msg.role === 'circuit' ? 'assistant' : 'user') as "assistant" | "user",
            content: msg.content
          }));

          // Add system prompt
          const systemPrompt = {
            role: 'system' as const,
            content: "You are Circuit, an AI assistant for HotWax Commerce. You help users manage routing rules and orders."
          };
          
          // Create an initial empty message for the assistant
        const assistantMessage: ChatMessage = {
          role: 'circuit',
          content: '', // Start empty
          id: (Date.now() + 1).toString(), // Assign an ID for the message
          threadId: threadId!,
          createdAt: Date.now()
        };
        commit(types.ADD_MESSAGE, assistantMessage);

        // Generate response using local LLM with streaming
        let fullResponse = "";
        await CircuitLLMService.generateResponse(
          [systemPrompt, ...history],
          (chunk: string) => {
            // Only commit if we are still on the same thread
            if (state.currentThreadId === threadId) {
              commit(types.UPDATE_LAST_MESSAGE, chunk);
            }
            fullResponse += chunk;
          }
        );

        // Update the full response in IndexedDB
        try {
          // We can update the last message in DB with the full content
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
        // Fallback simulated response
        setTimeout(async () => {
          const circuitMessage: ChatMessage = {
            role: 'circuit',
            content: `I've received your prompt: "${payload}". For now, I'm returning this default response while we work on the chat experience.`,
            id: (Date.now() + 1).toString(),
            threadId: threadId!,
            createdAt: Date.now()
          }
          await CircuitStorageService.saveMessage(circuitMessage);
          
          // Only commit if we are still on the same thread
          if (state.currentThreadId === threadId) {
            commit(types.ADD_MESSAGE, circuitMessage);
          }
        }, 1500)
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
      
      // Only reset status if not already installed or installing
      if (state.modelInfo.status !== 'installed' && state.modelInfo.status !== 'installing') {
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
      return;
    }

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
  }
}

export default actions;
