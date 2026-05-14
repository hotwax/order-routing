import { defineStore } from 'pinia';
import { CircuitStorageService, ChatThread, ChatMessage, DraftFeedbackRecord } from '@/services/CircuitStorageService';
import CircuitLLMService from '@/services/CircuitLLMService';
import { translate } from '@common';

export interface CircuitState {
  isIntroDone: boolean;
  isChatStarted: boolean;
  threads: ChatThread[];
  currentThreadId: string | null;
  messages: any[];
  modelInfo: {
    name: string;
    size: string;
    status: 'not_installed' | 'installing' | 'installed' | 'unsupported';
    progress: number;
    supportError?: string;
    progressText?: string;
  };
  gpuInfo: {
    vendor: string;
    maxStorageBufferBindingSize: string;
  };
  activeContext: any | null;
  lastPrompt: any[] | null;
}

export const useCircuitStore = defineStore('circuit', {
  state: (): CircuitState => ({
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
  }),
  getters: {
    getThreads: (state) => state.threads,
    getCurrentThreadId: (state) => state.currentThreadId,
    getMessages: (state) => state.messages,
    getLastPrompt: (state) => state.lastPrompt
  },
  actions: {
    setIntroDone(payload: boolean) {
      this.isIntroDone = payload;
    },
    setChatStarted(payload: boolean) {
      this.isChatStarted = payload;
    },
    resetCircuit() {
      this.isIntroDone = false;
      this.isChatStarted = false;
      this.currentThreadId = null;
      this.messages = [];
      this.activeContext = null;
    },
    async clearCurrentChatHistory() {
      if (this.currentThreadId) {
        await CircuitStorageService.deleteMessages(this.currentThreadId);
      }
      this.messages = [];
      this.lastPrompt = null;
    },
    async loadAllThreads() {
      try {
        const threads = await CircuitStorageService.getThreads();
        this.threads = threads;
        
        if (threads.length > 0 && !this.currentThreadId) {
          const mostRecent = threads.reduce((prev, current) => (prev.createdAt > current.createdAt) ? prev : current);
          this.switchThread(mostRecent.id);
        } else if (this.currentThreadId) {
          const messages = await CircuitStorageService.getMessages(this.currentThreadId);
          this.messages = messages;
        }
      } catch (error) {
        console.error('Failed to load threads', error);
      }
    },
    async createThread(name = 'New Chat'): Promise<string | undefined> {
      const thread: ChatThread = {
        id: Date.now().toString(),
        name,
        createdAt: Date.now()
      };
      try {
        await CircuitStorageService.saveThread(thread);
        await this.switchThread(thread.id);
        await this.loadAllThreads();
        return thread.id;
      } catch (error) {
        console.error('Failed to create thread', error);
      }
    },
    async switchThread(threadId: string | null) {
      this.currentThreadId = threadId;
      this.activeContext = null;
      if (!threadId) {
        this.messages = [];
        return;
      }
      try {
        const messages = await CircuitStorageService.getMessages(threadId);
        this.messages = messages;
      } catch (error) {
        console.error('Failed to load messages', error);
      }
    },
    async deleteThread(threadId: string) {
      try {
        await CircuitStorageService.deleteThread(threadId);
        if (this.currentThreadId === threadId) {
          this.currentThreadId = null;
          this.messages = [];
          this.isChatStarted = false;
        }
        this.loadAllThreads();
      } catch (error) {
        console.error('Failed to delete thread', error);
      }
    },
    async addLocalMessage(payload: { role: 'user' | 'circuit'; content: string; threadName?: string }) {
      this.isChatStarted = true;

      let threadId: string | null | undefined = this.currentThreadId;
      if (!threadId) {
        threadId = await this.createThread(payload.threadName || payload.content.substring(0, 30) || 'New Chat');
        if (!threadId) {
          return;
        }
      }

      const message: ChatMessage = {
        role: payload.role,
        content: payload.content,
        id: `${Date.now()}-${payload.role}-${Math.random().toString(36).slice(2, 8)}`,
        threadId,
        createdAt: Date.now()
      };

      await CircuitStorageService.saveMessage(message);
      if (this.currentThreadId === threadId) {
        this.messages.push(message);
      }
    },
    async saveDraftFeedback(payload: {
      type: DraftFeedbackRecord['type'];
      userFeedback: string;
      proposal: {
        sourcePrompt: string;
        summary: string;
        operations: any[];
        unansweredQuestions: string[];
      }
    }) {
      if (!this.currentThreadId) {
        return;
      }

      const record: DraftFeedbackRecord = {
        id: `${Date.now()}-feedback-${Math.random().toString(36).slice(2, 8)}`,
        threadId: this.currentThreadId,
        type: payload.type,
        userFeedback: payload.userFeedback,
        sourcePrompt: payload.proposal.sourcePrompt,
        proposalSummary: payload.proposal.summary,
        operations: payload.proposal.operations || [],
        unansweredQuestions: payload.proposal.unansweredQuestions || [],
        createdAt: Date.now()
      };

      try {
        await CircuitStorageService.saveDraftFeedback(record);
      } catch (error) {
        console.error('Failed to save draft feedback', error);
      }
    },
    async sendAgentMessage(payload: string) {
      this.isChatStarted = true;
      
      let threadId: string | null | undefined = this.currentThreadId;

      if (!threadId) {
        threadId = await this.createThread(payload.substring(0, 30) || 'New Chat');
        if (!threadId) {
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
        this.messages.push(userMessage);

        const modelStatus = this.modelInfo.status;
        if (modelStatus === 'installed') {
          let fullResponse = "";
          try {
            const history = this.messages
              .map(msg => ({
                role: (msg.role === 'circuit' ? 'assistant' : 'user') as "assistant" | "user",
                content: msg.content
              }));
            
            let systemContent = "You are Circuit, an AI assistant for HotWax Commerce. You help users manage routing rules and orders.";

            if (this.activeContext) {
              systemContent += `\n\nThe following is the JSON context for the routing group "${this.activeContext.routingName}":\n${JSON.stringify(this.activeContext, null, 2)}`;
            }

            const systemPrompt = {
              role: 'system' as const,
              content: systemContent
            };
            
            const assistantMessage: ChatMessage = {
              role: 'circuit',
              content: '',
              id: (Date.now() + 1).toString(),
              threadId: threadId!,
              createdAt: Date.now()
            };
            this.messages.push(assistantMessage);
            
            const messages = [systemPrompt, ...history];

            this.lastPrompt = messages;

            await CircuitLLMService.generateResponse(
              messages,
              (chunk: string) => {
                if (this.currentThreadId === threadId) {
                  if (this.messages.length > 0) {
                    const lastMessage = this.messages[this.messages.length - 1];
                    this.messages.splice(this.messages.length - 1, 1, {
                      ...lastMessage,
                      content: lastMessage.content + chunk
                    });
                  }
                }
                fullResponse += chunk;
              }
            );

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
            if (this.currentThreadId === threadId) {
              this.messages.push(errorMessage);
            }
          }
        } else {
          const statusMessage: ChatMessage = {
            role: 'circuit',
            content: this.modelInfo.status === 'installing' 
              ? "I'm still preparing my local knowledge. Please wait a moment until the model is fully installed."
              : "I need to be installed before I can help you. Please head to the Settings tab to install the local model.",
            id: (Date.now() + 1).toString(),
            threadId: threadId!,
            createdAt: Date.now()
          };
          await CircuitStorageService.saveMessage(statusMessage);
          if (this.currentThreadId === threadId) {
            this.messages.push(statusMessage);
          }
        }
      } catch (error) {
        console.error('Failed to save message', error);
      }
    },
    async checkWebGPUSupport() {
      const { supported, error } = await CircuitLLMService.isWebGPUSupported();
      const modelInfo = CircuitLLMService.getModelInfo();

      if (!supported) {
        this.modelInfo = {
          ...modelInfo,
          status: 'unsupported',
          supportError: error,
          progress: 0
        };
      } else {
        const wasInstalled = localStorage.getItem('circuit_model_installed') === 'true';
        
        const gpuInfo = await CircuitLLMService.getGPUInfo();
        this.gpuInfo = gpuInfo;

        if (this.modelInfo.status !== 'installed' && this.modelInfo.status !== 'installing') {
          this.modelInfo = {
            ...modelInfo,
            status: 'not_installed',
            progress: 0
          };

          if (wasInstalled) {
            this.initLLM();
          }
        }
      }
    },
    async initLLM() {
      const modelInfo = CircuitLLMService.getModelInfo();

      if (this.modelInfo.status === 'installed' || this.modelInfo.status === 'installing') {
        return;
      }

      this.modelInfo = {
        ...modelInfo,
        status: 'installing',
        progress: 0
      };

      try {
        await CircuitLLMService.initEngine((progress: any) => {
          this.modelInfo = {
            ...modelInfo,
            status: 'installing',
            progress: progress.progress || 0,
            progressText: progress.text
          };
        });

        this.modelInfo = {
          ...modelInfo,
          status: 'installed',
          progress: 1,
          progressText: translate('Model ready')
        };
        localStorage.setItem('circuit_model_installed', 'true');

        const gpuInfo = await CircuitLLMService.getGPUInfo();
        this.gpuInfo = gpuInfo;
      } catch (error) {
        console.error('Failed to initialize WebLLM engine', error);
        localStorage.removeItem('circuit_model_installed');
        this.modelInfo = {
          ...modelInfo,
          status: 'not_installed',
          progress: 0,
          supportError: (error as Error).message
        };
      }
    },
    async unloadLLM() {
      try {
        await CircuitLLMService.unloadEngine();
        const modelInfo = CircuitLLMService.getModelInfo();
        this.modelInfo = {
          ...modelInfo,
          status: 'not_installed',
          progress: 0
        };
      } catch (error) {
        console.error('Failed to unload WebLLM engine', error);
      }
    },
    setActiveContext(payload: any) {
      this.activeContext = payload;
    }
  },
  persist: true
});
