<template>
  <ion-modal :is-open="isOpen" @didDismiss="onDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Brokering Runs Assistant") }}</ion-title>
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
                <ion-spinner name="dots" /> {{ translate("Loading brokering run details…") }}
              </p>
              <p v-else>
                {{ translate("Connected to") }} {{ brokeringRunCount }} {{ brokeringRunCount === 1 ? translate("brokering run") : translate("brokering runs") }}.
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
              <p>{{ translate("Ask about any brokering run on this page — run config, order group filters, inventory rules, schedule, queues, allocation behavior, and more.") }}</p>
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
            :placeholder="translate('Ask about your brokering runs')"
            :auto-grow="true"
            :disabled="isSending || isLoadingContext"
            rows="2"
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
import { computed, defineEmits, defineProps, ref, watch } from "vue";
import { translate, commonUtil } from "@common";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { productStore } from "@/store/productStore";
import { useUtilStore } from "@/store/utilStore";
import { buildBrokeringAgentSnapshot } from "@/draftTargets/BrokeringAgentSnapshot";
import { buildBrokeringRunsListManifest } from "@/draftTargets/BrokeringRunsListTargets";
import { requestBrokeringRunsListInquiry } from "@/services/BrokeringRunsAssistantService";
import type { DraftConversationMessage, PageCapabilityManifest } from "@/services/DraftAssistantService";

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

const prompt = ref("");
const messages = ref<ChatMessage[]>([]);
const isSending = ref(false);
const isLoadingContext = ref(false);
const cachedManifest = ref<PageCapabilityManifest | null>(null);
const brokeringRunCount = ref(0);

const ruleEnums = JSON.parse(import.meta.env.VITE_RULE_ENUMS as string || "{}");
const conditionFilterEnums = JSON.parse(import.meta.env.VITE_RULE_FILTER_ENUMS as string || "{}");
const conditionSortEnums = JSON.parse(import.meta.env.VITE_RULE_SORT_ENUMS as string || "{}");
const actionEnums = JSON.parse(import.meta.env.VITE_RULE_ACTION_ENUMS as string || "{}");
const cronExpressions = JSON.parse(import.meta.env.VITE_CRON_EXPRESSIONS as string || "{}");

const canSend = computed(() => Boolean(prompt.value.trim()) && !isSending.value && !isLoadingContext.value);

watch(() => props.isOpen, async (open) => {
  if (!open) return;
  await loadContext();
});

async function loadContext() {
  isLoadingContext.value = true;
  cachedManifest.value = null;
  try {
    await routingStore.fetchOrderRoutingGroupsDetails();
    cachedManifest.value = buildManifest();
    brokeringRunCount.value = (cachedManifest.value.visibleEntities as any)?.brokeringRuns?.length || 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : translate("Failed to load brokering run details");
    commonUtil.showToast(message);
  } finally {
    isLoadingContext.value = false;
  }
}

function buildManifest(): PageCapabilityManifest {
  const snapshot = buildBrokeringAgentSnapshot();
  return buildBrokeringRunsListManifest({
    pageRoute: "/tabs/brokering",
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
    const result = await requestBrokeringRunsListInquiry(message, cachedManifest.value, conversationHistory);
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

// Re-fetch detail when product store changes while modal is open.
utilStore.fetchEnums({ parentTypeId: "ORDER_ROUTING" });
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
