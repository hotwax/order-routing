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
          {{ translate("Pick a category that best describes what went wrong, then fill in the template.") }}
        </p>

        <div class="category-chips">
          <ion-chip
            v-for="cat in categories"
            :key="cat.value"
            :outline="category !== cat.value"
            :color="category === cat.value ? 'primary' : 'medium'"
            @click="selectCategory(cat.value)"
          >
            {{ translate(cat.label) }}
          </ion-chip>
        </div>

        <ion-textarea
          v-model="userCorrection"
          :auto-grow="true"
          :counter="true"
          :maxlength="2000"
          :placeholder="isSuggesting ? translate('Generating suggestion...') : translate('Describe the correction...')"
          :disabled="isSubmitting"
          fill="outline"
          @ion-input="userTouchedCorrection = true"
        />

        <ion-button
          expand="block"
          class="ion-margin-top"
          :disabled="!canSubmitForm"
          @click="submitProposal"
        >
          <template v-if="isSubmitting">
            <ion-spinner name="dots" />
          </template>
          <template v-else>
            {{ translate("Propose changes") }}
          </template>
        </ion-button>
      </template>

      <template v-else-if="phase === 'review' && proposal">
        <h2 class="review-summary">{{ proposal.summary }}</h2>
        <p class="review-rationale">{{ proposal.rationale }}</p>

        <ion-list class="edit-list" lines="full">
          <ion-item v-for="(desc, i) in proposal.editDescriptions" :key="i">
            <ion-label>
              <p class="edit-text">{{ desc.text }}</p>
              <p class="edit-path"><code>{{ desc.path }}</code></p>
            </ion-label>
          </ion-item>
          <ion-item v-if="proposal.editDescriptions.length === 0">
            <ion-label color="medium">
              {{ translate("Circuit did not propose any edits. Refine or discard.") }}
            </ion-label>
          </ion-item>
        </ion-list>

        <ion-button
          expand="block"
          class="ion-margin-top"
          :disabled="!canApprove"
          @click="submitApprove"
        >
          <template v-if="isSubmitting">
            <ion-spinner name="dots" />
          </template>
          <template v-else>
            {{ translate("Approve and commit") }}
          </template>
        </ion-button>

        <ion-textarea
          v-model="refinementText"
          :auto-grow="true"
          :counter="true"
          :maxlength="1000"
          :placeholder="translate('What still needs to change?')"
          :disabled="isSubmitting"
          fill="outline"
          class="refinement-input"
        />

        <ion-button
          expand="block"
          fill="outline"
          :disabled="!canRefine"
          @click="submitRefine"
        >
          {{ translate("Refine") }}
        </ion-button>

        <ion-button
          expand="block"
          fill="clear"
          color="medium"
          :disabled="isSubmitting"
          @click="discardProposal"
        >
          {{ translate("Discard and start over") }}
        </ion-button>
      </template>

      <template v-else-if="phase === 'success' && successResult">
        <h2>{{ translate("Knowledge base updated") }}</h2>
        <p class="commit-line">
          {{ translate("Commit") }}:
          <code>{{ successResult.shortSha }}</code>
          ({{ successResult.editCount }}
          {{ successResult.editCount === 1 ? translate("edit") : translate("edits") }})
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
        <ion-button expand="block" @click="returnFromError">
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
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar
} from "@ionic/vue";
import { computed, ref, watch } from "vue";
import { translate } from "@common";
import {
  proposeKnowledgeFeedback,
  refineKnowledgeFeedback,
  approveKnowledgeFeedback,
  suggestKnowledgeFeedbackPrompt,
  type ApproveResult,
  type CorrectionCategory,
  type KnowledgeFeedbackContext,
  type KnowledgeFeedbackMessage,
  type ProposalPayload,
  type ProposalResult
} from "@/services/CircuitKnowledgeFeedbackService";

type Phase = "form" | "review" | "success" | "error";

const props = defineProps<{
  isOpen: boolean;
  messages: KnowledgeFeedbackMessage[];
  context?: KnowledgeFeedbackContext;
}>();

const emit = defineEmits<{
  (e: "dismiss"): void;
}>();

const categories: Array<{ value: CorrectionCategory; label: string }> = [
  { value: "wrong_recommendation", label: "Wrong recommendation" },
  { value: "missed_clarifying_question", label: "Missed clarifying question" },
  { value: "misnamed_entity", label: "Misnamed entity" },
  { value: "should_have_used_tool", label: "Should have used a tool" },
  { value: "other", label: "Other" }
];

const phase = ref<Phase>("form");
const category = ref<CorrectionCategory | null>(null);
const userCorrection = ref("");
const proposal = ref<ProposalPayload | null>(null);
const refinementText = ref("");
const refinementHistory = ref<string[]>([]);
const isSubmitting = ref(false);
const successResult = ref<Extract<ApproveResult, { ok: true }> | null>(null);
const errorResult = ref<
  Extract<ProposalResult, { ok: false }> | Extract<ApproveResult, { ok: false }> | null
>(null);
const errorReturnPhase = ref<Phase>("form");
const isSuggesting = ref(false);
const userTouchedCorrection = ref(false);
let suggestController: AbortController | null = null;

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      resetAll();
      void requestSuggestion(null);
    } else {
      abortSuggest();
    }
  }
);

function resetAll() {
  abortSuggest();
  phase.value = "form";
  category.value = null;
  userCorrection.value = "";
  proposal.value = null;
  refinementText.value = "";
  refinementHistory.value = [];
  isSubmitting.value = false;
  successResult.value = null;
  errorResult.value = null;
  errorReturnPhase.value = "form";
  isSuggesting.value = false;
  userTouchedCorrection.value = false;
}

function abortSuggest() {
  if (suggestController) {
    suggestController.abort();
    suggestController = null;
  }
}

async function requestSuggestion(cat: CorrectionCategory | null) {
  abortSuggest();
  if (userTouchedCorrection.value) {
    return;
  }
  const controller = new AbortController();
  suggestController = controller;
  isSuggesting.value = true;
  try {
    const result = await suggestKnowledgeFeedbackPrompt(
      {
        messages: props.messages,
        correctionCategory: cat ?? undefined,
        context: props.context
      },
      controller.signal
    );
    if (controller.signal.aborted) return;
    if (result.ok && !userTouchedCorrection.value) {
      userCorrection.value = result.suggestedPrompt;
    }
  } catch {
    // AbortError or other — ignore.
  } finally {
    if (suggestController === controller) {
      suggestController = null;
    }
    isSuggesting.value = false;
  }
}

function selectCategory(value: CorrectionCategory) {
  category.value = value;
  void requestSuggestion(value);
}

const canSubmitForm = computed(
  () => userCorrection.value.trim().length > 0 && !isSubmitting.value
);

const canApprove = computed(
  () => !!proposal.value && proposal.value.edits.length > 0 && !isSubmitting.value
);

const canRefine = computed(
  () => !!proposal.value && refinementText.value.trim().length > 0 && !isSubmitting.value
);

async function submitProposal() {
  if (!canSubmitForm.value) return;
  isSubmitting.value = true;
  errorResult.value = null;
  const result = await proposeKnowledgeFeedback({
    messages: props.messages,
    userCorrection: userCorrection.value.trim(),
    correctionCategory: category.value ?? undefined,
    context: props.context
  });
  isSubmitting.value = false;

  if (result.ok) {
    proposal.value = result.proposal;
    phase.value = "review";
  } else {
    errorResult.value = result;
    errorReturnPhase.value = "form";
    phase.value = "error";
  }
}

async function submitRefine() {
  if (!canRefine.value || !proposal.value) return;
  isSubmitting.value = true;
  errorResult.value = null;
  const result = await refineKnowledgeFeedback({
    messages: props.messages,
    userCorrection: userCorrection.value.trim(),
    correctionCategory: category.value ?? undefined,
    context: props.context,
    previousProposal: {
      proposalId: proposal.value.proposalId,
      summary: proposal.value.summary,
      rationale: proposal.value.rationale,
      edits: proposal.value.edits
    },
    refinementFeedback: refinementText.value.trim()
  });
  isSubmitting.value = false;

  if (result.ok) {
    refinementHistory.value.push(refinementText.value.trim());
    refinementText.value = "";
    proposal.value = result.proposal;
    // stay in review
  } else {
    errorResult.value = result;
    errorReturnPhase.value = "review";
    phase.value = "error";
  }
}

async function submitApprove() {
  if (!canApprove.value || !proposal.value) return;
  isSubmitting.value = true;
  errorResult.value = null;
  const result = await approveKnowledgeFeedback({
    proposal: {
      proposalId: proposal.value.proposalId,
      summary: proposal.value.summary,
      rationale: proposal.value.rationale,
      edits: proposal.value.edits
    },
    userCorrection: userCorrection.value.trim(),
    refinementHistory: refinementHistory.value.length ? refinementHistory.value : undefined,
    messages: props.messages
  });
  isSubmitting.value = false;

  if (result.ok) {
    successResult.value = result;
    phase.value = "success";
  } else {
    errorResult.value = result;
    // applier / yaml_parse on approve mean the YAML changed under us — go back to form
    errorReturnPhase.value =
      result.stage === "applier" || result.stage === "yaml_parse" || result.stage === "validation" ? "form" : "review";
    phase.value = "error";
  }
}

function discardProposal() {
  proposal.value = null;
  refinementText.value = "";
  refinementHistory.value = [];
  phase.value = "form";
}

function returnFromError() {
  if (errorReturnPhase.value === "form") {
    proposal.value = null;
    refinementHistory.value = [];
  }
  phase.value = errorReturnPhase.value;
  errorResult.value = null;
}

function onDismiss() {
  resetAll();
  emit("dismiss");
}
</script>

<style scoped>
.prompt-label {
  margin-bottom: 12px;
  color: var(--ion-color-medium);
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.review-summary {
  margin: 0 0 4px;
}

.review-rationale {
  margin: 0 0 12px;
  color: var(--ion-color-medium);
  white-space: pre-wrap;
}

.edit-list {
  margin-bottom: 12px;
}

.edit-text {
  margin: 0;
  white-space: pre-wrap;
}

.edit-path {
  margin: 4px 0 0;
  font-size: 12px;
}

.edit-path code,
.commit-line code,
.stage-line code {
  background: var(--ion-color-step-50, #f4f5f8);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.refinement-input {
  margin-top: 16px;
}

.summary {
  margin-top: 8px;
  white-space: pre-wrap;
}

.error-line {
  color: var(--ion-color-danger, #c0392b);
}
</style>
