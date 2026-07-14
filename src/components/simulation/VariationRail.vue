<template>
  <!-- In-page floating panel (NOT an ion-modal). An always-open sheet modal teleports to the app
       root, which escapes the `ion-page-hidden` display:none Ionic puts on cached, navigated-away
       pages — so it used to float over every other tab. As a plain element inside this page's
       ion-page it is hidden automatically when the page is cached. `v-show="isActive"` is a
       belt-and-suspenders guard on the same global-route signal. -->
  <aside v-show="isActive" class="variation-rail" :class="{ expanded: isExpanded }">
    <ion-toolbar class="rail-header">
      <ion-title size="small">{{ translate("Variations") }}</ion-title>
      <ion-buttons slot="end">
        <ion-button
          v-if="isExpanded"
          fill="clear"
          size="small"
          @click="minimize()"
        >
          <ion-icon slot="start" :icon="chevronDownOutline" />
          {{ translate("Minimize") }}
        </ion-button>
        <ion-button
          v-else
          fill="clear"
          size="small"
          @click="expand()"
        >
          <ion-icon slot="start" :icon="chevronUpOutline" />
          {{ translate("Expand") }}
        </ion-button>
      </ion-buttons>
    </ion-toolbar>

    <div v-show="isExpanded" class="rail-body">
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
    </div>
  </aside>

  <!-- Results of running the active variation (parent-vs-variation compare). This IS still an
       ion-modal (teleported), so it is force-closed by the isActive watcher when this page stops
       being the current route — otherwise it would leak over other pages just like the old rail. -->
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
import { useRouter } from "vue-router";
import { commonUtil, translate } from "@common";
import { alertController, IonButton, IonButtons, IonChip, IonContent, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonModal, IonNote, IonRadio, IonRadioGroup, IonSpinner, IonTitle, IonToolbar } from "@ionic/vue";
import { addCircleOutline, barChartOutline, chevronDownOutline, chevronUpOutline, pencilOutline, playOutline, refreshOutline, saveOutline, trashOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";
import SimulationResults from "@/components/simulation/SimulationResults.vue";

const props = defineProps({
  // The routing group this rail belongs to. Used to tell whether *this* detail page is the current
  // route (vs. a sibling detail page for a different group that is merely cached in the DOM).
  routingGroupId: { type: String, default: null }
});

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

// Expand/minimize is a plain reactive state now (no ion-modal breakpoints). Starts collapsed so the
// rail is an unobtrusive docked bar until the user opens it.
const isExpanded = ref(false);
const expand = () => { isExpanded.value = true; };
const minimize = () => { isExpanded.value = false; };

// Is this rail's own detail page the page the user is actually looking at right now? Ionic caches
// navigated-away pages in the DOM and freezes their per-page useRoute(); the router's GLOBAL
// currentRoute is the only signal that stays live inside a cached component. Match the exact detail
// path (so the `/routes/test` sibling and other tabs both read as inactive).
const router = useRouter();
const isActive = computed(() => {
  const path = router.currentRoute.value.path;
  return props.routingGroupId
    ? path === `/order-routing/${props.routingGroupId}`
    : /^\/order-routing\/[^/]+$/.test(path);
});

// When this page stops being the current route, force the (teleported) results modal shut so it
// can't linger over whatever page the user moved to. A standard modal tears down cleanly on
// is-open=false.
watch(isActive, (active) => {
  if (!active) showResults.value = false;
});

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
/* Docked panel pinned to the bottom-right of the routing detail page. It lives inside the ion-page,
   so Ionic's cached-page `display:none` hides it when you navigate away — no teleport, no zombie. */
.variation-rail {
  position: absolute;
  right: 16px;
  bottom: 0;
  z-index: 20;
  width: 360px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  background: var(--ion-background-color, #fff);
  border: 1px solid var(--ion-color-step-150, rgba(0, 0, 0, 0.12));
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

/* Collapsed = just the toolbar bar; expanded = grow up to most of the viewport with its own scroll. */
.variation-rail.expanded {
  max-height: 75vh;
}

.rail-header {
  --min-height: 48px;
  flex: 0 0 auto;
}

.rail-body {
  flex: 1 1 auto;
  overflow-y: auto;
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
