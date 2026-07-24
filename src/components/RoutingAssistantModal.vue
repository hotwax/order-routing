<template>
  <ion-modal v-if="draftAssistantEnabled" :is-open="isOpen" @didDismiss="onDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Circuit") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="isSending" @click="clearChat">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
          <ion-button @click="close">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="assistant-container">
        <div class="context-summary">
          <ion-item lines="none" class="ion-no-padding">
            <ion-label class="ion-text-wrap">
              <p class="role-label">{{ translate("Context") }}</p>
              <p v-if="isLoadingContext">
                <ion-spinner name="dots" /> {{ translate("Loading routing group details…") }}
              </p>
              <p v-else>
                {{ translate("Connected to") }} {{ routingGroupCount }} {{ routingGroupCount === 1 ? translate("routing group") : translate("routing groups") }}.
              </p>
            </ion-label>
          </ion-item>
        </div>

        <ion-list class="chat-history">
          <ion-item
            v-for="(message, index) in messages"
            :key="`${index}-${message.role}`"
            lines="none"
            :class="message.role === 'user' ? 'prompt-item' : 'response-item'"
          >
            <ion-label class="ion-text-wrap">
              <p class="role-label">{{ message.role === 'user' ? translate('You') : translate('Assistant') }}</p>
              <p class="message-content">{{ message.content }}</p>
            </ion-label>
          </ion-item>
          <ion-item v-if="!messages.length && !isLoadingContext" lines="none">
            <ion-label color="medium">
              <p>{{ translate("Ask about any routing group on this page — run config, order group filters, routing rules, schedule, queues, allocation behavior, and more.") }}</p>
            </ion-label>
          </ion-item>
          <ion-item v-if="isSending" lines="none">
            <ion-label>
              <p class="role-label">{{ translate("Assistant") }}</p>
              <ion-spinner name="dots" />
            </ion-label>
          </ion-item>
        </ion-list>

        <div class="prompt-area">
          <ion-textarea
            v-model="prompt"
            :placeholder="translate('Ask about your routing groups')"
            :auto-grow="true"
            :disabled="isSending || isLoadingContext"
            :rows="2"
            @keydown.enter.exact.prevent="onSend"
          />
          <ion-button :disabled="!canSend" @click="onSend">
            <ion-icon slot="icon-only" :icon="sendOutline" />
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
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
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { sendOutline, trashOutline } from "ionicons/icons";
import { computed, ref, watch } from "vue";
import { translate, commonUtil } from "@common";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { productStore } from "@/store/productStore";
import { useUtilStore } from "@/store/utilStore";
import { buildRoutingAgentSnapshot } from "@/composables/useRoutingAgentSnapshot";
import { buildRoutingGroupsListManifest } from "@/utils/routingGroupsManifest";
import { DraftAssistantService } from "@/services/DraftAssistantService";
import type { DraftConversationMessage, PageCapabilityManifest } from "@/types/draft";
import {
  DEFAULT_ACTION_ENUMS,
  DEFAULT_CONDITION_FILTER_ENUMS,
  DEFAULT_CONDITION_SORT_ENUMS,
  DEFAULT_RULE_ENUMS,
  parseRoutingEditorEnvJson,
  parseRoutingStringRecordEnvJson
} from "@/utils/routingEditorEnv";
import { isFeatureEnabled } from "@/utils/simConfig";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const props = defineProps({
  isOpen: { type: Boolean, required: true }
});
const emit = defineEmits(["close"]);

const routingStore = orderRoutingStore();
const product = productStore();
const utilStore = useUtilStore();
const draftAssistantEnabled = isFeatureEnabled("draftAssistant");

const prompt = ref("");
const messages = ref<ChatMessage[]>([]);
const isSending = ref(false);
const isLoadingContext = ref(false);
const cachedManifest = ref<PageCapabilityManifest | null>(null);
const routingGroupCount = ref(0);

const ruleEnums = parseRoutingEditorEnvJson(import.meta.env.VITE_RULE_ENUMS as string | undefined, DEFAULT_RULE_ENUMS);
const conditionFilterEnums = parseRoutingEditorEnvJson(import.meta.env.VITE_RULE_FILTER_ENUMS as string | undefined, DEFAULT_CONDITION_FILTER_ENUMS);
const conditionSortEnums = parseRoutingEditorEnvJson(import.meta.env.VITE_RULE_SORT_ENUMS as string | undefined, DEFAULT_CONDITION_SORT_ENUMS);
const actionEnums = parseRoutingEditorEnvJson(import.meta.env.VITE_RULE_ACTION_ENUMS as string | undefined, DEFAULT_ACTION_ENUMS);
const cronExpressions = parseRoutingStringRecordEnvJson(import.meta.env.VITE_CRON_EXPRESSIONS as string | undefined);

const canSend = computed(() => draftAssistantEnabled && Boolean(prompt.value.trim()) && !isSending.value && !isLoadingContext.value);

watch(() => props.isOpen, async (open) => {
  if (!open) return;
  if (!draftAssistantEnabled) {
    emit("close");
    return;
  }
  await loadContext();
});

async function loadContext() {
  if (!draftAssistantEnabled) return;
  isLoadingContext.value = true;
  cachedManifest.value = null;
  try {
    await routingStore.fetchOrderRoutingGroupsDetails();
    cachedManifest.value = buildManifest();
    routingGroupCount.value = (cachedManifest.value.visibleEntities as any)?.brokeringRuns?.length || 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : translate("Failed to load routing group details");
    commonUtil.showToast(message);
  } finally {
    isLoadingContext.value = false;
  }
}

function buildManifest(): PageCapabilityManifest {
  const snapshot = buildRoutingAgentSnapshot();
  return buildRoutingGroupsListManifest({
    pageRoute: "/order-routing",
    productStoreId: product.getCurrentEComStore?.productStoreId || "",
    groups: routingStore.getRoutingGroups || [],
    ruleEnums,
    conditionFilterEnums,
    conditionSortEnums,
    actionEnums,
    referenceData: {
      facilities: snapshot.facilities,
      shippingMethods: snapshot.shippingMethods,
      salesChannels: snapshot.salesChannels,
      facilityGroups: snapshot.facilityGroups
    },
    cronExpressions
  });
}

async function onSend() {
  if (!draftAssistantEnabled) return;
  const message = prompt.value.trim();
  if (!message || !canSend.value) return;

  prompt.value = "";
  messages.value.push({ role: "user", content: message });

  if (!cachedManifest.value) {
    cachedManifest.value = buildManifest();
  }

  const conversationHistory: DraftConversationMessage[] = messages.value
    .slice(0, -1)
    .map((entry) => ({ role: entry.role, content: entry.content }))
    .slice(-12);

  isSending.value = true;
  try {
    const result = await DraftAssistantService.requestBrokeringRunsListInquiry(message, cachedManifest.value, conversationHistory);
    const composed = composeAssistantMessage(result.message, result.questions);
    messages.value.push({ role: "assistant", content: composed });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : translate("Inquiry assistant failed");
    messages.value.push({ role: "assistant", content: errorMessage });
  } finally {
    isSending.value = false;
  }
}

function composeAssistantMessage(answer: string, questions: string[]) {
  const parts = [answer];
  if (questions?.length) {
    parts.push(`${translate("Open questions:")}\n${questions.map((question) => `• ${question}`).join("\n")}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function clearChat() {
  messages.value = [];
}

function onDismiss() {
  emit("close");
}

function close() {
  emit("close");
}

// Importing the optional assistant on the list page must remain side-effect free when deployment
// configuration is absent, including its supporting reference-data request.
if (draftAssistantEnabled) utilStore.fetchRoutingEditorEnums();
</script>

<style scoped>
.assistant-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 8px;
  padding: 12px;
}

.context-summary {
  flex-shrink: 0;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  background: var(--ion-background-color);
}

.role-label {
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--ion-color-medium);
  margin-bottom: 4px;
}

.message-content {
  white-space: pre-wrap;
}

.prompt-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
  border-top: 1px solid var(--ion-color-step-150, rgba(0, 0, 0, 0.12));
  padding-top: 8px;
}

.prompt-area ion-textarea {
  flex: 1;
}
</style>
