<template>
  <ion-modal :is-open="isOpen" @didDismiss="onDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Send feedback") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onDismiss">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <template v-if="phase === 'form'">
        <p class="prompt-label">
          {{ translate("What was supposed to happen? Be specific — what did Circuit get wrong, and what should the correct answer have looked like?") }}
        </p>
        <ion-textarea
          v-model="userCorrection"
          :auto-grow="true"
          :counter="true"
          :maxlength="2000"
          :placeholder="translate('Describe the correction...')"
          :disabled="isSubmitting"
          fill="outline"
        />
        <ion-button
          expand="block"
          class="ion-margin-top"
          :disabled="!canSubmit"
          @click="submit"
        >
          <template v-if="isSubmitting">
            <ion-spinner name="dots" />
          </template>
          <template v-else>
            {{ translate("Send feedback") }}
          </template>
        </ion-button>
      </template>

      <template v-else-if="phase === 'success' && successResult">
        <h2>{{ translate("Knowledge base updated") }}</h2>
        <p v-if="successResult.editCount === 0">
          {{ translate("No changes made — feedback was too ambiguous.") }}
        </p>
        <p v-else class="commit-line">
          {{ translate("Commit") }}:
          <code>{{ successResult.shortSha }}</code>
          ({{ successResult.editCount }} {{ successResult.editCount === 1 ? translate("edit") : translate("edits") }})
        </p>
        <p class="summary">{{ successResult.summary }}</p>
        <ion-button expand="block" @click="onDismiss">{{ translate("Done") }}</ion-button>
      </template>

      <template v-else-if="phase === 'error' && errorResult">
        <h2>{{ translate("Couldn't send feedback") }}</h2>
        <p class="error-line">{{ errorResult.error }}</p>
        <p class="stage-line">
          {{ translate("Stage") }}: <code>{{ errorResult.stage }}</code>
        </p>
        <ion-button expand="block" @click="returnToForm">
          {{ translate("Try again") }}
        </ion-button>
        <ion-button expand="block" fill="clear" @click="onDismiss">
          {{ translate("Close") }}
        </ion-button>
      </template>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { computed, ref, watch } from "vue";
import { translate } from "@common";
import {
  submitKnowledgeFeedback,
  type KnowledgeFeedbackMessage,
  type KnowledgeFeedbackRequest,
  type KnowledgeFeedbackResult
} from "@/services/CircuitKnowledgeFeedbackService";

type Phase = "form" | "success" | "error";

const props = defineProps<{
  isOpen: boolean;
  messages: KnowledgeFeedbackMessage[];
  context?: KnowledgeFeedbackRequest["context"];
}>();

const emit = defineEmits<{
  (e: "dismiss"): void;
}>();

const phase = ref<Phase>("form");
const userCorrection = ref("");
const isSubmitting = ref(false);
const successResult = ref<Extract<KnowledgeFeedbackResult, { ok: true }> | null>(null);
const errorResult = ref<Extract<KnowledgeFeedbackResult, { ok: false }> | null>(null);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      phase.value = "form";
      isSubmitting.value = false;
      successResult.value = null;
      errorResult.value = null;
    }
  }
);

const canSubmit = computed(() => userCorrection.value.trim().length > 0 && !isSubmitting.value);

async function submit() {
  if (!canSubmit.value) return;
  isSubmitting.value = true;
  errorResult.value = null;
  successResult.value = null;

  const result = await submitKnowledgeFeedback({
    messages: props.messages,
    userCorrection: userCorrection.value.trim(),
    context: props.context
  });

  isSubmitting.value = false;
  if (result.ok) {
    successResult.value = result;
    phase.value = "success";
  } else {
    errorResult.value = result;
    phase.value = "error";
  }
}

function returnToForm() {
  phase.value = "form";
  errorResult.value = null;
}

function onDismiss() {
  userCorrection.value = "";
  emit("dismiss");
}
</script>

<style scoped>
.prompt-label {
  margin-bottom: 12px;
  color: var(--ion-color-medium);
}

.commit-line code,
.stage-line code {
  background: var(--ion-color-step-50, #f4f5f8);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.summary {
  margin-top: 8px;
  white-space: pre-wrap;
}

.error-line {
  color: var(--ion-color-danger, #c0392b);
}
</style>
