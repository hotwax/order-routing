<template>
  <ion-modal
    ref="modalRef"
    class="variation-modal"
    :is-open="true"
    :breakpoints="breakpoints"
    :initial-breakpoint="MIN_BP"
    :backdrop-breakpoint="1"
    :backdrop-dismiss="false"
    handle-behavior="cycle"
    @ionBreakpointDidChange="onBreakpointChange"
  >
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Variations") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            v-if="isExpanded"
            fill="clear"
            size="default"
            @click="minimize()"
          >
            <ion-icon slot="start" :icon="chevronDownOutline" />
            {{ translate("Minimize") }}
          </ion-button>
          <ion-button
            v-else
            fill="clear"
            size="default"
            @click="expand()"
          >
            <ion-icon slot="start" :icon="chevronUpOutline" />
            {{ translate("Expand") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-radio-group :value="radioSelected" @ionChange="selectVariation($event.detail.value)">
        <ion-item>
          <ion-radio value="" label-placement="end" justify="start">{{ translate("Baseline (live config)") }}</ion-radio>
        </ion-item>

        <ion-item v-for="v in sim.variations" :key="v.id">
          <ion-radio :value="v.id" label-placement="end" justify="start">{{ v.label }}</ion-radio>
        </ion-item>
      </ion-radio-group>

      <!-- Editing status + save-changes workflow: update the active variation, or save the current
           working copy as a brand-new variation named inline. Replaces the old inline canvas card. -->
      <div class="save-section">
        <ion-chip :color="sim.activeVariationId ? 'primary' : 'medium'" :outline="true">
          <ion-label>
            <template v-if="sim.activeVariationId">{{ translate("Editing:") }} {{ sim.activeVariation?.label }}</template>
            <template v-else>{{ translate("New variation (from Baseline)") }}</template>
            <template v-if="sim.isDirty"> — {{ translate("unsaved changes") }}</template>
          </ion-label>
        </ion-chip>

        <ion-button
          v-if="sim.activeVariationId"
          expand="block"
          size="small"
          color="primary"
          :disabled="isSaving"
          @click="updateActive()"
        >
          <ion-icon slot="start" :icon="saveOutline" />
          {{ translate("Update") }} {{ sim.activeVariation?.label }}
        </ion-button>

        <div class="create-row">
          <ion-input
            v-model="newVariationName"
            :placeholder="translate('New variation name')"
            :disabled="isSaving"
            @keyup.enter="saveAsNew()"
          />
          <ion-button
            size="small"
            :fill="sim.activeVariationId ? 'outline' : 'solid'"
            color="primary"
            :disabled="isSaving"
            @click="saveAsNew()"
          >
            <ion-icon slot="start" :icon="addCircleOutline" />
            {{ translate("Save as new") }}
          </ion-button>
        </div>
      </div>

      <!-- Select a variation above, then act on it from this row. -->
      <div class="actions">
        <div class="action">
          <ion-fab-button class="success" size="small" :disabled="!sim.activeVariationId || sim.isRunningVariationRun" :aria-label="translate('Run variation')" @click="sim.runActiveVariation()">
            <ion-spinner v-if="sim.isRunningVariationRun" name="dots" />
            <ion-icon v-else :icon="playOutline" />
          </ion-fab-button>
          <ion-note>{{ sim.isRunningVariationRun ? translate("Running…") : translate("Run") }}</ion-note>
        </div>
        <div class="action">
          <ion-fab-button size="small" :disabled="!hasResults" :aria-label="translate('View results')" @click="showResults = true">
            <ion-icon :icon="barChartOutline" />
          </ion-fab-button>
          <ion-note>{{ translate("Results") }}</ion-note>
        </div>
        <div class="action">
          <ion-fab-button size="small" :disabled="!sim.activeVariationId" :aria-label="translate('Rename')" @click="renameActive()">
            <ion-icon :icon="pencilOutline" />
          </ion-fab-button>
          <ion-note>{{ translate("Rename") }}</ion-note>
        </div>
        <div class="action">
          <ion-fab-button class="danger" size="small" :disabled="!sim.activeVariationId" :aria-label="translate('Delete')" @click="sim.deleteVariation(sim.activeVariationId)">
            <ion-icon :icon="trashOutline" />
          </ion-fab-button>
          <ion-note>{{ translate("Delete") }}</ion-note>
        </div>
        <div class="action">
          <ion-fab-button size="small" :disabled="!sim.activeVariationId" :aria-label="translate('Reset to baseline')" @click="resetToBaseline()">
            <ion-icon :icon="refreshOutline" />
          </ion-fab-button>
          <ion-note>{{ translate("Reset") }}</ion-note>
        </div>
      </div>
    </ion-content>
  </ion-modal>

  <!-- Results of running the active variation (parent-vs-variation compare). On the canonical detail
       page there is no editor/results view toggle, so the rail surfaces results in its own modal,
       reusing SimulationResults in embedded mode. -->
  <ion-modal :is-open="showResults" @didDismiss="showResults = false">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Simulation results") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showResults = false">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <SimulationResults :embedded="true" />
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { commonUtil, translate } from "@common";
import { alertController, IonButton, IonButtons, IonChip, IonContent, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonModal, IonNote, IonRadio, IonRadioGroup, IonSpinner, IonTitle, IonToolbar } from "@ionic/vue";
import { addCircleOutline, barChartOutline, chevronDownOutline, chevronUpOutline, pencilOutline, playOutline, refreshOutline, saveOutline, trashOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";
import SimulationResults from "@/components/simulation/SimulationResults.vue";

const sim = simulationStore();

const newVariationName = ref("");
const isSaving = ref(false);
// Results modal for the active variation's run (compare vs. live parent). Enabled once a run has
// been kicked off — while running, on success, or on error — so the user can open it to watch/read.
const showResults = ref(false);
const hasResults = computed(() => !!(sim.variationRunResult || sim.isRunningVariationRun || sim.runCompareError));
// Local mirror of the selected radio so a cancelled discard can visually revert it
// (binding directly to sim.activeVariationId wouldn't re-patch when it's unchanged).
const radioSelected = ref(sim.activeVariationId || "");
watch(() => sim.activeVariationId, (v) => { radioSelected.value = v || ""; });

// Sheet stops: tucked-away sliver, half, and full. Lowest is > 0 so the sheet never dismisses.
const MIN_BP = 0.08;
const MAX_BP = 0.9;
const breakpoints = [MIN_BP, 0.5, MAX_BP];

const modalRef = ref<InstanceType<typeof IonModal> | null>(null);
const isExpanded = ref(false);

function onBreakpointChange(ev: CustomEvent<{ breakpoint: number }>) {
  isExpanded.value = ev.detail.breakpoint > MIN_BP;
}

async function setBreakpoint(bp: number) {
  await modalRef.value?.$el.setCurrentBreakpoint(bp);
  isExpanded.value = bp > MIN_BP;
}

const expand = () => setBreakpoint(MAX_BP);
const minimize = () => setBreakpoint(MIN_BP);

// Empty value is the baseline; anything else is a saved variation id.
// Switching discards the current working copy, so flush the editor's pending edits
// into `working` first (so the dirty check is accurate), then guard on unsaved changes.
async function selectVariation(id: string) {
  radioSelected.value = id;
  if (id === (sim.activeVariationId || "")) return;
  sim.flushWorkingCopy();
  if (sim.isDirty && !(await confirmDiscard())) {
    radioSelected.value = sim.activeVariationId || ""; // revert the radio to the still-active variation
    return;
  }
  if (id) sim.loadVariation(id);
  else sim.resetWorkingToBaseline();
}

// Reset also discards the working copy; same flush-then-guard.
async function resetToBaseline() {
  sim.flushWorkingCopy();
  if (sim.isDirty && !(await confirmDiscard())) return;
  sim.resetWorkingToBaseline();
}

async function confirmDiscard(): Promise<boolean> {
  const alert = await alertController.create({
    header: translate("Discard unsaved changes?"),
    message: translate("Switching variation will discard the unsaved changes in the current editor."),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { text: translate("Discard"), role: "destructive" }
    ]
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  return role === "destructive";
}

// Save the current working copy as a brand-new variation, named inline in this sheet.
async function saveAsNew() {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const isSaved = await sim.saveAsVariation(newVariationName.value.trim());
    commonUtil.showToast(isSaved ? translate("Variation saved") : (sim.loadError || translate("Failed to save variation")));
    if (isSaved) newVariationName.value = "";
  } finally {
    isSaving.value = false;
  }
}

// Overwrite the active variation with the current working copy.
async function updateActive() {
  if (!sim.activeVariationId || isSaving.value) return;
  isSaving.value = true;
  try {
    const isUpdated = await sim.updateVariation(sim.activeVariationId);
    commonUtil.showToast(isUpdated ? translate("Variation updated") : (sim.loadError || translate("Failed to update variation")));
  } finally {
    isSaving.value = false;
  }
}

function renameActive() {
  const v = sim.activeVariation;
  if (v) rename(v.id, v.label);
}

async function rename(id: string, current: string) {
  const alert = await alertController.create({
    header: translate("Rename variation"),
    inputs: [{ name: "label", value: current }],
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { text: translate("Save"), handler: (data) => sim.renameVariation(id, data.label) },
    ],
  });
  await alert.present();
}
</script>

<style scoped>
/* Pin the sheet to the right edge instead of the default full-width / centered layout. */
.variation-modal::part(content) {
  --width: 360px;
  width: 360px;
  max-width: 90vw;
  right: 16px;
  left: auto;
  margin-inline: 0;
}

/* One row of circular actions: pick a variation above, then act on it here. */
.actions {
  display: flex;
  justify-content: space-around;
  gap: var(--spacer-sm);
  padding: var(--spacer-base) var(--spacer-sm);
}

.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacer-xs);
}

.action ion-note {
  font-size: 0.7rem;
}

/* Soften the fabs: no heavy drop shadow, translucent tint instead of a deep solid fill,
   with the icon kept in the full color for contrast. */
.action ion-fab-button {
  --box-shadow: none;
  --background: rgba(var(--ion-color-primary-rgb), 0.12);
  --background-hover: rgba(var(--ion-color-primary-rgb), 0.2);
  --background-hover-opacity: 1;
  --background-activated: rgba(var(--ion-color-primary-rgb), 0.28);
  --background-activated-opacity: 1;
  --color: var(--ion-color-primary);
}

.action ion-fab-button.success {
  --background: rgba(var(--ion-color-success-rgb), 0.12);
  --background-hover: rgba(var(--ion-color-success-rgb), 0.2);
  --background-activated: rgba(var(--ion-color-success-rgb), 0.28);
  --color: var(--ion-color-success);
}

.action ion-fab-button.danger {
  --background: rgba(var(--ion-color-danger-rgb), 0.12);
  --background-hover: rgba(var(--ion-color-danger-rgb), 0.2);
  --background-activated: rgba(var(--ion-color-danger-rgb), 0.28);
  --color: var(--ion-color-danger);
}
</style>
