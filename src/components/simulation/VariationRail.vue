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
      <div v-if="sim.groupLoadState === 'loading'" class="load-state">
        <ion-spinner name="dots" />
        <ion-note>{{ translate("Loading routing group and variations…") }}</ion-note>
      </div>
      <div v-else-if="sim.groupLoadState === 'error'" class="load-state error-state">
        <ion-note color="danger">{{ sim.loadError || translate("Failed to load routing group.") }}</ion-note>
        <ion-button size="small" fill="outline" @click="retryLoad()">{{ translate("Retry") }}</ion-button>
      </div>

      <template v-if="sim.isSimulationReady">
      <ion-radio-group :value="radioSelected" @ionChange="selectVariation($event.detail.value)">
        <ion-item>
          <ion-radio value="" :disabled="sim.isRunningVariationRun || isSaving || sim.isSavingVariation" label-placement="end" justify="start">{{ translate("Baseline (live config)") }}</ion-radio>
        </ion-item>

        <ion-item v-for="v in sim.variations" :key="v.id">
          <ion-radio :value="v.id" :disabled="sim.isRunningVariationRun || isSaving || sim.isSavingVariation" label-placement="end" justify="start">{{ v.label }}</ion-radio>
        </ion-item>
      </ion-radio-group>

      <ion-item v-if="sim.interruptedVariationRun" class="interrupted-run" lines="none" color="warning">
        <ion-label class="ion-text-wrap">
          <strong>{{ translate("Previous run outcome unknown") }}</strong>
          <p>{{ sim.runCompareError }}</p>
        </ion-label>
        <ion-button
          slot="end"
          size="small"
          data-testid="rerun-interrupted-variation"
          :disabled="sim.isRunningVariationRun || isSaving || sim.isSavingVariation || !interruptedVariationExists"
          @click="rerunInterruptedVariation()"
        >
          {{ translate("Run again") }}
        </ion-button>
      </ion-item>

      <!-- Editing status + save-changes workflow: update the active variation, or save the current
           working copy as a brand-new variation named inline. Replaces the old inline canvas card. -->
      <div class="save-section">
        <ion-chip :color="sim.activeVariationId ? 'primary' : 'medium'" :outline="true">
          <ion-label>
            <template v-if="sim.activeVariationId">{{ translate("Editing:") }} {{ sim.activeVariation?.label }}</template>
            <template v-else>{{ translate("New variation (from Baseline)") }}</template>
            <template v-if="effectiveVariationDirty"> — {{ translate("unsaved changes") }}</template>
          </ion-label>
        </ion-chip>

        <ion-button
          v-if="sim.activeVariationId"
          expand="block"
          size="small"
          color="primary"
          :disabled="isSaving || sim.isSavingVariation"
          @click="updateActive()"
        >
          <ion-icon slot="start" :icon="saveOutline" />
          {{ translate("Update") }} {{ sim.activeVariation?.label }}
        </ion-button>

        <div class="create-row">
          <ion-input
            v-model="newVariationName"
            :placeholder="translate('New variation name')"
            :disabled="isSaving || sim.isSavingVariation || (!sim.activeVariationId && props.liveDirty)"
            @keyup.enter="saveAsNew()"
          />
          <ion-button
            size="small"
            :fill="sim.activeVariationId ? 'outline' : 'solid'"
            color="primary"
            :disabled="isSaving || sim.isSavingVariation"
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
          <ion-fab-button class="success" size="small" :disabled="!sim.activeVariationId || sim.isRunningVariationRun || sim.isSavingVariation || effectiveVariationDirty" :aria-label="translate('Run variation')" @click="runActiveVariation()">
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
          <ion-fab-button size="small" :disabled="!sim.activeVariationId || sim.isRunningVariationRun || isSaving || sim.isSavingVariation" :aria-label="translate('Reset to baseline')" @click="resetToBaseline()">
            <ion-icon :icon="refreshOutline" />
          </ion-fab-button>
          <ion-note>{{ translate("Reset") }}</ion-note>
        </div>
      </div>
      </template>
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
import { addCircleOutline, barChartOutline, chevronDownOutline, chevronUpOutline, playOutline, refreshOutline, saveOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";
import SimulationResults from "@/components/simulation/SimulationResults.vue";

const props = defineProps({
  // The routing group this rail belongs to. Used to tell whether *this* detail page is the current
  // route (vs. a sibling detail page for a different group that is merely cached in the DOM).
  routingGroupId: { type: String, default: null },
  // Live edits belong to orderRoutingStore, not simulationStore. Do not let selecting a variation
  // remount the editor and discard them; the user must resolve the live draft first.
  liveDirty: { type: Boolean, default: false },
  // Sandbox editor refs are flushed lazily into sim.working. Include the editor signal when gating
  // destructive switches and Run so the visible canvas can never diverge from the invoked version.
  editorDirty: { type: Boolean, default: false }
});

const sim = simulationStore();

const newVariationName = ref("");
const isSaving = ref(false);
// Results modal for the active variation's run (compare vs. live parent). Enabled once a run has
// been kicked off — while running, on success, or on error — so the user can open it to watch/read.
const showResults = ref(false);
const hasResults = computed(() => !!(sim.variationRunResult || sim.isRunningVariationRun || sim.runCompareError));
const effectiveVariationDirty = computed(() => !!sim.activeVariationId && (props.editorDirty || sim.isDirty));
const interruptedVariationExists = computed(() => !!sim.interruptedVariationRun
  && sim.variations.some((variation: any) => variation.id === sim.interruptedVariationRun?.variationId));
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
  if (!sim.isSimulationReady || sim.isRunningVariationRun || isSaving.value || sim.isSavingVariation) {
    radioSelected.value = sim.activeVariationId || "";
    commonUtil.showToast(translate("Wait for the current variation operation to finish."));
    return;
  }
  if (!sim.activeVariationId && id && props.liveDirty) {
    radioSelected.value = "";
    commonUtil.showToast(translate("Save or discard live changes before opening a variation."));
    return;
  }
  sim.flushWorkingCopy();
  if ((props.editorDirty || sim.isDirty) && !(await confirmDiscard())) {
    radioSelected.value = sim.activeVariationId || ""; // revert the radio to the still-active variation
    return;
  }
  if (id) {
    const loaded = await sim.loadVariation(id);
    if (!loaded) radioSelected.value = sim.activeVariationId || "";
  } else {
    sim.resetWorkingToBaseline();
  }
}

// Reset also discards the working copy; same flush-then-guard.
async function resetToBaseline() {
  if (!sim.isSimulationReady || sim.isRunningVariationRun || isSaving.value || sim.isSavingVariation) return;
  sim.flushWorkingCopy();
  if ((props.editorDirty || sim.isDirty) && !(await confirmDiscard())) return;
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
  if (!sim.isSimulationReady || isSaving.value || sim.isSavingVariation) return;
  if (!sim.activeVariationId && props.liveDirty) {
    commonUtil.showToast(translate("Save or discard live changes before creating a variation."));
    return;
  }
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
  if (!sim.isSimulationReady || !sim.activeVariationId || isSaving.value || sim.isSavingVariation) return;
  isSaving.value = true;
  try {
    const isUpdated = await sim.updateVariation(sim.activeVariationId);
    commonUtil.showToast(isUpdated ? translate("Variation updated") : (sim.loadError || translate("Failed to update variation")));
  } finally {
    isSaving.value = false;
  }
}

async function runActiveVariation() {
  if (!sim.isSimulationReady || !sim.activeVariationId || sim.isRunningVariationRun || sim.isSavingVariation) return;
  sim.flushWorkingCopy();
  if (props.editorDirty || sim.isDirty) {
    commonUtil.showToast(translate("Update the variation before running it."));
    return;
  }
  await sim.runActiveVariation();
}

async function rerunInterruptedVariation() {
  const interrupted = sim.interruptedVariationRun;
  if (!interrupted || !interruptedVariationExists.value) {
    commonUtil.showToast(translate("The saved variation for this interrupted run is no longer available."));
    return;
  }
  if (sim.activeVariationId !== interrupted.variationId) {
    await selectVariation(interrupted.variationId);
  }
  if (sim.activeVariationId === interrupted.variationId) await runActiveVariation();
}

async function retryLoad() {
  const groupId = props.routingGroupId || sim.routingGroupId;
  if (groupId && sim.groupLoadState !== "loading") await sim.loadGroup(groupId);
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

.load-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
}

.error-state {
  align-items: flex-start;
  flex-direction: column;
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
