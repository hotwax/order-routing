<template>
  <!-- The sheet is teleported to the app root by Ionic, so visibility must follow the global
       current route rather than this cached page's mounted state. Only the active routing-group
       page opens a sheet; leaving the route closes and tears it down before another cached page
       can become active. backdropBreakpoint=1 keeps the routing canvas interactive at every stop. -->
  <ion-modal
    ref="modalRef"
    class="variation-modal"
    :is-open="isActive"
    :breakpoints="breakpoints"
    :initial-breakpoint="MIN_BP"
    :backdrop-breakpoint="1"
    :backdrop-dismiss="false"
    :can-dismiss="canDismissSheet"
    handle-behavior="cycle"
    @ionBreakpointDidChange="onBreakpointChange"
    @didDismiss="onSheetDismissed"
  >
    <ion-header>
      <ion-toolbar class="rail-header">
        <ion-title size="small">{{ translate("Simulation") }}</ion-title>
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
    </ion-header>

    <ion-content>
      <div class="rail-body">
      <div v-if="sim.groupLoadState === 'loading'" class="load-state">
        <ion-spinner name="dots" />
        <ion-note>{{ translate("Loading routing group and variations…") }}</ion-note>
      </div>
      <div v-else-if="sim.groupLoadState === 'error'" class="load-state error-state">
        <ion-note color="danger">{{ sim.loadError || translate("Failed to load routing group.") }}</ion-note>
        <ion-button size="small" fill="outline" @click="retryLoad()">{{ translate("Retry") }}</ion-button>
      </div>

      <template v-if="sim.isSimulationReady">
      <ion-radio-group v-if="hasSavedVariations" :value="radioSelected" @ionChange="selectVariation($event.detail.value)">
        <ion-item>
          <ion-radio value="" :disabled="isRunningAnySource || isSaving || sim.isSavingVariation" label-placement="end" justify="start">{{ translate("Baseline (live config)") }}</ion-radio>
        </ion-item>

        <ion-item v-for="v in sim.variations" :key="v.id">
          <ion-radio :value="v.id" :disabled="isRunningAnySource || isSaving || sim.isSavingVariation" label-placement="end" justify="start">{{ v.label }}</ion-radio>
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
          :disabled="isRunningAnySource || isSaving || sim.isSavingVariation || !interruptedVariationExists"
          @click="rerunInterruptedVariation()"
        >
          {{ translate("Run again") }}
        </ion-button>
      </ion-item>

      <!-- A variation is a branch from the currently selected source. Keep that relationship visible
           so "save as new" feels like an intentional simulation workflow, not a generic save form. -->
      <ion-list class="save-section" inset>
        <ion-item v-if="sim.activeVariationId" lines="none">
          <ion-icon slot="start" :icon="saveOutline" color="primary" />
          <ion-label class="ion-text-wrap">
            <h2>{{ sim.activeVariation?.label }}</h2>
            <p>{{ effectiveVariationDirty ? translate("Unsaved variation changes") : translate("Variation is up to date") }}</p>
          </ion-label>
        </ion-item>
        <div v-if="sim.activeVariationId" class="variation-save-actions">
          <ion-button
            fill="outline"
            size="small"
            :disabled="isRunningAnySource || isSaving || sim.isSavingVariation || !effectiveVariationDirty"
            @click="updateActive()"
          >
            {{ translate("Update") }}
          </ion-button>
          <ion-button
            fill="outline"
            size="small"
            color="danger"
            data-testid="discard-variation"
            :disabled="isRunningAnySource || isSaving || sim.isSavingVariation"
            @click="discardActive()"
          >
            <ion-icon slot="start" :icon="trashOutline" />
            {{ translate("Discard") }}
          </ion-button>
        </div>

        <ion-item v-if="hasSavedVariations" lines="none" class="branch-source">
          <ion-icon slot="start" :icon="gitBranchOutline" color="primary" />
          <ion-label class="ion-text-wrap">
            <p>{{ translate("Branch from") }}</p>
            <h2>{{ variationSourceLabel }}</h2>
          </ion-label>
          <ion-chip slot="end" :color="sim.activeVariationId ? 'primary' : 'medium'" :outline="true">
            <ion-label>{{ sim.activeVariationId ? translate("Saved variation") : translate("Live config") }}</ion-label>
          </ion-chip>
        </ion-item>

        <div class="branch-form">
          <ion-label class="ion-text-wrap">
            <h2>{{ translate("Create a variation") }}</h2>
            <p>{{ translate("Test a new routing idea without changing the live configuration.") }}</p>
          </ion-label>
          <ion-input
            v-model="newVariationName"
            fill="outline"
            :label="translate('Variation name')"
            label-placement="floating"
            :placeholder="translate('For example, faster west coast routing')"
            :disabled="isRunningAnySource || isSaving || sim.isSavingVariation || (!sim.activeVariationId && props.liveDirty)"
            enterkeyhint="done"
            data-testid="variation-name"
            @ionFocus="expandForNaming()"
            @keyup.enter="saveAsNew()"
          />
          <ion-button
            expand="block"
            color="primary"
            data-testid="create-variation"
            :disabled="!canSaveAsNew"
            @click="saveAsNew()"
          >
            <ion-icon slot="start" :icon="addCircleOutline" />
            {{ isSaving || sim.isSavingVariation ? translate("Creating variation…") : translate("Create variation") }}
          </ion-button>
        </div>

        <ion-item v-if="!hasSavedVariations" lines="none" class="branch-source">
          <ion-icon slot="start" :icon="gitBranchOutline" color="primary" />
          <ion-label class="ion-text-wrap">
            <p>{{ translate("Branch from") }}</p>
            <h2>{{ variationSourceLabel }}</h2>
          </ion-label>
          <ion-chip slot="end" color="medium" :outline="true">
            <ion-label>{{ translate("Live config") }}</ion-label>
          </ion-chip>
        </ion-item>
      </ion-list>

      <!-- Select a variation above, then act on it from this row. -->
      <div class="actions">
        <div class="action">
          <ion-fab-button class="success" size="small" :disabled="runDisabled" :aria-label="translate(sim.activeVariationId ? 'Run variation' : 'Run baseline')" @click="runSelectedSource()">
            <ion-spinner v-if="isRunningSelectedSource" name="dots" />
            <ion-icon v-else :icon="playOutline" />
          </ion-fab-button>
          <ion-note>{{ isRunningSelectedSource ? translate("Running…") : translate("Run") }}</ion-note>
        </div>
        <div class="action">
          <ion-fab-button size="small" :disabled="!hasResults" :aria-label="translate('View results')" @click="showResults = true">
            <ion-icon :icon="barChartOutline" />
          </ion-fab-button>
          <ion-note>{{ translate("Results") }}</ion-note>
        </div>
        <div class="action">
          <ion-fab-button size="small" :disabled="!sim.activeVariationId || sim.isRunningVariationRun || sim.isRunningBaselineRun || isSaving || sim.isSavingVariation" :aria-label="translate('Reset to baseline')" @click="resetToBaseline()">
            <ion-icon :icon="refreshOutline" />
          </ion-fab-button>
          <ion-note>{{ translate("Reset") }}</ion-note>
        </div>
      </div>
      </template>
      </div>
    </ion-content>
  </ion-modal>

  <!-- Results for the selected simulation source (baseline outcome or parent-vs-variation compare).
       This is still a teleported modal, so it is force-closed when this cached page stops being the
       current route; otherwise it could leak over another page just like the old rail. -->
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
import { alertController, IonButton, IonButtons, IonChip, IonContent, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonModal, IonNote, IonRadio, IonRadioGroup, IonSpinner, IonTitle, IonToolbar } from "@ionic/vue";
import { addCircleOutline, barChartOutline, chevronDownOutline, chevronUpOutline, gitBranchOutline, playOutline, refreshOutline, saveOutline, trashOutline } from "ionicons/icons";
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
const hasResults = computed(() => !!(
  sim.baselineRunResult
  || sim.isRunningBaselineRun
  || sim.baselineRunError
  || sim.variationRunResult
  || sim.isRunningVariationRun
  || sim.runCompareError
));
const effectiveVariationDirty = computed(() => !!sim.activeVariationId && (props.editorDirty || sim.isDirty));
const hasSavedVariations = computed(() => sim.variations.length > 0);
const isRunningAnySource = computed(() => sim.isRunningVariationRun || sim.isRunningBaselineRun);
const isRunningSelectedSource = computed(() => sim.activeVariationId ? sim.isRunningVariationRun : sim.isRunningBaselineRun);
const runDisabled = computed(() => !sim.isSimulationReady
  || isRunningAnySource.value
  || sim.isSavingVariation
  || (sim.activeVariationId ? effectiveVariationDirty.value : props.liveDirty));
const variationSourceLabel = computed(() => sim.activeVariation?.label || translate("Baseline"));
const canSaveAsNew = computed(() => !!newVariationName.value.trim()
  && !isRunningAnySource.value
  && !isSaving.value
  && !sim.isSavingVariation
  && !(!sim.activeVariationId && props.liveDirty));
const interruptedVariationExists = computed(() => !!sim.interruptedVariationRun
  && sim.variations.some((variation: any) => variation.id === sim.interruptedVariationRun?.variationId));
// Local mirror of the selected radio so a cancelled discard can visually revert it
// (binding directly to sim.activeVariationId wouldn't re-patch when it's unchanged).
const radioSelected = ref(sim.activeVariationId || "");
watch(() => sim.activeVariationId, (v) => { radioSelected.value = v || ""; });

// Native sheet stops: a tucked-away toolbar, a useful review height, and a near-full workspace.
// There is deliberately no zero breakpoint, so the user cannot swipe away a route-owned control.
const MIN_BP = 0.08;
const MAX_BP = 0.9;
const breakpoints = [MIN_BP, 0.5, MAX_BP];
const currentBreakpoint = ref(MIN_BP);
const modalRef = ref<InstanceType<typeof IonModal> | null>(null);
const isExpanded = computed(() => currentBreakpoint.value > MIN_BP);

function onBreakpointChange(event: CustomEvent<{ breakpoint: number }>) {
  currentBreakpoint.value = event.detail.breakpoint;
}

async function setBreakpoint(breakpoint: number) {
  // Update local presentation immediately; the native element then animates to the requested stop.
  currentBreakpoint.value = breakpoint;
  const modalElement = (modalRef.value?.$el || modalRef.value) as (HTMLElement & {
    setCurrentBreakpoint?: (value: number) => Promise<void>;
  }) | undefined;
  await modalElement?.setCurrentBreakpoint?.(breakpoint);
}

const expand = () => setBreakpoint(MAX_BP);
const minimize = () => setBreakpoint(MIN_BP);
const expandForNaming = () => currentBreakpoint.value === MIN_BP && setBreakpoint(0.5);

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

// Prevent Escape/backdrop/user gestures from orphaning a still-active sheet. Once the route changes,
// Ionic may dismiss it normally in response to is-open=false.
const canDismissSheet = () => !isActive.value;

function onSheetDismissed() {
  currentBreakpoint.value = MIN_BP;
}

// Both overlays are teleported. The main sheet follows isActive directly; the results overlay has
// its own state, so clear it explicitly and reset the next sheet presentation to its compact stop.
watch(isActive, (active) => {
  if (!active) {
    showResults.value = false;
    currentBreakpoint.value = MIN_BP;
  }
});

// Empty value is the baseline; anything else is a saved variation id.
// Switching discards the current working copy, so flush the editor's pending edits
// into `working` first (so the dirty check is accurate), then guard on unsaved changes.
async function selectVariation(id: string) {
  radioSelected.value = id;
  if (id === (sim.activeVariationId || "")) return;
  if (!sim.isSimulationReady || isRunningAnySource.value || isSaving.value || sim.isSavingVariation) {
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
  if (!sim.isSimulationReady || isRunningAnySource.value || isSaving.value || sim.isSavingVariation) return;
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
  if (!sim.isSimulationReady || !newVariationName.value.trim() || isRunningAnySource.value || isSaving.value || sim.isSavingVariation) return;
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
  if (!sim.isSimulationReady || !sim.activeVariationId || isRunningAnySource.value || isSaving.value || sim.isSavingVariation) return;
  isSaving.value = true;
  try {
    const isUpdated = await sim.updateVariation(sim.activeVariationId);
    commonUtil.showToast(isUpdated ? translate("Variation updated") : (sim.loadError || translate("Failed to update variation")));
  } finally {
    isSaving.value = false;
  }
}

async function discardActive() {
  if (!sim.isSimulationReady || !sim.activeVariationId || isRunningAnySource.value || isSaving.value || sim.isSavingVariation) return;
  const variationId = sim.activeVariationId;
  const alert = await alertController.create({
    header: translate("Discard variation?"),
    message: translate("This variation will be removed from the active simulation list. Its live baseline will not be changed."),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { text: translate("Discard"), role: "destructive" }
    ]
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== "destructive") return;

  isSaving.value = true;
  try {
    const discarded = await sim.discardVariation(variationId);
    commonUtil.showToast(discarded ? translate("Variation discarded") : (sim.loadError || translate("Failed to discard variation")));
  } finally {
    isSaving.value = false;
  }
}

async function runActiveVariation() {
  if (!sim.isSimulationReady || !sim.activeVariationId || isRunningAnySource.value || sim.isSavingVariation) return;
  sim.flushWorkingCopy();
  if (props.editorDirty || sim.isDirty) {
    commonUtil.showToast(translate("Update the variation before running it."));
    return;
  }
  await sim.runActiveVariation();
}

async function runSelectedSource() {
  if (sim.activeVariationId) {
    await runActiveVariation();
    return;
  }
  if (props.liveDirty) {
    commonUtil.showToast(translate("Save or discard live changes before running the baseline."));
    return;
  }
  await sim.runBaseline();
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
/* Keep the native sheet docked on the right instead of using Ionic's full-width centered default. */
.variation-modal {
  --width: 360px;
  --max-width: 90vw;
  --border-radius: 12px 12px 0 0;
}

.variation-modal::part(content) {
  right: var(--spacer-base);
  left: auto;
  margin-inline: 0;
}

.rail-header {
  --min-height: 48px;
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
  padding-block-end: var(--spacer-base);
}

.save-section {
  margin-block: var(--spacer-sm);
}

.variation-save-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacer-sm);
  padding: 0 var(--spacer-sm) var(--spacer-sm);
}

.variation-save-actions ion-button {
  margin: 0;
}

.branch-source ion-icon {
  align-self: flex-start;
  margin-block-start: var(--spacer-sm);
}

.branch-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-sm);
  padding: 0 var(--spacer-sm) var(--spacer-sm);
}

.branch-form h2,
.branch-form p {
  margin-block: 0 var(--spacer-2xs);
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
