// src/store/simulationStore.ts
import { acceptHMRUpdate, defineStore } from "pinia";
import { commonUtil, logger } from "@common";
import { SimulationService } from "../services/SimulationService";
import type { PersistedSimulation } from "../services/SimulationService";
import { orderRoutingStore } from "./orderRoutingStore";
import { VariationService } from "../services/VariationService";
import { normalizeRoutingGroupHierarchy } from "../utils/ruleUtil";
import { toConfigPayload, fromVariationRoutings, isEquivalentVariationConfig } from "../utils/variationUtils";
import type { Variation } from "../types/simulation";
import { SimulationStorage } from "../services/simulationStorage";
import { simulationSetupError } from "../services/SimulationSetupService";
import type { VariationRunRecoveryRecord } from "../services/simulationStorage";

const deepClone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));
const variationRunInterruptedMessage = (label: string) =>
  `The previous run for ${label || "this variation"} was interrupted before this browser received a result. `
  + "Its outcome is unknown because this browser did not receive a saved simulation ID it can open in history. It is safe to run the saved variation again.";

// Registered by the active simulation editor (RoutingGroupEditor in sandbox mode) so that variation saves
// triggered from OTHER components (e.g. the Variations sheet) still flush the editor's
// in-memory local state into `working` before it is snapshotted. Memory-only, no network.
// Null whenever no editor is mounted; the save then just uses `working` as-is.
let workingFlushHook: (() => void) | null = null;
export function registerWorkingFlushHook(fn: (() => void) | null) {
  workingFlushHook = fn;
  return () => {
    // Keyed editors can overlap briefly during remount. Only the instance that registered this
    // exact callback may clear it; an old instance must not unregister its replacement.
    if (workingFlushHook === fn) workingFlushHook = null;
  };
}

let groupLoadGeneration = 0;
let variationLoadGeneration = 0;
let variationRunGeneration = 0;
let variationMutationGeneration = 0;
let groupLoadController: AbortController | null = null;
let variationLoadController: AbortController | null = null;
let variationRunController: AbortController | null = null;

export const simulationStore = defineStore("simulation", {
  state: () => ({
    routingGroupId: "" as string,
    baseline: null as any,
    working: null as any,
    variations: [] as Variation[],
    activeVariationId: "" as string,
    groupLoadState: "idle" as "idle" | "loading" | "ready" | "error",
    loadError: null as string | null,
    lastSimulationId: null as string | null,
    currentRun: null as PersistedSimulation | null,
    isRunningVariationRun: false,
    isRunningBaselineRun: false,
    isSavingVariation: false,
    runCompareError: null as string | null,
    baselineRunError: null as string | null,
    interruptedVariationRun: null as VariationRunRecoveryRecord | null,
  }),
  getters: {
    isSimulationReady: (s) => s.groupLoadState === "ready" && !!s.baseline && !!s.working,
    // The variation the working copy was loaded from (null = editing a fresh draft off baseline).
    activeVariation: (s) => s.variations.find((v) => v.id === s.activeVariationId) || null,
    // True when the working copy differs from its source (the loaded variation, or baseline).
    isDirty: (s) => {
      const source = s.activeVariationId
        ? s.variations.find((v) => v.id === s.activeVariationId)?.group
        : s.baseline;
      return !isEquivalentVariationConfig(s.working, source);
    },
  },
  actions: {
    hasUnresolvedLiveDraft(): boolean {
      const liveGroup = orderRoutingStore().currentGroup;
      return String(liveGroup?.routingGroupId || "") === String(this.routingGroupId || "")
        && Boolean(liveGroup?.isNew || liveGroup?.hasUnsavedChanges);
    },
    async fetchSimGroupDetail(routingGroupId: string, signal?: AbortSignal): Promise<any> {
      const group = await SimulationService.fetchRoutingGroupDetail(routingGroupId, signal);
      return normalizeRoutingGroupHierarchy(group);
    },

    // ---- Simulate-tab actions ----
    async loadGroup(routingGroupId: string) {
      const generation = ++groupLoadGeneration;
      groupLoadController?.abort();
      variationLoadController?.abort();
      variationRunController?.abort();
      groupLoadController = new AbortController();
      const signal = groupLoadController.signal;
      ++variationLoadGeneration;
      ++variationRunGeneration;
      ++variationMutationGeneration;
      this.routingGroupId = routingGroupId;
      this.groupLoadState = "loading";
      this.loadError = null;
      this.baseline = null;
      this.working = null;
      this.variations = [];
      this.activeVariationId = "";
      this.lastSimulationId = null;
      this.currentRun = null;
      this.runCompareError = null;
      this.baselineRunError = null;
      this.interruptedVariationRun = null;
      this.isRunningVariationRun = false;
      this.isRunningBaselineRun = false;
      this.isSavingVariation = false;
      try {
        const group = await this.fetchSimGroupDetail(routingGroupId, signal);
        if (generation !== groupLoadGeneration) return false;
        if (!group?.routingGroupId) {
          throw new Error(`Routing group ${routingGroupId} could not be loaded.`);
        }
        this.baseline = deepClone(group);
        this.working = deepClone(group);
        const variations = await this.fetchServerVariations(routingGroupId, signal);
        if (generation !== groupLoadGeneration) return false;
        this.variations = variations;
        this.groupLoadState = "ready";
        this.restoreVariationRunInterruption(routingGroupId);
        return true;
      } catch (e: any) {
        if (generation === groupLoadGeneration) {
          this.loadError = simulationSetupError(e);
          this.groupLoadState = "error";
          this.baseline = null;
          this.working = null;
          this.variations = [];
        }
        return false;
      }
    },
    // Load variations from the open Sim Routing datastore for the parent group.
    async fetchServerVariations(parentRoutingGroupId: string, signal?: AbortSignal): Promise<Variation[]> {
      const list = await VariationService.listVariations(parentRoutingGroupId, signal);
      return list
        .filter((v) => v.statusId !== "VAR_ARCHIVED")
        .map((v) => ({ id: v.variationGroupId, label: v.variationName || v.variationGroupId, group: null, serverVid: v.variationGroupId }));
    },
    // A reload can interrupt polling after submission. Preserve the accepted run ID when known;
    // otherwise warn that the browser cannot determine whether the submission reached Sim Routing.
    restoreVariationRunInterruption(routingGroupId: string): boolean {
      const stored = SimulationStorage.getVariationRun(routingGroupId);
      if (!stored) {
        this.interruptedVariationRun = null;
        return false;
      }
      const interrupted: VariationRunRecoveryRecord = stored.status === "interrupted"
        ? stored
        : { ...stored, status: "interrupted", interruptedAt: Date.now() };
      SimulationStorage.setVariationRun(interrupted);
      this.interruptedVariationRun = interrupted;
      this.isRunningVariationRun = false;
      this.lastSimulationId = interrupted.simulationId || null;
      this.runCompareError = interrupted.simulationId
        ? `Simulation ${interrupted.simulationId} was submitted. Open its saved result to check the latest status before running it again.`
        : variationRunInterruptedMessage(interrupted.variationLabel);
      return true;
    },
    // Persist the current working copy as a NEW Sim Routing variation. Returns true on success so
    // callers only report success when the save actually reached the backend.
    async saveAsVariation(label: string): Promise<boolean> {
      if (!this.activeVariationId && this.hasUnresolvedLiveDraft()) {
        this.loadError = "Save or discard live changes before creating a variation.";
        return false;
      }
      if (!this.isSimulationReady || this.isSavingVariation) {
        this.loadError = this.loadError || "Wait for the routing group and variations to finish loading.";
        return false;
      }
      const generation = ++variationMutationGeneration;
      const parentId = this.routingGroupId;
      let createdVariationId = "";
      this.isSavingVariation = true;
      try {
        workingFlushHook?.();
        createdVariationId = await VariationService.createVariation(parentId, label);
        const tree = await VariationService.replaceVariationConfig(createdVariationId, toConfigPayload(this.working?.routings ?? []));
        if (generation !== variationMutationGeneration || this.routingGroupId !== parentId || this.groupLoadState !== "ready") return false;
        const group = { ...deepClone(this.working), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: createdVariationId };
        this.variations.push({ id: createdVariationId, label: label || tree?.variationName || createdVariationId, group, serverVid: createdVariationId });
        this.clearRunResults(); // new variation becomes active — don't attribute a prior run's results to it
        this.activeVariationId = createdVariationId;
        this.working = deepClone(group);
        return true;
      } catch (err: any) {
        logger.error(err);
        if (generation === variationMutationGeneration && this.routingGroupId === parentId) {
          if (createdVariationId) {
            try {
              await VariationService.deleteVariation(createdVariationId);
            } catch (cleanupError) {
              // Older deployments may not have the discard endpoint yet. Refresh so a partially-created
              // variation is still visible and recoverable instead of being silently orphaned.
              logger.error(cleanupError);
              try {
                this.variations = await this.fetchServerVariations(parentId);
              } catch (refreshError) {
                logger.error(refreshError);
              }
            }
            this.loadError = `Variation ${createdVariationId} could not be configured. Retry after the backend is healthy.`;
          } else {
            this.loadError = simulationSetupError(err);
          }
        }
        return false;
      } finally {
        if (generation === variationMutationGeneration) this.isSavingVariation = false;
      }
    },
    // Discard a saved variation. Sim Routing deletes its registry row and cloned config tree,
    // while refusing a production group without a variation registry row. If the active variation
    // is discarded, return the canvas to the live baseline as the rail row is removed.
    async discardVariation(id: string): Promise<boolean> {
      if (!this.isSimulationReady || this.isSavingVariation || this.isRunningVariationRun || this.isRunningBaselineRun) return false;
      const variation = this.variations.find((candidate) => candidate.id === id);
      if (!variation?.serverVid) return false;
      const generation = ++variationMutationGeneration;
      const parentId = this.routingGroupId;
      this.isSavingVariation = true;
      this.loadError = null;
      try {
        await VariationService.deleteVariation(variation.serverVid);
        if (generation !== variationMutationGeneration || this.routingGroupId !== parentId || this.groupLoadState !== "ready") return false;

        this.variations = this.variations.filter((candidate) => candidate.id !== id);
        if (this.interruptedVariationRun?.variationId === id) {
          SimulationStorage.clearVariationRun(parentId);
          this.interruptedVariationRun = null;
        }
        if (this.activeVariationId === id) {
          this.activeVariationId = "";
          this.working = deepClone(this.baseline);
          this.clearRunResults();
        }
        return true;
      } catch (err: any) {
        logger.error(err);
        if (generation === variationMutationGeneration && this.routingGroupId === parentId) {
          this.loadError = simulationSetupError(err);
        }
        return false;
      } finally {
        if (generation === variationMutationGeneration) this.isSavingVariation = false;
      }
    },
    // Overwrite an existing Sim Routing variation with the current working copy.
    async updateVariation(id: string): Promise<boolean> {
      if (!this.isSimulationReady || this.isSavingVariation) return false;
      workingFlushHook?.();
      const v = this.variations.find((x) => x.id === id);
      if (!v?.serverVid) return false;
      const generation = ++variationMutationGeneration;
      const parentId = this.routingGroupId;
      this.isSavingVariation = true;
      try {
        const tree = await VariationService.replaceVariationConfig(v.serverVid, toConfigPayload(this.working?.routings ?? []));
        if (generation !== variationMutationGeneration || this.routingGroupId !== parentId || this.activeVariationId !== id) return false;
        v.group = { ...deepClone(this.working), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: v.serverVid };
        this.working = deepClone(v.group);
        return true;
      } catch (err: any) {
        logger.error(err);
        if (generation === variationMutationGeneration && this.routingGroupId === parentId) {
          this.loadError = simulationSetupError(err);
        }
        return false;
      } finally {
        if (generation === variationMutationGeneration) this.isSavingVariation = false;
      }
    },
    // Open a variation in the canvas: use the cached tree or fetch it from Sim Routing (lazy).
    async loadVariation(id: string): Promise<boolean> {
      if (!this.activeVariationId && this.hasUnresolvedLiveDraft()) {
        this.loadError = "Save or discard live changes before opening a variation.";
        commonUtil.showToast(this.loadError);
        return false;
      }
      if (!this.isSimulationReady || this.isSavingVariation) return false;
      const generation = ++variationLoadGeneration;
      variationLoadController?.abort();
      variationLoadController = new AbortController();
      const signal = variationLoadController.signal;
      ++variationRunGeneration;
      variationRunController?.abort();
      const parentId = this.routingGroupId;
      const v = this.variations.find((x) => x.id === id);
      if (!v) return false;
      const previousActiveVariationId = this.activeVariationId;
      try {
        let loadedGroup = v.group ? deepClone(v.group) : null;
        if (!v.group && v.serverVid) {
          const tree = await VariationService.getVariation(v.serverVid, signal);
          loadedGroup = { ...deepClone(this.baseline), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: v.serverVid };
        }
        if (generation !== variationLoadGeneration || this.routingGroupId !== parentId || this.groupLoadState !== "ready") return false;
        if (loadedGroup) {
          v.group = deepClone(loadedGroup);
          if (id !== previousActiveVariationId) this.clearRunResults();
          this.activeVariationId = id;
          this.working = deepClone(loadedGroup);
          this.isRunningVariationRun = false;
          return true;
        }
        return false;
      } catch (err: any) {
        if (generation !== variationLoadGeneration || this.routingGroupId !== parentId) return false;
        logger.error(err);
        const message = simulationSetupError(err);
        this.loadError = message;
        // Surface the failure — otherwise a thrown getVariation silently leaves the
        // canvas on the previous copy, which reads as "the variation didn't load".
        commonUtil.showToast(message);
        return false;
      }
    },
    // Run the selected live baseline as a persisted Sim Routing simulation.
    async runBaseline() {
      workingFlushHook?.();
      if (!this.isSimulationReady) {
        this.baselineRunError = "Wait for the routing group and variations to finish loading.";
        commonUtil.showToast(this.baselineRunError);
        return false;
      }
      if (this.activeVariationId) {
        this.baselineRunError = "Select Baseline before running it.";
        commonUtil.showToast(this.baselineRunError);
        return false;
      }
      if (this.hasUnresolvedLiveDraft() || this.isDirty) {
        this.baselineRunError = "Save or discard live changes before running the baseline.";
        commonUtil.showToast(this.baselineRunError);
        return false;
      }
      if (this.isRunningBaselineRun || this.isRunningVariationRun) return false;

      const generation = ++variationRunGeneration;
      variationRunController?.abort();
      variationRunController = new AbortController();
      const signal = variationRunController.signal;
      const parentId = this.routingGroupId;
      this.clearRunResults();
      this.isRunningBaselineRun = true;
      try {
        const submitted = await SimulationService.submitSimulation([parentId]);
        if (generation !== variationRunGeneration || this.routingGroupId !== parentId) return false;
        this.lastSimulationId = submitted.simulationId;
        const run = await SimulationService.waitForSimulation(submitted.simulationId, (update) => {
          if (generation === variationRunGeneration && this.routingGroupId === parentId) this.currentRun = update;
        }, signal);
        if (generation !== variationRunGeneration || this.routingGroupId !== parentId || this.activeVariationId) return false;
        const baseline = run.variants.find((variant) => variant.isBaseline === "Y") || run.variants[0];
        if (!baseline) throw new Error("Simulation finished without a baseline result.");
        return true;
      } catch (error: any) {
        if (generation === variationRunGeneration && this.routingGroupId === parentId && !this.activeVariationId) {
          this.baselineRunError = simulationSetupError(error);
        }
        return false;
      } finally {
        if (generation === variationRunGeneration) this.isRunningBaselineRun = false;
      }
    },
    // Submit baseline and the selected saved variation as one persisted async simulation.
    async runActiveVariation() {
      workingFlushHook?.();
      if (!this.isSimulationReady) {
        this.runCompareError = "Wait for the routing group and variations to finish loading.";
        commonUtil.showToast(this.runCompareError);
        return false;
      }
      if (this.isDirty) {
        this.runCompareError = "Update the variation before running it.";
        commonUtil.showToast(this.runCompareError);
        return false;
      }
      if (this.isRunningBaselineRun || this.isRunningVariationRun) return false;
      const v = this.activeVariationId ? this.variations.find((x) => x.id === this.activeVariationId) : null;
      if (!v?.serverVid) { this.runCompareError = "Save the variation before running it."; return false; }
      const generation = ++variationRunGeneration;
      variationRunController?.abort();
      variationRunController = new AbortController();
      const signal = variationRunController.signal;
      const variationId = v.id;
      this.clearRunResults();
      this.isRunningVariationRun = true;
      const parentId = this.routingGroupId;
      const recoveryRecord: VariationRunRecoveryRecord = {
        routingGroupId: parentId,
        variationId,
        serverVariationId: v.serverVid,
        variationLabel: v.label || v.serverVid,
        startedAt: Date.now(),
        status: "running",
      };
      SimulationStorage.setVariationRun(recoveryRecord);
      this.interruptedVariationRun = null;
      let acceptedSimulationId: string | undefined;
      try {
        const submitted = await SimulationService.submitSimulation([parentId, v.serverVid]);
        if (generation !== variationRunGeneration || this.routingGroupId !== parentId) return false;
        acceptedSimulationId = submitted.simulationId;
        this.lastSimulationId = submitted.simulationId;
        SimulationStorage.setVariationRun({ ...recoveryRecord, simulationId: submitted.simulationId });
        const run = await SimulationService.waitForSimulation(submitted.simulationId, (update) => {
          if (generation === variationRunGeneration && this.routingGroupId === parentId) this.currentRun = update;
        }, signal);
        if (generation !== variationRunGeneration || this.routingGroupId !== parentId || this.activeVariationId !== variationId) return false;
        const baseline = run.variants.find((variant) => variant.isBaseline === "Y") || run.variants[0];
        const variation = run.variants.find((variant) => variant.isBaseline !== "Y") || run.variants[1];
        if (!baseline || !variation) throw new Error("Simulation finished without both comparison results.");
        // Clear the durable marker only after the canonical group result and optional history id
        // have been adopted by the still-current editor. Older id-less successes remain valid.
        SimulationStorage.clearVariationRun(parentId);
        this.interruptedVariationRun = null;
        return true;
      } catch (e: any) {
        if (generation === variationRunGeneration && this.routingGroupId === parentId && this.activeVariationId === variationId) {
          // The status read already proved a terminal failure. Keep its persisted result visible,
          // but do not present it as a lost/unknown run that the user should blindly rerun.
          if (["BRSIM_FAILED", "BRSIM_COMPLETE"].includes(this.currentRun?.simulation?.statusId || "")) {
            SimulationStorage.clearVariationRun(parentId);
            this.interruptedVariationRun = null;
            this.runCompareError = simulationSetupError(e);
          } else {
            const interrupted: VariationRunRecoveryRecord = {
              ...recoveryRecord,
              simulationId: acceptedSimulationId,
              status: "interrupted",
              interruptedAt: Date.now(),
              lastError: simulationSetupError(e),
            };
            SimulationStorage.setVariationRun(interrupted);
            this.interruptedVariationRun = interrupted;
            this.runCompareError = interrupted.simulationId
              ? `The run did not finish loading here. Open saved simulation ${interrupted.simulationId} to check its status.`
              : variationRunInterruptedMessage(interrupted.variationLabel);
          }
        }
        return false;
      } finally {
        if (generation === variationRunGeneration) this.isRunningVariationRun = false;
      }
    },
    resetWorkingToBaseline() {
      ++variationLoadGeneration;
      ++variationRunGeneration;
      variationLoadController?.abort();
      variationRunController?.abort();
      this.working = deepClone(this.baseline);
      this.activeVariationId = "";
      this.isRunningVariationRun = false;
      this.isRunningBaselineRun = false;
      this.clearRunResults();
    },
    // Run results belong to the selected source; clear them when it changes.
    clearRunResults() {
      this.runCompareError = null;
      this.baselineRunError = null;
      this.lastSimulationId = null;
      this.currentRun = null;
    },
    // Flush the active editor's in-memory local state into `working` (via the registered
    // hook) so callers outside the editor — e.g. the Variations sheet's dirty check — see
    // an accurate `working`/`isDirty` before deciding to discard it.
    flushWorkingCopy() {
      workingFlushHook?.();
    },
  },
});

// Hot-reload the store definition (new getters/actions) without a full page refresh during dev.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(simulationStore, import.meta.hot));
}
