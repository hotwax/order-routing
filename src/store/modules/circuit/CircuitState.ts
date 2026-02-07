export interface ChatThread {
  id: string;
  name: string;
  createdAt: number;
}

export default interface CircuitState {
  isIntroDone: boolean;
  isChatStarted: boolean;
  threads: ChatThread[];
  currentThreadId: string | null;
  messages: any[]; // These will be the messages for the current thread
  modelInfo: {
    name: string;
    size: string;
    status: 'not_installed' | 'installing' | 'installed' | 'unsupported';
    progress: number;
    supportError?: string;
  };
}
