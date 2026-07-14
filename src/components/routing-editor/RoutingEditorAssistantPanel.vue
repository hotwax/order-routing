<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button :aria-label="translate('Close')" @click="emit('dismiss')">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ translate("Circuit Assistant") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="isChatStarted" aria-label="New chat" @click="createNewChat">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
          <ion-button v-if="messages.length" :disabled="isApplyingDraft" :aria-label="translate('Clear chat history')" @click="clearCurrentChatHistory">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
          <ion-button v-if="isDevModeEnabled" :aria-label="translate('Show last prompt')" @click="showPromptModal = true">
            <ion-icon slot="icon-only" :icon="terminalOutline" />
          </ion-button>
          <ion-button
            v-if="canSendFeedback"
            :aria-label="translate('Send feedback to improve Circuit')"
            @click="showFeedbackModal = true"
          >
            <ion-icon slot="icon-only" :icon="bulbOutline" />
          </ion-button>
          <ion-button aria-label="Open chat threads" @click="openThreadModal">
            <ion-icon slot="start" :icon="chatbubblesOutline" />
            {{ translate("Threads") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <template v-for="message in messages" :key="message.id">
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>{{ message.role === "user" ? translate("User") : translate("Circuit") }}</p>
              <p>{{ message.content }}</p>
            </ion-label>
          </ion-item>
        </template>
        <ion-item v-if="!messages.length" lines="none">
          <ion-label class="ion-text-wrap">
            <h2>{{ translate("Ask Circuit to help you create or modify rules") }}</h2>
            <p>{{ translate("Circuit changes are staged on this page. Use Save to publish them.") }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

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
            <pre>{{ JSON.stringify(lastPrompt, null, 2) }}</pre>
          </template>
          <div v-else class="ion-text-center ion-padding">
            <p>{{ translate("No prompt sent yet in this session.") }}</p>
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
            <ion-item button v-for="thread in threads" :key="thread.id" @click="selectThread(thread.id)" :detail="false">
              <ion-label>
                <h3>{{ thread.name }}</h3>
                <p>{{ formatDate(thread.createdAt) }}</p>
              </ion-label>
              <ion-button slot="end" fill="clear" color="danger" @click.stop="confirmDelete(thread.id)">
                <ion-icon slot="icon-only" :icon="trashOutline" />
              </ion-button>
            </ion-item>
            <ion-item v-if="threads.length === 0">
              <ion-label>{{ translate("No threads found") }}</ion-label>
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
    </ion-content>
    <ion-footer>
      <ion-toolbar>
        <div class="ion-padding">
          <ion-chip v-if="context" outline>
            <ion-icon :icon="sparklesOutline" />
            <ion-label>{{ context.routingName || context.label }}</ion-label>
          </ion-chip>
          <ion-textarea
            :label="translate('Your prompt here')"
            label-placement="floating"
            fill="outline"
            :auto-grow="true"
            :disabled="isApplyingDraft"
            v-model="prompt"
            @keydown="handleKeydown"
          >
            <ion-button aria-label="Send prompt" :disabled="isApplyingDraft || !prompt.trim()" slot="end" fill="clear" @click="onSend">
              <ion-icon slot="icon-only" :icon="sendOutline" />
            </ion-button>
          </ion-textarea>
        </div>
        <ion-item v-if="pendingDraftProposal" lines="none">
          <ion-button :disabled="isApplyingDraft" @click="approvePendingProposal">
            <ion-icon slot="start" :icon="checkmarkCircleOutline" />
            {{ translate("Apply to draft") }}
          </ion-button>
          <ion-button :disabled="isApplyingDraft" fill="clear" @click="discardPendingProposal">
            <ion-icon slot="start" :icon="closeCircleOutline" />
            {{ translate("Discard") }}
          </ion-button>
        </ion-item>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import {
  addOutline,
  bulbOutline,
  chatbubblesOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  closeOutline,
  sendOutline,
  sparklesOutline,
  terminalOutline,
  trashOutline
} from "ionicons/icons";
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { DateTime } from "luxon";
import { translate } from "@common";
import { useCircuitStore } from "@/store/circuit";
import { usePreferencesStore } from "@/store/preferences";
import CircuitFeedbackModal from "@/components/circuit/CircuitFeedbackModal.vue";
import type { KnowledgeFeedbackMessage } from "@/types/circuit";
import type { DraftConversationMessage, DraftProposal } from "@/types/draft";
import {
  buildDiscardFeedbackPrompt,
  buildFeedbackRevisionMessage,
  buildFeedbackRevisionPrompt,
  buildFeedbackSavedMessage,
  DraftFeedbackType
} from "@/utils/circuitFeedback";

type CircuitDraftProposal = DraftProposal & {
  id: string;
  sourcePrompt: string;
  createdAt: number;
  contextKey?: string;
};

const props = defineProps<{
  context: any;
  prepareDraftProposal: (prompt: string, conversationHistory?: DraftConversationMessage[]) => Promise<{ proposal: CircuitDraftProposal | null; message: string; intent?: "edit" | "inquiry" }>;
  applyDraftProposal: (proposal: CircuitDraftProposal) => Promise<{ appliedCount: number; message: string }>;
}>();

const emit = defineEmits<{
  (event: "dismiss"): void;
  (event: "applied"): void;
}>();

const circuitStore = useCircuitStore();
const preferencesStore = usePreferencesStore();
const isDevModeEnabled = computed(() => preferencesStore.isDevModeEnabled);
const {
  messages,
  threads,
  currentThreadId,
  lastPrompt,
  isChatStarted
} = storeToRefs(circuitStore);

const prompt = ref("");
const isApplyingDraft = ref(false);
const pendingDraftProposal = ref<CircuitDraftProposal | null>(null);
const pendingDiscardFeedbackProposal = ref<CircuitDraftProposal | null>(null);
const showThreadMenu = ref(false);
const showPromptModal = ref(false);
const showFeedbackModal = ref(false);

const contextKey = computed(() => [
  props.context?.routingGroupId || "",
  props.context?.orderRoutingId || "",
  props.context?.routingRuleId || ""
].join(":"));

const canSendFeedback = computed(() => messages.value.length > 0);

const feedbackContext = computed(() => ({
  routingGroupId: props.context?.routingGroupId ?? null,
  routingRuleId: props.context?.routingRuleId ?? null,
  activeContextLabel: props.context?.label ?? props.context?.routingName ?? undefined
}));

onMounted(async () => {
  await circuitStore.loadAllThreads();
  circuitStore.setActiveContext(props.context);
});

watch(contextKey, () => {
  pendingDraftProposal.value = null;
  pendingDiscardFeedbackProposal.value = null;
  circuitStore.setActiveContext(props.context);
});

async function onSend() {
  const message = prompt.value.trim();
  if (!message || isApplyingDraft.value) return;

  prompt.value = "";
  isApplyingDraft.value = true;
  await circuitStore.addLocalMessage({
    role: "user",
    content: message,
    threadName: message.substring(0, 30) || "New Chat"
  });
  const conversationHistory = buildConversationHistory();

  try {
    if (pendingDiscardFeedbackProposal.value) {
      const proposal = pendingDiscardFeedbackProposal.value;
      pendingDiscardFeedbackProposal.value = null;
      await saveDraftFeedbackForProposal("rejected", message, proposal);
      await reviseDiscardedProposal(proposal, message, conversationHistory);
      return;
    }

    if (!props.context?.routingGroupId || !props.context?.orderRoutingId) {
      await addCircuitMessage(translate("Select a routing context before asking Circuit to draft changes."));
      return;
    }

    if (pendingDraftProposal.value) {
      if (!isPendingProposalForCurrentContext()) {
        pendingDraftProposal.value = null;
        await addCircuitMessage(translate("Routing context changed. Ask Circuit to draft the change again."));
        return;
      }

      if (isApprovalMessage(message)) {
        await applyPendingDraftProposal(message);
        return;
      }

      const currentProposal = pendingDraftProposal.value;
      const result = await props.prepareDraftProposal(message, conversationHistory);
      if (result.proposal) {
        result.proposal.contextKey = contextKey.value;
      }
      if (result.intent !== "inquiry") {
        await saveDraftFeedbackForProposal("revision_requested", message, currentProposal);
        pendingDraftProposal.value = result.proposal;
      }
      await addCircuitMessage(result.message);
      return;
    }

    const result = await props.prepareDraftProposal(message, conversationHistory);
    if (result.proposal) {
      result.proposal.contextKey = contextKey.value;
    }
    pendingDraftProposal.value = result.proposal;
    await addCircuitMessage(result.message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : translate("Failed to apply draft changes");
    await addCircuitMessage(errorMessage);
  } finally {
    isApplyingDraft.value = false;
  }
}

async function approvePendingProposal() {
  if (!pendingDraftProposal.value || isApplyingDraft.value) return;

  isApplyingDraft.value = true;
  try {
    await circuitStore.addLocalMessage({
      role: "user",
      content: translate("Apply to draft"),
      threadName: translate("Apply to draft")
    });
    await applyPendingDraftProposal(translate("Apply to draft"));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : translate("Failed to apply draft changes");
    await addCircuitMessage(errorMessage);
  } finally {
    isApplyingDraft.value = false;
  }
}

async function discardPendingProposal() {
  if (!pendingDraftProposal.value || isApplyingDraft.value) return;

  isApplyingDraft.value = true;
  try {
    await circuitStore.addLocalMessage({
      role: "user",
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
  if (!pendingDraftProposal.value) return;

  if (!isPendingProposalForCurrentContext()) {
    pendingDraftProposal.value = null;
    await addCircuitMessage(translate("Routing context changed. Ask Circuit to draft the change again."));
    return;
  }

  const proposal = pendingDraftProposal.value;
  await savePendingDraftFeedback("approved", userFeedback);
  const result = await props.applyDraftProposal(proposal);
  pendingDraftProposal.value = null;
  await addCircuitMessage([
    result.message,
    translate("Circuit changes are staged on this page. Use Save to publish them.")
  ].filter(Boolean).join("\n\n"));
  emit("applied");
}

function isPendingProposalForCurrentContext() {
  return !pendingDraftProposal.value?.contextKey || pendingDraftProposal.value.contextKey === contextKey.value;
}

async function savePendingDraftFeedback(type: DraftFeedbackType, userFeedback: string) {
  if (!pendingDraftProposal.value) return;
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
  if (!props.context?.routingGroupId || !props.context?.orderRoutingId) {
    await addCircuitMessage(buildFeedbackSavedMessage());
    return;
  }

  const revisionPrompt = buildFeedbackRevisionPrompt(proposal.sourcePrompt, feedback, proposal);
  const result = await props.prepareDraftProposal(revisionPrompt, conversationHistory);
  if (result.proposal) {
    result.proposal.sourcePrompt = proposal.sourcePrompt;
    result.proposal.contextKey = contextKey.value;
  }

  pendingDraftProposal.value = result.proposal;
  await addCircuitMessage(buildFeedbackRevisionMessage(result.message, Boolean(result.proposal)));
}

async function addCircuitMessage(content: string) {
  await circuitStore.addLocalMessage({
    role: "circuit",
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
    "apply to draft",
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

function buildConversationHistory(): DraftConversationMessage[] {
  return messages.value
    .map((message: any) => ({
      role: message.role === "circuit" ? "assistant" : message.role,
      content: String(message.content || "").trim()
    }))
    .filter((message: DraftConversationMessage) =>
      (message.role === "user" || message.role === "assistant") && message.content
    )
    .slice(-12);
}

function buildFeedbackMessages(): KnowledgeFeedbackMessage[] {
  return messages.value
    .map((message: any) => ({
      role: message.role === "circuit" ? "assistant" : message.role,
      content: String(message.content || "").trim()
    }))
    .filter((message: { role: string; content: string }) =>
      (message.role === "user" || message.role === "assistant") && message.content
    ) as KnowledgeFeedbackMessage[];
}

function createNewChat() {
  pendingDraftProposal.value = null;
  pendingDiscardFeedbackProposal.value = null;
  circuitStore.setChatStarted(false);
  circuitStore.switchThread(null, { preserveContext: true });
}

function clearCurrentChatHistory() {
  pendingDraftProposal.value = null;
  pendingDiscardFeedbackProposal.value = null;
  circuitStore.clearCurrentChatHistory();
}

function openThreadModal() {
  showThreadMenu.value = true;
}

function selectThread(threadId: string) {
  pendingDraftProposal.value = null;
  pendingDiscardFeedbackProposal.value = null;
  circuitStore.switchThread(threadId, { preserveContext: true });
  showThreadMenu.value = false;
}

function confirmDelete(threadId: string) {
  pendingDraftProposal.value = null;
  pendingDiscardFeedbackProposal.value = null;
  circuitStore.deleteThread(threadId);
}

function formatDate(timestamp: number) {
  return DateTime.fromMillis(timestamp).toRelative();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (prompt.value.trim()) {
      onSend();
    }
  }
}
</script>
