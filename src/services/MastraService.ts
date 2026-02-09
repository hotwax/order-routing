
import { useAuthStore } from '@hotwax/dxp-components';
import { DateTime } from 'luxon';
import { ChatThread } from './CircuitStorageService';
import store from '../store';

const MASTRA_BASE_URL = process.env.VUE_APP_MASTRA_BASE_URL;
const MASTRA_AGENT_ID = process.env.VUE_APP_MASTRA_AGENT;

export interface MastraMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  text?: string;
  data?: unknown;
}

const buildPrompt = (input: string, context?: Record<string, unknown>) => {
  if (!context || !Object.keys(context).length) return input;
  return `${input}\n\nContext (JSON):\n${JSON.stringify(context)}`;
};

const sanitizeAgentText = (value: string) => {
  let sanitized = value;
  sanitized = sanitized.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  sanitized = sanitized.replace(/<\/?response>/gi, '');
  return sanitized.trim();
};

export const askRoutingAgent = async (
  input: any,
  threadId: string,
  context?: Record<string, unknown>,
  resourceId?: string
): Promise<AgentResponse> => {
  if (!resourceId) {
    resourceId = `order-routing-agent-${store.getters['user/getUserProfile'].partyId}`;
  }
  const response = await fetch(`${MASTRA_BASE_URL}/api/agents/${MASTRA_AGENT_ID}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${useAuthStore().token.value}`,
    },
    body: JSON.stringify({
      messages: [buildPrompt(input, context)],
      requestContext: context || undefined,
      memory: {
        thread: threadId,
        resource: resourceId
      }
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Agent request failed with ${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  if (typeof payload === 'string') return { text: sanitizeAgentText(payload) };
  if (payload?.text && typeof payload.text === 'string') {
    return { ...payload, text: sanitizeAgentText(payload.text) };
  }
  return payload;
};

export const createThread = async (): Promise<any> => {
  // Use store.getters directly if useAuthStore is not providing what we need, 
  // or use the auth store value as requested by user.
  // The user requested: Authorization: `Bearer ${useAuthStore().token.value}`
  // But also used store.getters for partyId. mixing both.
  
  const token = useAuthStore().token.value;
  const userProfile = store.getters['user/getUserProfile'];

  const response = await fetch(`${MASTRA_BASE_URL}/api/memory/threads?agentId=${MASTRA_AGENT_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'New Chat',
      resourceId: `order-routing-agent-${userProfile.partyId}`,
      threadId: `order-routing-agent-${userProfile.partyId}-${DateTime.now().toMillis()}`,
      metadata: {}
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Thread creation failed with ${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  return payload;
};

export const getThreads = async (resourceId: string): Promise<ChatThread[]> => {
  const token = useAuthStore().token.value;
  const response = await fetch(`${MASTRA_BASE_URL}/api/memory/threads?resourceId=${resourceId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to fetch threads with ${response.status}`);
  }

  const payload = await response.json().catch(() => ([]));

  return payload.threads.map((thread: any) => ({
    id: thread.id,
    name: thread.title,
    createdAt: new Date(thread.createdAt).getTime(),
    updatedAt: new Date(thread.updatedAt).getTime()
  }));
};

export const getMessages = async (threadId: string): Promise<any> => {
  const token = useAuthStore().token.value;
  const response = await fetch(`${MASTRA_BASE_URL}/api/memory/threads/${threadId}/messages`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to fetch messages with ${response.status}`);
  }

  const payload = await response.json().catch(() => ([]));
  // Map Mastra messages to our format if needed, but it seems compatible
  return payload.messages;
};

export const deleteThread = async (threadId: string): Promise<void> => {
  const token = useAuthStore().token.value;
  const response = await fetch(`${MASTRA_BASE_URL}/api/memory/threads/${threadId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to delete thread with ${response.status}`);
  }
};

const generateResponse = async (messages: MastraMessage[], threadId?: string): Promise<string> => {
  const token = useAuthStore().token.value;

  const response = await fetch(`${MASTRA_BASE_URL}/api/agents/${MASTRA_AGENT_ID}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages,
      threadId
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    console.error('Mastra API Error:', message);
    throw new Error(message || `Agent request failed with ${response.status}`);
  }

  const payload = await response.json().catch(() => ({}));
  if (typeof payload === 'string') return sanitizeAgentText(payload);
  if (payload?.text && typeof payload.text === 'string') {
    return sanitizeAgentText(payload.text);
  }
  return JSON.stringify(payload);
};

const MastraService = {
  generateResponse,
  askRoutingAgent,
  createThread,
  getThreads,
  getMessages,
  deleteThread
};

export default MastraService;
