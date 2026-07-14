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
      <ion-radio-group :value="sim.activeVariationId" @ionChange="selectVariation($event.detail.value)">
        <ion-item>
          <ion-radio value="" label-placement="end" justify="start">{{ translate("Baseline (live config)") }}</ion-radio>
        </ion-item>

        <ion-item v-for="v in sim.variations" :key="v.id">
          <ion-radio :value="v.id" label-placement="end" justify="start">{{ v.label }}</ion-radio>
        </ion-item>
      </ion-radio-group>

      <!-- Select a variation above, then act on it from this row. -->
      <div class="actions">
        <div class="action">
          <ion-fab-button class="success" size="small" :disabled="!sim.activeVariationId || sim.isRunningVariationRun || sim.isDirty" :aria-label="translate('Run variation')" @click="sim.runActiveVariation()">
            <ion-spinner v-if="sim.isRunningVariationRun" name="dots" />
            <ion-icon v-else :icon="playOutline" />
          </ion-fab-button>
          <ion-note>{{ sim.isDirty ? translate("Save first") : sim.isRunningVariationRun ? translate("Running…") : translate("Run") }}</ion-note>
        </div>
        <div class="action">
          <ion-fab-button size="small" :disabled="!sim.activeVariationId" :aria-label="translate('Rename')" @click="renameActive()">
            <ion-icon :icon="pencilOutline" />
          </ion-fab-button>
          <ion-note>{{ translate("Rename") }}</ion-note>
        </div>
        <div class="action">
          <ion-fab-button class="danger" size="small" :disabled="!sim.activeVariationId" :aria-label="translate('Delete')" @click="deleteActiveVariation()">
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
</template>

<script setup lang="ts">
import { ref } from "vue";
import { translate } from "@common";
import { alertController, IonButton, IonButtons, IonContent, IonFabButton, IonHeader, IonIcon, IonItem, IonModal, IonNote, IonRadio, IonRadioGroup, IonSpinner, IonTitle, IonToolbar } from "@ionic/vue";
import { chevronDownOutline, chevronUpOutline, pencilOutline, playOutline, refreshOutline, trashOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";

const sim = simulationStore();

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

async function confirmDiscardSimulationChanges() {
  if (!sim.isDirty) return true;

  let shouldDiscard = false;
  const alert = await alertController.create({
    header: translate("Discard simulation changes?"),
    message: translate("Unsaved variation changes only affect the simulation workspace."),
    buttons: [
      { text: translate("Keep editing"), role: "cancel" },
      {
        text: translate("Discard changes"),
        role: "destructive",
        handler: () => {
          shouldDiscard = true;
        }
      }
    ]
  });

  await alert.present();
  await alert.onDidDismiss();
  return shouldDiscard;
}

// Empty value is the baseline; anything else is a saved variation id.
async function selectVariation(id: string) {
  if (id === sim.activeVariationId) return;
  if (!(await confirmDiscardSimulationChanges())) return;

  if (id) await sim.loadVariation(id);
  else sim.resetWorkingToBaseline();
}

async function resetToBaseline() {
  if (!(await confirmDiscardSimulationChanges())) return;
  sim.resetWorkingToBaseline();
}

async function deleteActiveVariation() {
  if (!sim.activeVariationId) return;
  if (!(await confirmDiscardSimulationChanges())) return;
  sim.deleteVariation(sim.activeVariationId);
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
