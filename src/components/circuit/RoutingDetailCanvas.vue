<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button
            default-href="/order-routing"
            :disabled="navigationOperationLocked"
            :aria-label="navigationOperationLocked ? navigationLockMessage : translate('Back')"
          />
          <ion-note
            v-if="navigationOperationLocked"
            color="medium"
            aria-live="polite"
            class="navigation-lock-message"
          >
            {{ navigationLockMessage }}
          </ion-note>
          <ion-button
            v-if="draftAssistantEnabled"
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
            :disabled="editorLocked"
            :aria-label="translate('Discard changes')"
            @click="discardEditor"
          >
            <ion-icon slot="icon-only" :icon="arrowUndoOutline" />
          </ion-button>
          <!-- Explicit, on-demand Save for the live routing group. Variations save via the rail, so
               this is hidden while a variation is active. Enabled only when there are unsaved edits. -->
          <ion-button
            v-if="!activeVariationId"
            :disabled="!editorDirty || editorLocked"
            :fill="editorDirty ? 'outline' : 'clear'"
            :color="editorDirty ? 'primary' : undefined"
            :aria-label="editorDirty ? translate('Save changes') : translate('No unsaved changes')"
            @click="saveEditor"
          >
            <ion-icon slot="start" :icon="saveOutline" />
            {{ editorDirty ? translate("Save") : translate("Saved") }}
          </ion-button>
          <ion-button v-if="draftAssistantEnabled && isChatStarted" :aria-label="translate('New chat')" @click="createNewChat">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
          <ion-button v-if="draftAssistantEnabled && messages.length" :disabled="isApplyingDraft" :aria-label="translate('Clear chat history')" @click="clearCurrentChatHistory">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
          <ion-button v-if="draftAssistantEnabled && isDevModeEnabled" @click="showPromptModal = true">
            <ion-icon slot="icon-only" :icon="terminalOutline" />
          </ion-button>
          <ion-button
            v-if="draftAssistantEnabled && canSendFeedback"
            :aria-label="translate('Send feedback to improve Circuit')"
            @click="showFeedbackModal = true"
          >
            <ion-icon slot="icon-only" :icon="bulbOutline" />
          </ion-button>
          <ion-button v-if="draftAssistantEnabled" @click="openThreadModal">
            <ion-icon slot="start" :icon="chatbubblesOutline" />
            {{ translate("Threads") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Thread Selection List (Visible when menu is toggled) -->
    </ion-header>

    <ion-content>
      <div ref="chatCanvasContainer" class="chat-canvas-container">
        <!-- Chat Section -->
        <div
          v-if="draftAssistantEnabled"
          v-show="chatVisible"
          class="chat-section"
          :style="{ inlineSize: `${chatWidth}px` }"
        >
          <ion-list class="chat-history">
            <EmptyState
              v-if="!messages.length"
              class="chat-empty-state"
              variant="compact"
              :icon="chatboxEllipsesOutline"
              :title="translate('Start a conversation')"
              :message="translate('Ask Circuit a question about this routing or describe a change you want to make.')"
            />
            <template v-for="message in messages" :key="message.id">
              <ion-item lines="none" :class="message.role === 'user' ? 'prompt-item' : 'response-item'">
                <ion-label>
                  <p class="overline">{{ message.role === 'user' ? translate('User') : translate('Circuit') }}</p>
                  <p class="message-content">{{ message.content }}</p>
                </ion-label>
              </ion-item>
            </template>
          </ion-list>

          <div v-if="isApplyingDraft" class="circuit-loading" role="status" aria-live="polite">
            <ion-spinner name="dots" />
            <ion-label>
              <p class="overline">{{ translate("Circuit") }}</p>
              <p class="message-content">{{ circuitLoadingMessage }}</p>
            </ion-label>
          </div>

          <CircuitPromptArea
            v-if="!pendingDraftProposal"
            v-model="prompt"
            :disabled="isApplyingDraft || isSavingEditor"
            @send="onSend"
          />
          <!-- The proposal is already applied live to the canvas (preview). Accept keeps it in the
               working copy; Reject reverts the canvas to the pre-proposal state. -->
          <div v-if="pendingDraftProposal" class="proposal-review">
            <div
              v-for="card in proposalContextCards"
              :key="card.key"
              class="proposal-card-review"
              :class="{ 'discarded-proposal-card': proposalCardDecision(card.key) === 'discarded' }"
            >
              <RoutingConfigSectionCard :card="card" />
              <ion-segment
                class="proposal-card-decision"
                :value="proposalCardDecision(card.key)"
                :disabled="isApplyingDraft"
                :aria-label="`${translate(card.title)}: ${translate('Accept')} or ${translate('Discard')}`"
                @ionChange="setProposalCardDecision(card.key, $event.detail.value)"
              >
                <ion-segment-button value="accepted">
                  <ion-label>{{ translate("Accept") }}</ion-label>
                </ion-segment-button>
                <ion-segment-button value="discarded">
                  <ion-label>{{ translate("Discard") }}</ion-label>
                </ion-segment-button>
              </ion-segment>
            </div>
            <div class="proposal-actions">
              <ion-button expand="block" :disabled="isApplyingDraft || !hasSelectedProposalChanges" @click="acceptPendingProposal">
                <ion-icon slot="start" :icon="checkmarkCircleOutline" />
                {{ translate("Accept selected") }} ({{ selectedProposalCardCount }})
              </ion-button>
              <ion-button expand="block" :disabled="isApplyingDraft" fill="outline" color="medium" @click="rejectPendingProposal">
                <ion-icon slot="start" :icon="closeCircleOutline" />
                {{ translate("Reject all") }}
              </ion-button>
            </div>
          </div>
        </div>

        <!-- The separator is pointer- and keyboard-resizable so the conversation can expand without
             hiding or remounting either side of the workspace. -->
        <div
          v-if="draftAssistantEnabled"
          v-show="chatVisible"
          ref="chatResizeHandle"
          class="chat-resize-handle"
          :class="{ 'is-resizing': isResizingChat }"
          role="separator"
          tabindex="0"
          aria-orientation="vertical"
          :aria-label="translate('Resize chat panel')"
          :aria-valuemin="CHAT_MIN_WIDTH"
          :aria-valuemax="chatMaxWidth"
          :aria-valuenow="chatWidth"
          @pointerdown="startChatResize"
          @pointermove="resizeChat"
          @pointerup="finishChatResize"
          @pointercancel="finishChatResize"
          @keydown="resizeChatWithKeyboard"
        >
          <ion-icon aria-hidden="true" :icon="ellipsisVerticalOutline" />
        </div>

        <!-- Canvas Section: ONE canvas. sandbox=true binds it to the active variation's working copy;
             sandbox=false binds it to the live routing group. Keyed so switching live <-> variation (and
             between variations) remounts the editor for a clean re-bind. -->
        <div class="canvas-section" :aria-busy="editorLocked">
          <RoutingGroupEditor
            :key="`${routingGroupId || 'none'}:${activeVariationId || 'live'}`"
            ref="editorRef"
            :routingGroupId="routingGroupId"
            :sandbox="!!activeVariationId"
            :interaction-locked="editorLocked"
            @dirty-change="editorDirty = $event"
          />
        </div>
      </div>
    </ion-content>

    <ion-modal v-if="draftAssistantEnabled" :is-open="showPromptModal" @didDismiss="showPromptModal = false">
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

    <ion-modal v-if="draftAssistantEnabled" :is-open="showThreadMenu" @didDismiss="showThreadMenu = false">
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
      v-if="draftAssistantEnabled"
      :is-open="showFeedbackModal"
      :messages="buildFeedbackMessages()"
      :context="feedbackContext"
      @dismiss="showFeedbackModal = false"
    />
    <VariationRail
      v-if="props.simulationEnabled"
      :routing-group-id="routingGroupId"
      :live-dirty="!activeVariationId && editorDirty"
      :editor-dirty="editorDirty"
    />
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
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar
} from '@ionic/vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import CircuitPromptArea from '@/components/circuit/CircuitPromptArea.vue';
import RoutingConfigSectionCard from '@/components/circuit/RoutingConfigSectionCard.vue';
import RoutingGroupEditor from '@/components/circuit/RoutingGroupEditor.vue';
import EmptyState from '@/components/EmptyState.vue';
import VariationRail from '@/components/simulation/VariationRail.vue';
import { orderRoutingStore } from '@/store/orderRoutingStore';
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
  ellipsisVerticalOutline,
  saveOutline,
  terminalOutline,
  trashOutline
} from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
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
import { isFeatureEnabled } from '@/utils/simConfig';
import { activeRoutingNavigationOperation } from '@/utils/routingWorkingCopy';
import { buildCircuitProposalContextCards, selectCircuitProposalCards } from '@/utils/circuitProposalContext';

const props = withDefaults(defineProps<{
  routingGroupId: string;
  simulationEnabled?: boolean;
}>(), {
  simulationEnabled: true
});

const circuitStore = useCircuitStore();
const preferencesStore = usePreferencesStore();
const draftAssistantEnabled = isFeatureEnabled('draftAssistant');
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
const CHAT_MIN_WIDTH = 320;
const CHAT_DEFAULT_WIDTH = 360;
const CHAT_MAX_WIDTH = 720;
const CANVAS_MIN_WIDTH = 480;
const CHAT_KEYBOARD_STEP = 24;
const chatCanvasContainer = ref<HTMLElement | null>(null);
const chatResizeHandle = ref<HTMLElement | null>(null);
const chatWidth = ref(CHAT_DEFAULT_WIDTH);
const chatMaxWidth = ref(CHAT_MAX_WIDTH);
const isResizingChat = ref(false);
let resizeStartX = 0;
let resizeStartWidth = CHAT_DEFAULT_WIDTH;
let chatContainerResizeObserver: ResizeObserver | null = null;
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
  getProposalContextCards: (proposal: CircuitDraftProposal | null) => ReturnType<typeof buildCircuitProposalContextCards>;
  save: () => Promise<boolean>;
  discardChanges: (options?: { navigate?: boolean }) => boolean | Promise<boolean>;
  flushEditorDraft: () => void;
  activateWorkingFlushHook: () => void;
  activateForVisibleGroup: () => Promise<void>;
  deactivateWorkingFlushHook: (flush?: boolean) => void;
} | null>(null);
const pendingDraftProposal = ref<CircuitDraftProposal | null>(null);
const pendingDiscardFeedbackProposal = ref<CircuitDraftProposal | null>(null);
type ProposalCardDecision = 'accepted' | 'discarded';
const proposalCardDecisions = ref<Record<string, ProposalCardDecision>>({});
const isPageActive = ref(false);
const pageVariationId = ref("");
let circuitContextGeneration = 0;

type CircuitContextIdentity = { generation: number; routingGroupId: string; variationId: string };
function captureCircuitContext(): CircuitContextIdentity {
  return {
    generation: circuitContextGeneration,
    routingGroupId: routingGroupId.value,
    variationId: activeVariationId.value
  };
}
function isCurrentCircuitContext(context: CircuitContextIdentity) {
  return context.generation === circuitContextGeneration
    && context.routingGroupId === routingGroupId.value
    && context.variationId === activeVariationId.value;
}
function assertCurrentCircuitContext(context: CircuitContextIdentity) {
  if (!isCurrentCircuitContext(context)) {
    throw new DOMException("The routing context changed while Circuit was preparing changes.", "AbortError");
  }
}

onMounted(async () => {
  if (draftAssistantEnabled) circuitStore.loadAllThreads();
  await nextTick();
  updateChatWidthBounds();
  window.addEventListener('resize', updateChatWidthBounds);
  if (typeof ResizeObserver !== 'undefined' && chatCanvasContainer.value) {
    chatContainerResizeObserver = new ResizeObserver(updateChatWidthBounds);
    chatContainerResizeObserver.observe(chatCanvasContainer.value);
  }
});

// Ionic keeps routed pages mounted. The routed RoutingDetail view calls these methods from its own
// lifecycle because nested components do not reliably receive Ionic view-enter/view-leave events.
// Only the visible cached detail page may own the global variation flush hook or browser listener;
// otherwise a hidden group can flush its editor into the visible group's simulation working copy.
async function activateForVisiblePage() {
  if (isPageActive.value) return;
  isPageActive.value = true;
  syncVisibleVariation();
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('beforeunload', handleBeforeUnload);
  await nextTick();
  await editorRef.value?.activateForVisibleGroup?.();
}

function deactivateForHiddenPage() {
  if (!isPageActive.value) return;
  isPageActive.value = false;
  window.removeEventListener('beforeunload', handleBeforeUnload);
  rollbackPendingProposal();
  editorRef.value?.deactivateWorkingFlushHook?.(true);
}

defineExpose({ activateForVisiblePage, deactivateForHiddenPage });

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateChatWidthBounds);
  chatContainerResizeObserver?.disconnect();
  deactivateForHiddenPage();
});

function updateChatWidthBounds() {
  const containerWidth = chatCanvasContainer.value?.clientWidth || CHAT_MAX_WIDTH + CANVAS_MIN_WIDTH;
  const resizeHandleWidth = chatResizeHandle.value?.offsetWidth || 0;
  chatMaxWidth.value = Math.max(
    CHAT_MIN_WIDTH,
    Math.min(CHAT_MAX_WIDTH, containerWidth - CANVAS_MIN_WIDTH - resizeHandleWidth)
  );
  chatWidth.value = Math.min(Math.max(chatWidth.value, CHAT_MIN_WIDTH), chatMaxWidth.value);
}

function setChatWidth(width: number) {
  updateChatWidthBounds();
  chatWidth.value = Math.min(Math.max(width, CHAT_MIN_WIDTH), chatMaxWidth.value);
}

function startChatResize(event: PointerEvent) {
  updateChatWidthBounds();
  isResizingChat.value = true;
  resizeStartX = event.clientX;
  resizeStartWidth = chatWidth.value;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  event.preventDefault();
}

function resizeChat(event: PointerEvent) {
  if (!isResizingChat.value) return;
  setChatWidth(resizeStartWidth + event.clientX - resizeStartX);
}

function finishChatResize(event: PointerEvent) {
  if (!isResizingChat.value) return;
  isResizingChat.value = false;
  const handle = event.currentTarget as HTMLElement;
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
}

function resizeChatWithKeyboard(event: KeyboardEvent) {
  const widths: Record<string, number> = {
    ArrowLeft: chatWidth.value - CHAT_KEYBOARD_STEP,
    ArrowRight: chatWidth.value + CHAT_KEYBOARD_STEP,
    Home: CHAT_MIN_WIDTH,
    End: chatMaxWidth.value
  };
  const width = widths[event.key];
  if (width === undefined) return;
  event.preventDefault();
  setChatWidth(width);
}

// Editor identity belongs to this route instance, never to Circuit's global chat context. Ionic
// keeps prior detail pages mounted; using selectedContext here caused hidden G1 to remount as G2.
const routingGroupId = computed(() => String(props.routingGroupId || ""));
// When a simulation variation is active, the single RoutingGroupEditor runs in sandbox mode and edits
// that variation's working copy; otherwise it edits the live routing group. Either way it exposes
// the same draft interface, so the chat's editorRef works unchanged.
const sim = simulationStore();
const activeVariationId = computed(() => props.simulationEnabled ? pageVariationId.value : "");
function syncVisibleVariation() {
  if (isPageActive.value && sim.routingGroupId === routingGroupId.value) {
    pageVariationId.value = sim.activeVariationId || "";
  }
}
watch([() => sim.routingGroupId, () => sim.activeVariationId], syncVisibleVariation);
// Switching group/live/variation replaces the authoritative working copy. Reject the preview before
// the keyed editor remounts, then clear host state so stale Accept/Reject controls cannot survive.
watch([routingGroupId, activeVariationId], async () => {
  circuitContextGeneration += 1;
  rollbackPendingProposal();
  if (!isPageActive.value) return;
  await nextTick();
  await editorRef.value?.activateForVisibleGroup?.();
});
const showThreadMenu = ref(false);
const showPromptModal = ref(false);
const showFeedbackModal = ref(false);
// The chat panel can be collapsed to give the editor full width. v-show (not v-if) keeps the
// chat mounted so its thread/messages state survives toggling.
const chatVisible = ref(draftAssistantEnabled);
// Live editor unsaved-changes state, surfaced by RoutingGroupEditor via @dirty-change, powering the
// header Save button. (Variations save through the rail, so the header Save is hidden for them.)
const editorDirty = ref(false);
const isSavingEditor = ref(false);
const editorLocked = computed(() => !!pendingDraftProposal.value || isApplyingDraft.value || isSavingEditor.value);
const proposalContextCards = computed(() => editorRef.value?.getProposalContextCards?.(pendingDraftProposal.value)
  || buildCircuitProposalContextCards(pendingDraftProposal.value));
const acceptedProposalCardKeys = computed(() => new Set(
  proposalContextCards.value
    .filter((card) => proposalCardDecision(card.key) === 'accepted')
    .map((card) => card.key)
));
const selectedDraftProposal = computed<CircuitDraftProposal | null>(() => pendingDraftProposal.value
  ? selectCircuitProposalCards(pendingDraftProposal.value, acceptedProposalCardKeys.value)
  : null);
const selectedProposalCardCount = computed(() => acceptedProposalCardKeys.value.size);
const hasSelectedProposalChanges = computed(() => Boolean(
  selectedDraftProposal.value?.newRouting || selectedDraftProposal.value?.operations.length
));
function proposalCardDecision(cardKey: string): ProposalCardDecision {
  return proposalCardDecisions.value[cardKey] || 'accepted';
}

watch(() => pendingDraftProposal.value?.id, () => {
  proposalCardDecisions.value = Object.fromEntries(
    buildCircuitProposalContextCards(pendingDraftProposal.value)
      .map((card) => [card.key, 'accepted' as ProposalCardDecision])
  );
}, { flush: 'sync' });

const circuitLoadingMessage = computed(() => pendingDraftProposal.value
  ? translate("Circuit is applying your decision…")
  : translate("Circuit is preparing a response…"));
// Leaving mid-save or mid-draft would strand a half-applied mutation with no owner to reconcile it,
// so Back and route changes are refused (not confirmed) until the operation settles. An undecided
// proposal preview is excluded: leaving rolls it back, which is a safe, designed path.
const navigationOperation = computed(() => activeRoutingNavigationOperation({
  isSavingEditor: isSavingEditor.value,
  isApplyingCircuit: isApplyingDraft.value,
  isSavingVariation: Boolean(props.simulationEnabled && sim.isSavingVariation),
  isRunningSimulation: Boolean(props.simulationEnabled && sim.isRunningVariationRun)
}));
const navigationOperationLocked = computed(() => navigationOperation.value !== null);
const navigationLockMessage = computed(() => ({
  "editor-save": translate("Wait for the save to finish before leaving."),
  circuit: translate("Wait for Circuit to finish before leaving."),
  "variation-save": translate("Wait for the variation save to finish before leaving."),
  "simulation-run": translate("Wait for the simulation run to finish before leaving.")
}[navigationOperation.value || "editor-save"]));
const hasPendingChanges = computed(() => activeVariationId.value
  ? editorDirty.value || sim.isDirty
  : editorDirty.value);

// A header Save (commit) or Discard (reset-to-baseline) resolves the whole working copy, which
// subsumes any undecided Circuit proposal. Clear the host-owned proposal refs too so the Accept/Reject
// row can't linger and act on a snapshot the editor already dropped.
function clearPendingProposalState() {
  pendingDraftProposal.value = null;
  pendingDiscardFeedbackProposal.value = null;
  proposalCardDecisions.value = {};
}

function rollbackPendingProposal() {
  if (!pendingDraftProposal.value) return;
  editorRef.value?.rejectDraftProposal?.();
  clearPendingProposalState();
}

const saveEditor = async () => {
  if (editorLocked.value) return;
  isSavingEditor.value = true;
  try {
    // Only clear the pending proposal once the commit actually succeeded — on a failed save nothing was
    // committed, so the proposal is still live and the Accept/Reject row must stay.
    const ok = await editorRef.value?.save?.();
    if (!ok) return;
    clearPendingProposalState();

    // A live Save changes the version that future variations and comparisons must use. Re-fetch the
    // simulation baseline/variation list under the canonical backend id (important after first Save,
    // where the route began with a temporary UUID) before re-enabling variation actions.
    const savedGroupId = orderRoutingStore().currentGroup?.routingGroupId;
    if (props.simulationEnabled && savedGroupId) await sim.loadGroup(savedGroupId);
  } finally {
    isSavingEditor.value = false;
  }
};

// Discard the live working copy back to the last-saved state (with a confirm).
const discardEditor = async () => {
  if (editorLocked.value) return;
  const alert = await alertController.create({
    header: translate("Discard changes?"),
    message: translate("This resets the routing group to its last saved version. Unsaved edits will be lost."),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { text: translate("Discard"), role: "destructive" }
    ]
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role === "destructive") {
    const discarded = await editorRef.value?.discardChanges?.();
    if (discarded !== false) {
      clearPendingProposalState();
      editorDirty.value = false;
    }
  }
};

function flushEditorDraft() {
  editorRef.value?.flushEditorDraft?.();
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  // An undecided AI proposal is a preview, not durable user intent. Revert it before the editor
  // flushes to persisted working state; any manual dirty state that pre-dated the proposal remains.
  rollbackPendingProposal();
  flushEditorDraft();
  if (!hasPendingChanges.value && !navigationOperationLocked.value) return;
  event.preventDefault();
  event.returnValue = "";
}

// Both leaving the record and updating only its routingGroupId can replace the authoritative draft.
// Flush first so persistence and the dirty decision include the active editor's projected values.
async function confirmNavigationWithUnsavedChanges() {
  if (navigationOperationLocked.value) return false;
  flushEditorDraft();
  if (!hasPendingChanges.value) return true;
  const alert = await alertController.create({
    header: translate("Unsaved changes"),
    message: translate("Discard unsaved changes and leave this routing group?"),
    buttons: [
      { text: translate("Stay"), role: "cancel" },
      { text: translate("Discard and leave"), role: "destructive" }
    ]
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== "destructive") return false;

  // This application intentionally has one authoritative live working copy. A destructive leave
  // must therefore really discard it now; parking it would either contradict this dialog or lose
  // it silently when another group replaces the singleton store.
  rollbackPendingProposal();
  if (activeVariationId.value) {
    sim.resetWorkingToBaseline();
    editorDirty.value = false;
    return true;
  }

  const discarded = await editorRef.value?.discardChanges?.({ navigate: false });
  if (discarded === false) {
    return false;
  }
  clearPendingProposalState();
  editorDirty.value = false;
  return true;
}

onBeforeRouteLeave(confirmNavigationWithUnsavedChanges);
onBeforeRouteUpdate(confirmNavigationWithUnsavedChanges);

const canSendFeedback = computed(() => draftAssistantEnabled && messages.value.length > 0);

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
  if (!draftAssistantEnabled) return;
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
  const circuitContext = captureCircuitContext();

  try {
    if (pendingDiscardFeedbackProposal.value) {
      const proposal = pendingDiscardFeedbackProposal.value;
      pendingDiscardFeedbackProposal.value = null;
      await saveDraftFeedbackForProposal('rejected', message, proposal);
      assertCurrentCircuitContext(circuitContext);
      await reviseDiscardedProposal(proposal, message, conversationHistory, circuitContext);
      return;
    }

    if (selectedContext.value && editorRef.value) {
      if (pendingDraftProposal.value) {
        if (isApprovalMessage(message)) {
          await acceptPendingDraftProposal(message);
          return;
        }

        // Revert the current preview before preparing a revision so Circuit reasons over the manual
        // authoritative draft, not over its own still-applied proposal. The canvas stays inert while
        // a preview is pending, so no unrelated manual edit can be overwritten by this transaction.
        const currentProposal = pendingDraftProposal.value;
        editorRef.value.rejectDraftProposal();
        try {
          const result = await editorRef.value.prepareDraftProposal(message, conversationHistory);
          assertCurrentCircuitContext(circuitContext);
          if (result.intent !== 'inquiry') {
            await saveDraftFeedbackForProposal('revision_requested', message, currentProposal);
            assertCurrentCircuitContext(circuitContext);
            await showProposalLive(result.proposal, circuitContext);
            pendingDraftProposal.value = result.proposal;
          } else {
            await editorRef.value.previewDraftProposal(currentProposal);
            assertCurrentCircuitContext(circuitContext);
          }
          await addCircuitMessage(result.message);
        } catch (error) {
          if (isCurrentCircuitContext(circuitContext)) {
            await editorRef.value.previewDraftProposal(currentProposal);
          }
          throw error;
        }
        return;
      }

      const result = await editorRef.value.prepareDraftProposal(message, conversationHistory);
      assertCurrentCircuitContext(circuitContext);
      await showProposalLive(result.proposal, circuitContext);
      pendingDraftProposal.value = result.proposal;
      await addCircuitMessage(result.message);
      return;
    }

    await addCircuitMessage(translate("Select a routing before drafting changes."));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    const errorMessage = error instanceof Error ? error.message : translate('Failed to apply draft changes');
    await addCircuitMessage(errorMessage);
  } finally {
    isApplyingDraft.value = false;
  }
}

// Apply a freshly-prepared proposal live to the canvas (reversible preview). A null proposal (a
// revision that produced no operations) reverts any currently-live preview back to the manual state.
async function showProposalLive(proposal: CircuitDraftProposal | null, circuitContext?: CircuitContextIdentity) {
  if (!editorRef.value) return;
  if (circuitContext) assertCurrentCircuitContext(circuitContext);
  if (!proposal) {
    editorRef.value.rejectDraftProposal();
    return;
  }
  await editorRef.value.previewDraftProposal(proposal);
  if (circuitContext) assertCurrentCircuitContext(circuitContext);
}

async function previewProposalSelection(proposal: CircuitDraftProposal | null) {
  if (!editorRef.value) return;
  if (proposal?.newRouting || proposal?.operations.length) {
    await editorRef.value.previewDraftProposal(proposal);
  } else {
    editorRef.value.rejectDraftProposal();
  }
}

async function setProposalCardDecision(cardKey: string, value: unknown) {
  if (!pendingDraftProposal.value || !editorRef.value || isApplyingDraft.value) return;
  if (value !== 'accepted' && value !== 'discarded') return;
  if (proposalCardDecision(cardKey) === value) return;

  const previousDecisions = { ...proposalCardDecisions.value };
  const circuitContext = captureCircuitContext();
  proposalCardDecisions.value = { ...previousDecisions, [cardKey]: value };
  isApplyingDraft.value = true;
  try {
    await previewProposalSelection(selectedDraftProposal.value);
    assertCurrentCircuitContext(circuitContext);
  } catch (error) {
    proposalCardDecisions.value = previousDecisions;
    if (isCurrentCircuitContext(circuitContext) && pendingDraftProposal.value) {
      const previousProposal = selectCircuitProposalCards(
        pendingDraftProposal.value,
        new Set(proposalContextCards.value
          .filter((card) => (previousDecisions[card.key] || 'accepted') === 'accepted')
          .map((card) => card.key))
      );
      await previewProposalSelection(previousProposal);
    }
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      await addCircuitMessage(error instanceof Error ? error.message : translate('Failed to apply draft changes'));
    }
  } finally {
    isApplyingDraft.value = false;
  }
}

const acceptPendingProposal = async () => {
  if (!draftAssistantEnabled || !pendingDraftProposal.value || !hasSelectedProposalChanges.value || isApplyingDraft.value) return;

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
  if (!draftAssistantEnabled || !pendingDraftProposal.value || isApplyingDraft.value) return;

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

// The proposal is already applied to the active working copy. Accept keeps it there and drops the
// reversible stash; live persistence uses Save, while a simulation variation uses rail Update.
async function acceptPendingDraftProposal(userFeedback: string) {
  if (!draftAssistantEnabled || !pendingDraftProposal.value || !editorRef.value) {
    return;
  }

  const approvedProposal = selectedDraftProposal.value;
  if (!approvedProposal || (!approvedProposal.newRouting && !approvedProposal.operations.length)) return;
  const partiallyAccepted = selectedProposalCardCount.value < proposalContextCards.value.length;
  await saveDraftFeedbackForProposal('approved', userFeedback, approvedProposal);
  editorRef.value.acceptDraftProposal();
  pendingDraftProposal.value = null;
  await addCircuitMessage(partiallyAccepted
    ? activeVariationId.value
      ? translate("Selected changes accepted. Use Update to save this variation, or Reset to revert.")
      : translate("Selected changes accepted. Use Save to keep them, or Discard to revert.")
    : activeVariationId.value
      ? translate("Changes accepted. Use Update to save this variation, or Reset to revert.")
      : translate("Changes accepted. Use Save to keep them, or Discard to revert."));
}

async function saveDraftFeedbackForProposal(type: DraftFeedbackType, userFeedback: string, proposal: CircuitDraftProposal) {
  if (!draftAssistantEnabled) return;
  await circuitStore.saveDraftFeedback({
    type,
    userFeedback,
    proposal
  });
}

async function reviseDiscardedProposal(
  proposal: CircuitDraftProposal,
  feedback: string,
  conversationHistory: DraftConversationMessage[],
  circuitContext: CircuitContextIdentity
) {
  if (!draftAssistantEnabled) return;
  if (!selectedContext.value || !editorRef.value) {
    await addCircuitMessage(buildFeedbackSavedMessage());
    return;
  }

  const revisionPrompt = buildFeedbackRevisionPrompt(proposal.sourcePrompt, feedback, proposal);
  const result = await editorRef.value.prepareDraftProposal(revisionPrompt, conversationHistory);
  assertCurrentCircuitContext(circuitContext);
  if (result.proposal) {
    result.proposal.sourcePrompt = proposal.sourcePrompt;
  }

  // The rejected proposal was already reverted; apply the revised one live in its place.
  await showProposalLive(result.proposal, circuitContext);
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
  if (!draftAssistantEnabled) return;
  circuitStore.setChatStarted(false);
  circuitStore.switchThread(null);
}

const clearCurrentChatHistory = () => {
  if (!draftAssistantEnabled) return;
  circuitStore.clearCurrentChatHistory();
}

const openThreadModal = () => {
  if (!draftAssistantEnabled) return;
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
  flex: 0 0 auto;
  min-inline-size: 320px;
  display: flex;
  flex-direction: column;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
}

.chat-empty-state {
  block-size: 100%;
}

.overline {
  color: var(--ion-color-dard);
}

.message-content {
  font-size: 1rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.chat-resize-handle {
  flex: 0 0 var(--spacer-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  border-inline: 1px solid var(--ion-color-medium);
  background: var(--ion-color-light);
  cursor: col-resize;
  touch-action: none;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.chat-resize-handle:hover,
.chat-resize-handle.is-resizing {
  border-inline-color: var(--ion-color-primary);
  background: var(--ion-color-light-shade);
}

.chat-resize-handle:focus-visible {
  border-inline-color: var(--ion-color-primary);
  background: var(--ion-color-light-shade);
  outline: 2px solid var(--ion-color-primary);
  outline-offset: -2px;
}

.circuit-loading {
  display: flex;
  align-items: center;
  gap: var(--spacer-sm);
  padding: var(--spacer-sm) var(--spacer-base);
  border-top: 1px solid var(--ion-color-step-150, rgba(0,0,0,0.12));
}

.circuit-loading p {
  margin: 0;
}

.proposal-review {
  max-height: 60%;
  overflow-y: auto;
  padding: var(--spacer-sm);
  border-top: 1px solid var(--ion-color-step-150, rgba(0,0,0,0.12));
}

.proposal-card-review {
  margin-block-end: var(--spacer-sm);
}

.proposal-card-review :deep(.routing-config-card) {
  margin-block-end: 0;
}

.proposal-card-decision {
  padding-inline: var(--spacer-xs);
}

.discarded-proposal-card {
  opacity: 0.64;
}

.proposal-actions {
  display: grid;
  gap: var(--spacer-sm);
  padding-block: var(--spacer-sm);
}

.canvas-section {
  flex: 1;
  min-inline-size: 0;
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
