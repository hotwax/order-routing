import { defineStore } from 'pinia';
import { CircuitStorageService } from '@/services/CircuitStorageService';
import type { ChatThread, ChatMessage, DraftFeedbackRecord } from '@/types/circuit';

export interface CircuitState {
  isIntroDone: boolean;
  isChatStarted: boolean;
  threads: ChatThread[];
  currentThreadId: string | null;
  messages: any[];
  activeContext: any | null;
  lastPrompt: any | null;
}

export const useCircuitStore = defineStore('circuit', {
  state: (): CircuitState => ({
    isIntroDone: false,
    isChatStarted: false,
    threads: [],
    currentThreadId: null,
    messages: [],
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

        if (this.currentThreadId) {
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
        await this.switchThread(thread.id, { preserveContext: true });
        await this.loadAllThreads();
        return thread.id;
      } catch (error) {
        console.error('Failed to create thread', error);
      }
    },
    async switchThread(threadId: string | null, options: { preserveContext?: boolean } = {}) {
      this.currentThreadId = threadId;
      if (!options.preserveContext) {
        this.activeContext = null;
      }
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
      // Records the opening user message and starts the chat. The Circuit reply
      // is produced by the Mastra-backed DraftAssistantService from the chat canvas.
      await this.addLocalMessage({
        role: 'user',
        content: payload,
        threadName: payload.substring(0, 30) || 'New Chat'
      });
    },
    setLastPrompt(payload: any) {
      this.lastPrompt = payload;
    },
    setActiveContext(payload: any) {
      this.activeContext = payload;
    }
  },
  persist: true
});
