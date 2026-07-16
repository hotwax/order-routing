<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/order-routing" />
          <ion-button
            :aria-label="chatVisible ? translate('Hide chat') : translate('Show chat')"
            :color="chatVisible ? 'primary' : 'medium'"
            @click="chatVisible = !chatVisible"
          >
            <ion-icon slot="icon-only" :icon="chatboxEllipsesOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ translate("Order Routing Detail") }}</ion-title>
        <ion-buttons slot="end">
          <!-- Discard the working copy back to the last saved (server) state. Shown only when there
               are unsaved live edits. -->
          <ion-button
            v-if="!activeVariationId && editorDirty"
            color="medium"
            :aria-label="translate('Discard changes')"
            @click="discardEditor"
          >
            <ion-icon slot="icon-only" :icon="arrowUndoOutline" />
          </ion-button>
          <!-- Explicit, on-demand Save for the live routing group. Variations save via the rail, so
               this is hidden while a variation is active. Enabled only when there are unsaved edits. -->
          <ion-button
            v-if="!activeVariationId"
            :disabled="!editorDirty"
            :color="editorDirty ? 'primary' : undefined"
            :aria-label="editorDirty ? translate('Save changes') : translate('No unsaved changes')"
            @click="saveEditor"
          >
            <ion-icon slot="start" :icon="saveOutline" />
            {{ editorDirty ? translate("Save") : translate("Saved") }}
          </ion-button>
          <ion-button v-if="isChatStarted" @click="createNewChat">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
          <ion-button v-if="messages.length" :disabled="isApplyingDraft" :aria-label="translate('Clear chat history')" @click="clearCurrentChatHistory">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
          <ion-button v-if="isDevModeEnabled" @click="showPromptModal = true">
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
        <div v-show="chatVisible" class="chat-section">
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
            :disabled="isApplyingDraft"
            @send="onSend"
          />
          <!-- The proposal is already applied live to the canvas (preview). Accept keeps it in the
               working copy; Reject reverts the canvas to the pre-proposal state. -->
          <ion-item v-if="pendingDraftProposal && !activeVariationId" lines="none">
            <ion-button :disabled="isApplyingDraft" @click="acceptPendingProposal">
              <ion-icon slot="start" :icon="checkmarkCircleOutline" />
              {{ translate("Accept") }}
            </ion-button>
            <ion-button :disabled="isApplyingDraft" fill="clear" @click="rejectPendingProposal">
              <ion-icon slot="start" :icon="closeCircleOutline" />
              {{ translate("Reject") }}
            </ion-button>
          </ion-item>
        </div>

        <!-- Divider -->
        <div v-show="chatVisible" class="divider"></div>

        <!-- Canvas Section: ONE canvas. sandbox=true binds it to the active variation's working copy;
             sandbox=false binds it to the live routing group. Keyed so switching live <-> variation (and
             between variations) remounts the editor for a clean re-bind. -->
        <div class="canvas-section">
          <RoutingGroupEditor
            :key="activeVariationId || 'live'"
            ref="editorRef"
            :routingGroupId="routingGroupId"
            :sandbox="!!activeVariationId"
            @dirty-change="editorDirty = $event"
          />
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
              {{ thread.name }}
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
    <VariationRail :routing-group-id="routingGroupId" />
  </ion-page>
</template>

<script setup lang="ts">
import {
  alertController,
  IonBackButton,
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
import { onBeforeRouteLeave } from 'vue-router';
import CircuitPromptArea from '@/components/circuit/CircuitPromptArea.vue';
import RoutingGroupEditor from '@/components/circuit/RoutingGroupEditor.vue';
import VariationRail from '@/components/simulation/VariationRail.vue';
import { simulationStore } from '@/store/simulationStore';
import CircuitFeedbackModal from '@/components/circuit/CircuitFeedbackModal.vue';
import type { KnowledgeFeedbackMessage } from '@/types/circuit';
import {
  addOutline,
  arrowUndoOutline,
  bulbOutline,
  chatboxEllipsesOutline,
  chatbubblesOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  saveOutline,
  terminalOutline,
  trashOutline
} from 'ionicons/icons';
import { translate } from '@common';
import { ref, computed, onMounted, watch } from 'vue';
import { useCircuitStore } from '@/store/circuit';
import { usePreferencesStore } from '@/store/preferences';
import { storeToRefs } from 'pinia';
import { DateTime } from 'luxon';
import type { DraftConversationMessage, DraftProposal } from '@/types/draft';
import {
  buildDiscardFeedbackPrompt,
  buildFeedbackRevisionMessage,
  buildFeedbackRevisionPrompt,
  buildFeedbackSavedMessage,
  DraftFeedbackType
} from '@/utils/circuitFeedback';

const circuitStore = useCircuitStore();
const preferencesStore = usePreferencesStore();
const isDevModeEnabled = computed(() => preferencesStore.isDevModeEnabled);
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

const editorRef = ref<{
  prepareDraftProposal: (prompt: string, conversationHistory?: DraftConversationMessage[]) => Promise<{ proposal: CircuitDraftProposal | null; message: string; intent?: 'edit' | 'inquiry' }>;
  previewDraftProposal: (proposal: CircuitDraftProposal) => Promise<{ appliedCount: number; message: string }>;
  acceptDraftProposal: () => void;
  rejectDraftProposal: () => void;
  save: () => Promise<boolean>;
  discardChanges: () => void;
} | null>(null);
const pendingDraftProposal = ref<CircuitDraftProposal | null>(null);
const pendingDiscardFeedbackProposal = ref<CircuitDraftProposal | null>(null);

onMounted(() => {
  circuitStore.loadAllThreads();
});

const routingGroupId = computed(() => selectedContext.value?.routingGroupId || null);
// When a simulation variation is active, the single RoutingGroupEditor runs in sandbox mode and edits
// that variation's working copy; otherwise it edits the live routing group. Either way it exposes
// the same draft interface, so the chat's editorRef works unchanged.
const sim = simulationStore();
const activeVariationId = computed(() => sim.activeVariationId);
// Entering (or switching) a variation remounts the editor and drops its proposal snapshot; clear any
// pending host proposal state so a stale Accept/Reject row can't survive the switch (the editor's
// onBeforeUnmount reverts the live working copy). clearPendingProposalState is hoisted (fn decl).
watch(activeVariationId, (id) => { if (id) clearPendingProposalState(); });
const showThreadMenu = ref(false);
const showPromptModal = ref(false);
const showFeedbackModal = ref(false);
// The chat panel can be collapsed to give the editor full width. v-show (not v-if) keeps the
// chat mounted so its thread/messages state survives toggling.
const chatVisible = ref(true);
// Live editor unsaved-changes state, surfaced by RoutingGroupEditor via @dirty-change, powering the
// header Save button. (Variations save through the rail, so the header Save is hidden for them.)
const editorDirty = ref(false);

// A header Save (commit) or Discard (reset-to-baseline) resolves the whole working copy, which
// subsumes any undecided Circuit proposal. Clear the host-owned proposal refs too so the Accept/Reject
// row can't linger and act on a snapshot the editor already dropped.
function clearPendingProposalState() {
  pendingDraftProposal.value = null;
  pendingDiscardFeedbackProposal.value = null;
}

const saveEditor = async () => {
  // Only clear the pending proposal once the commit actually succeeded — on a failed save nothing was
  // committed, so the proposal is still live and the Accept/Reject row must stay.
  const ok = await editorRef.value?.save?.();
  if (ok) clearPendingProposalState();
};

// Discard the live working copy back to the last-saved state (with a confirm).
const discardEditor = async () => {
  const alert = await alertController.create({
    header: translate("Discard changes?"),
    message: translate("This resets the routing group to its last saved version. Unsaved edits will be lost."),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { text: translate("Discard"), role: "destructive", handler: () => { editorRef.value?.discardChanges?.(); clearPendingProposalState(); } }
    ]
  });
  await alert.present();
};

// Unsaved-changes guard: prompt before leaving the detail page while the live working copy is dirty
// (e.g. Back to the list, or opening another group — which would replace the working copy).
onBeforeRouteLeave(async () => {
  if (activeVariationId.value || !editorDirty.value) return true;
  const alert = await alertController.create({
    header: translate("Unsaved changes"),
    message: translate("You have unsaved changes. Leave without saving?"),
    buttons: [
      { text: translate("Stay"), role: "cancel" },
      { text: translate("Leave"), role: "destructive" }
    ]
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  return role === "destructive";
});

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

    // Circuit drafting mutates the LIVE working copy, so proposals are live-only (previewDraftProposal
    // no-ops in a variation). In a variation, still answer inquiries (Q&A) but never produce or show a
    // draft proposal — otherwise the chat offers an Accept/Reject that can never apply anything.
    if (activeVariationId.value && selectedContext.value && editorRef.value) {
      const result = await editorRef.value.prepareDraftProposal(message, conversationHistory);
      if (result.proposal) {
        await addCircuitMessage(translate("Circuit can only edit the live routing. Exit the variation to draft changes."));
      } else {
        await addCircuitMessage(result.message);
      }
      return;
    }

    if (selectedContext.value && editorRef.value) {
      if (pendingDraftProposal.value) {
        if (isApprovalMessage(message)) {
          await acceptPendingDraftProposal(message);
          return;
        }

        // A non-approval message while a proposal is live = a revision request. Prepare the revised
        // proposal and apply it live in place of the current one (previewDraftProposal reverts the
        // current preview first, so revisions never stack).
        const currentProposal = pendingDraftProposal.value;
        const result = await editorRef.value.prepareDraftProposal(message, conversationHistory);
        if (result.intent !== 'inquiry') {
          await saveDraftFeedbackForProposal('revision_requested', message, currentProposal);
          await showProposalLive(result.proposal);
          pendingDraftProposal.value = result.proposal;
        }
        await addCircuitMessage(result.message);
        return;
      }

      const result = await editorRef.value.prepareDraftProposal(message, conversationHistory);
      await showProposalLive(result.proposal);
      pendingDraftProposal.value = result.proposal;
      await addCircuitMessage(result.message);
      return;
    }

    await addCircuitMessage(translate("Select a routing before drafting changes."));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : translate('Failed to apply draft changes');
    await addCircuitMessage(errorMessage);
  } finally {
    isApplyingDraft.value = false;
  }
}

// Apply a freshly-prepared proposal live to the canvas (reversible preview). A null proposal (a
// revision that produced no operations) reverts any currently-live preview back to the manual state.
async function showProposalLive(proposal: CircuitDraftProposal | null) {
  if (!editorRef.value) return;
  if (!proposal) {
    editorRef.value.rejectDraftProposal();
    return;
  }
  await editorRef.value.previewDraftProposal(proposal);
}

const acceptPendingProposal = async () => {
  if (!pendingDraftProposal.value || isApplyingDraft.value) return;

  isApplyingDraft.value = true;
  try {
    await circuitStore.addLocalMessage({
      role: 'user',
      content: translate("Accept proposal"),
      threadName: translate("Accept proposal")
    });
    await acceptPendingDraftProposal(translate("Accept proposal"));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : translate('Failed to apply draft changes');
    await addCircuitMessage(errorMessage);
  } finally {
    isApplyingDraft.value = false;
  }
}

const rejectPendingProposal = async () => {
  if (!pendingDraftProposal.value || isApplyingDraft.value) return;

  isApplyingDraft.value = true;
  try {
    await circuitStore.addLocalMessage({
      role: 'user',
      content: translate("Reject proposal"),
      threadName: translate("Reject proposal")
    });
    // Revert the live preview back to the pre-proposal working state, then collect feedback so the
    // next message can revise the proposal.
    editorRef.value?.rejectDraftProposal();
    pendingDiscardFeedbackProposal.value = pendingDraftProposal.value;
    await addCircuitMessage(buildDiscardFeedbackPrompt(pendingDraftProposal.value));
    pendingDraftProposal.value = null;
  } finally {
    isApplyingDraft.value = false;
  }
}

// The proposal is already applied live to the canvas — accepting just keeps it in the working copy
// (dirty for the header Save/Discard) and drops the reversible stash.
async function acceptPendingDraftProposal(userFeedback: string) {
  if (!pendingDraftProposal.value || !editorRef.value) {
    return;
  }

  await savePendingDraftFeedback('approved', userFeedback);
  editorRef.value.acceptDraftProposal();
  pendingDraftProposal.value = null;
  await addCircuitMessage(translate("Changes accepted. Use Save to keep them, or Discard to revert."));
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
  if (!selectedContext.value || !editorRef.value) {
    await addCircuitMessage(buildFeedbackSavedMessage());
    return;
  }

  const revisionPrompt = buildFeedbackRevisionPrompt(proposal.sourcePrompt, feedback, proposal);
  const result = await editorRef.value.prepareDraftProposal(revisionPrompt, conversationHistory);
  if (result.proposal) {
    result.proposal.sourcePrompt = proposal.sourcePrompt;
  }

  // The rejected proposal was already reverted; apply the revised one live in its place.
  await showProposalLive(result.proposal);
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

const createNewChat = () => {
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
