<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Circuit") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="resetCircuit">
            <ion-icon slot="icon-only" :icon="refreshOutline" />
          </ion-button>
          <ion-button v-if="isChatStarted" @click="createNewChat">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
          <ion-button v-if="messages.length" :disabled="isApplyingDraft" :aria-label="translate('Clear chat history')" @click="clearCurrentChatHistory">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
          <ion-button @click="showPromptModal = true">
            <ion-icon slot="icon-only" :icon="terminalOutline" />
          </ion-button>
          <ion-button
            v-if="canSendFeedback"
            :aria-label="translate('Send feedback to improve Circuit')"
            @click="showFeedbackModal = true"
          >
            <ion-icon slot="icon-only" :icon="bulbOutline" />
          </ion-button>
          <ion-button @click="openThreadModal">
            <ion-icon slot="start" :icon="chatbubblesOutline" />
            {{ translate("Threads") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Thread Selection List (Visible when menu is toggled) -->
    </ion-header>

    <ion-content>
      <div class="chat-canvas-container">
        <!-- Chat Section -->
        <div class="chat-section">
          <ion-list class="chat-history">
            <template v-for="message in messages" :key="message.id">
              <ion-item lines="none" :class="message.role === 'user' ? 'prompt-item' : 'response-item'">
                <ion-label>
                  <p class="role-label">{{ message.role === 'user' ? translate('User') : translate('Circuit') }}</p>
                  <p class="message-content">{{ message.content }}</p>
                </ion-label>
              </ion-item>
            </template>
          </ion-list>

          <CircuitPromptArea 
            v-model="prompt" 
            :selectedContext="selectedContext"
            :disabled="isApplyingDraft"
            @send="onSend" 
            @add-context="addContext" 
            @remove-context="removeContext"
          />
          <ion-item v-if="pendingDraftProposal" lines="none">
            <ion-button :disabled="isApplyingDraft" @click="approvePendingProposal">
              <ion-icon slot="start" :icon="checkmarkCircleOutline" />
              {{ translate("Apply") }}
            </ion-button>
            <ion-button :disabled="isApplyingDraft" fill="clear" @click="discardPendingProposal">
              <ion-icon slot="start" :icon="closeCircleOutline" />
              {{ translate("Discard") }}
            </ion-button>
          </ion-item>
        </div>

        <!-- Divider -->
        <div class="divider"></div>

        <!-- Canvas Section -->
        <div class="canvas-section">
          <CircuitCanvas ref="circuitCanvasRef" :routingGroupId="routingGroupId" />
        </div>
      </div>
    </ion-content>

    <ion-modal :is-open="showPromptModal" @didDismiss="showPromptModal = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ translate("Last Prompt Sent") }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showPromptModal = false">{{ translate("Close") }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <template v-if="lastPrompt">
          <pre class="prompt-json">{{ JSON.stringify(lastPrompt, null, 2) }}</pre>
        </template>
        <div v-else class="ion-text-center ion-padding">
          <p color="medium">{{ translate("No prompt sent yet in this session.") }}</p>
        </div>
      </ion-content>
    </ion-modal>

    <ion-modal :is-open="showThreadMenu" @didDismiss="showThreadMenu = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ translate("Chat Threads") }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showThreadMenu = false">{{ translate("Close") }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-item button v-for="thread in threads" :key="thread.id" @click="selectThread(thread.id)" :detail="false" :class="{ 'selected-thread': thread.id === currentThreadId }">
            <ion-label>
              <h3>{{ thread.name }}</h3>
              <p>{{ formatDate(thread.createdAt) }}</p>
            </ion-label>
            <ion-button slot="end" fill="clear" color="danger" @click.stop="confirmDelete(thread.id)">
              <ion-icon slot="icon-only" :icon="trashOutline" />
            </ion-button>
          </ion-item>
          <ion-item v-if="threads.length === 0">
            <ion-label color="medium">{{ translate("No threads found") }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-modal>
    <CircuitFeedbackModal
      :is-open="showFeedbackModal"
      :messages="buildFeedbackMessages()"
      :context="feedbackContext"
      @dismiss="showFeedbackModal = false"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { 
  IonButton, 
  IonButtons, 
  IonContent, 
  IonHeader, 
  IonIcon, 
  IonItem, 
  IonLabel, 
  IonList, 
  IonModal,
  IonPage, 
  IonTitle, 
  IonToolbar 
} from '@ionic/vue';
import CircuitPromptArea from '@/components/circuit/CircuitPromptArea.vue';
import CircuitCanvas from '@/components/circuit/CircuitCanvas.vue';
import CircuitFeedbackModal from '@/components/circuit/CircuitFeedbackModal.vue';
import RoutingRuleSelectionModal from '@/components/circuit/RoutingRuleSelectionModal.vue';
import type { KnowledgeFeedbackMessage } from '@/services/CircuitKnowledgeFeedbackService';
import {
  addOutline,
  bulbOutline,
  chatbubblesOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  refreshOutline,
  terminalOutline,
  trashOutline
} from 'ionicons/icons';
import { translate } from '@common';
import { ref, computed, onMounted } from 'vue';
import { useCircuitStore } from '@/store/circuit';
import { storeToRefs } from 'pinia';
import { DateTime } from 'luxon';
import { modalController } from '@ionic/vue';
import { DraftConversationMessage, DraftProposal } from '@/services/DraftAssistantService';
import {
  buildDiscardFeedbackPrompt,
  buildFeedbackRevisionMessage,
  buildFeedbackRevisionPrompt,
  buildFeedbackSavedMessage,
  DraftFeedbackType
} from '@/util/circuitFeedback';

const circuitStore = useCircuitStore();
const { 
  messages, 
  threads, 
  currentThreadId, 
  lastPrompt, 
  activeContext: selectedContext,
  isChatStarted
} = storeToRefs(circuitStore);
const prompt = ref('');
const isApplyingDraft = ref(false);
type CircuitDraftProposal = DraftProposal & {
  id: string;
  sourcePrompt: string;
  createdAt: number;
};

const circuitCanvasRef = ref<{
  prepareCircuitDraftProposal: (prompt: string, conversationHistory?: DraftConversationMessage[]) => Promise<{ proposal: CircuitDraftProposal | null; message: string; intent?: 'edit' | 'inquiry' }>;
  applyCircuitDraftProposal: (proposal: CircuitDraftProposal) => Promise<{ appliedCount: number; message: string }>;
} | null>(null);
const pendingDraftProposal = ref<CircuitDraftProposal | null>(null);
const pendingDiscardFeedbackProposal = ref<CircuitDraftProposal | null>(null);

onMounted(() => {
  circuitStore.loadAllThreads();
});

const routingGroupId = computed(() => selectedContext.value?.routingGroupId || null);
const showThreadMenu = ref(false);
const showPromptModal = ref(false);
const showFeedbackModal = ref(false);

const canSendFeedback = computed(() => messages.value.length > 0);

function buildFeedbackMessages(): KnowledgeFeedbackMessage[] {
  return messages.value
    .map((message: any) => ({
      role: message.role === 'circuit' ? 'assistant' : message.role,
      content: String(message.content || '').trim()
    }))
    .filter((message: { role: string; content: string }) =>
      (message.role === 'user' || message.role === 'assistant') && message.content
    ) as KnowledgeFeedbackMessage[];
}

const feedbackContext = computed(() => ({
  routingGroupId: selectedContext.value?.routingGroupId ?? null,
  routingRuleId: (selectedContext.value as any)?.routingRuleId ?? null,
  activeContextLabel: (selectedContext.value as any)?.label ?? undefined
}));

const onSend = async () => {
  const message = prompt.value.trim();
  if (!message || isApplyingDraft.value) return;

  prompt.value = '';

  isApplyingDraft.value = true;
  await circuitStore.addLocalMessage({
    role: 'user',
    content: message,
    threadName: message.substring(0, 30) || 'New Chat'
  });
  const conversationHistory = buildConversationHistory();

  try {
    if (pendingDiscardFeedbackProposal.value) {
      const proposal = pendingDiscardFeedbackProposal.value;
      pendingDiscardFeedbackProposal.value = null;
      await saveDraftFeedbackForProposal('rejected', message, proposal);
      await reviseDiscardedProposal(proposal, message, conversationHistory);
      return;
    }

    if (selectedContext.value && circuitCanvasRef.value) {
      if (pendingDraftProposal.value) {
        if (isApprovalMessage(message)) {
          await applyPendingDraftProposal(message);
          return;
        }

        const currentProposal = pendingDraftProposal.value;
        const result = await circuitCanvasRef.value.prepareCircuitDraftProposal(message, conversationHistory);
        if (result.intent !== 'inquiry') {
          await saveDraftFeedbackForProposal('revision_requested', message, currentProposal);
          pendingDraftProposal.value = result.proposal;
        }
        await addCircuitMessage(result.message);
        return;
      }

      const result = await circuitCanvasRef.value.prepareCircuitDraftProposal(message, conversationHistory);
      pendingDraftProposal.value = result.proposal;
      await addCircuitMessage(result.message);
      return;
    }

    await addCircuitMessage(translate("Select a routing context before asking Circuit to draft changes."));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : translate('Failed to apply draft changes');
    await addCircuitMessage(errorMessage);
  } finally {
    isApplyingDraft.value = false;
  }
}

const approvePendingProposal = async () => {
  if (!pendingDraftProposal.value || isApplyingDraft.value) return;

  isApplyingDraft.value = true;
  try {
    await circuitStore.addLocalMessage({
      role: 'user',
      content: translate("Apply proposal"),
      threadName: translate("Apply proposal")
    });
    await applyPendingDraftProposal(translate("Apply proposal"));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : translate('Failed to apply draft changes');
    await addCircuitMessage(errorMessage);
  } finally {
    isApplyingDraft.value = false;
  }
}

const discardPendingProposal = async () => {
  if (!pendingDraftProposal.value || isApplyingDraft.value) return;

  isApplyingDraft.value = true;
  try {
    await circuitStore.addLocalMessage({
      role: 'user',
      content: translate("Discard proposal"),
      threadName: translate("Discard proposal")
    });
    pendingDiscardFeedbackProposal.value = pendingDraftProposal.value;
    await addCircuitMessage(buildDiscardFeedbackPrompt(pendingDraftProposal.value));
    pendingDraftProposal.value = null;
  } finally {
    isApplyingDraft.value = false;
  }
}

async function applyPendingDraftProposal(userFeedback: string) {
  if (!pendingDraftProposal.value || !circuitCanvasRef.value) {
    return;
  }

  const proposal = pendingDraftProposal.value;
  await savePendingDraftFeedback('approved', userFeedback);
  const result = await circuitCanvasRef.value.applyCircuitDraftProposal(proposal);
  pendingDraftProposal.value = null;
  await addCircuitMessage(result.message);
}

async function savePendingDraftFeedback(type: DraftFeedbackType, userFeedback: string) {
  if (!pendingDraftProposal.value) {
    return;
  }

  await saveDraftFeedbackForProposal(type, userFeedback, pendingDraftProposal.value);
}

async function saveDraftFeedbackForProposal(type: DraftFeedbackType, userFeedback: string, proposal: CircuitDraftProposal) {
  await circuitStore.saveDraftFeedback({
    type,
    userFeedback,
    proposal
  });
}

async function reviseDiscardedProposal(proposal: CircuitDraftProposal, feedback: string, conversationHistory: DraftConversationMessage[]) {
  if (!selectedContext.value || !circuitCanvasRef.value) {
    await addCircuitMessage(buildFeedbackSavedMessage());
    return;
  }

  const revisionPrompt = buildFeedbackRevisionPrompt(proposal.sourcePrompt, feedback, proposal);
  const result = await circuitCanvasRef.value.prepareCircuitDraftProposal(revisionPrompt, conversationHistory);
  if (result.proposal) {
    result.proposal.sourcePrompt = proposal.sourcePrompt;
  }

  pendingDraftProposal.value = result.proposal;
  await addCircuitMessage(buildFeedbackRevisionMessage(result.message, Boolean(result.proposal)));
}

async function addCircuitMessage(content: string) {
  await circuitStore.addLocalMessage({
    role: 'circuit',
    content
  });
}

function isApprovalMessage(message: string) {
  const normalizedMessage = message.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\b(no|not|dont|don t|do not|never)\b.*\b(apply|approve|accept|proceed)\b/.test(normalizedMessage)) {
    return false;
  }

  return [
    "apply",
    "apply proposal",
    "approve",
    "approved",
    "yes",
    "y",
    "accept",
    "proceed",
    "looks good",
    "do it",
    "make it"
  ].includes(normalizedMessage) || /^(apply|approve|accept|proceed)\b/.test(normalizedMessage);
}

const buildConversationHistory = (): DraftConversationMessage[] => {
  return messages.value
    .map((message: any) => ({
      role: message.role === 'circuit' ? 'assistant' : message.role,
      content: String(message.content || '').trim()
    }))
    .filter((message: DraftConversationMessage) => (message.role === 'user' || message.role === 'assistant') && message.content)
    .slice(-12);
}

const addContext = async () => {
  const modal = await modalController.create({
    component: RoutingRuleSelectionModal,
  });
  
  modal.onDidDismiss().then((result) => {
    if (result.data) {
      circuitStore.setActiveContext(result.data);
    }
  });

  return modal.present();
}

const removeContext = () => {
  circuitStore.setActiveContext(null);
}

const resetCircuit = () => {
  circuitStore.resetCircuit();
}

const createNewChat = () => {
  console.log('createNewChat called');
  circuitStore.setChatStarted(false);
  circuitStore.switchThread(null);
}

const clearCurrentChatHistory = () => {
  circuitStore.clearCurrentChatHistory();
}

const openThreadModal = () => {
  showThreadMenu.value = true;
}

const selectThread = (threadId: string) => {
  circuitStore.switchThread(threadId);
  showThreadMenu.value = false;
}

const confirmDelete = (threadId: string) => {
  // Simple delete for now
  circuitStore.deleteThread(threadId);
}

const formatDate = (timestamp: number) => {
  return DateTime.fromMillis(timestamp).toRelative();
}

</script>

<style scoped>
.chat-canvas-container {
  display: flex;
  height: 100%;
}

.chat-section {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ion-color-step-150, rgba(0,0,0,0.12));
}

.chat-history {
  flex: 1;
  overflow-y: auto;
}

.role-label {
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 4px;
  color: var(--ion-color-medium);
}

.message-content {
  white-space: pre-wrap;
}

.canvas-section {
  flex: 1;
  overflow: hidden;
  height: 100%;
}

.selected-thread {
  --background: var(--ion-color-step-100);
}

.prompt-json {
  background: var(--ion-color-step-50, #f4f5f8);
  padding: 16px;
  border-radius: 8px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
