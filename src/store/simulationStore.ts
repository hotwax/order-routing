// src/store/simulationStore.ts
import { acceptHMRUpdate, defineStore } from "pinia";
import { commonUtil, logger } from "@common";
import { productStore } from "./productStore";
import { buildVariant, isNoOp, applyProductStoreId, chunkVariants, mergeVariationResults } from "../utils/simulationCompute";
import { isRecoverableSimulationPollError, SimulationService } from "../services/SimulationService";
import { simProductStoreId } from "../utils/simConfig";
import { orderRoutingStore } from "./orderRoutingStore";
import { VariationService } from "../services/VariationService";
import { normalizeRoutingGroupHierarchy } from "../utils/ruleUtil";
import { toConfigPayload, fromVariationRoutings, buildRoutingNameMap, isEquivalentVariationConfig, sortBySequence } from "../utils/variationUtils";
import { joinRoutingResults } from "../utils/simulationResults";
import { mergeEvents } from "../utils/simulationCompute";
import { BatchProgress, Variation, VariationRunState } from "../types/simulation";
import { CompareRow, GroupRunResult, VariationListItem, VariationRouting, VariationRule, VariationTree } from "../types/variation";
import type { VariationConditionInput, VariationActionInput } from "../types/variation";
import { SimulationStorage } from "../services/simulationStorage";
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
let batchRunGeneration = 0;
let groupLoadController: AbortController | null = null;
let variationLoadController: AbortController | null = null;
let variationRunController: AbortController | null = null;
let batchRunController: AbortController | null = null;

const zeroedBatch = (batchIndex: number): BatchProgress => ({
  batchIndex, phaseLabel: "", phaseIndex: 0, phaseCount: 0,
  ordersInScope: 0, ordersProcessed: 0, brokered: 0, queued: 0, events: [],
});

export const simulationStore = defineStore("simulation", {
  state: () => ({
    // ---- Simulate-tab (canvas + batch submission) ----
    routingGroupId: "" as string,
    // The routing-group list for the picker, fetched from the simulation backend — kept
    // here, not in the shared orderRoutingStore, so the simulate tab never reads/writes OMS group state.
    simGroups: [] as any[],
    baseline: null as any,
    working: null as any,
    variations: [] as Variation[],
    activeVariationId: "" as string,
    runStates: [] as VariationRunState[],
    batchProgress: [] as BatchProgress[],
    results: null as {
      baseline: any;
      variants: any[];
      partial: boolean;
      simulationRan?: boolean;
      identity?: { kind: "baseline" | "variation"; label: string; routingGroupId: string; variationGroupId?: string };
    } | null,
    isRunning: false,
    groupLoadState: "idle" as "idle" | "loading" | "ready" | "error",
    loadError: null as string | null,
    // Which pane is shown. User-controlled so the editor and the (possibly still-running)
    // simulation can be switched between freely — the run continues in the background.
    view: "editor" as any,
    // The persisted simulationId of the most recently completed run (backend R3), for deep-linking.
    lastSimulationId: null as string | null,
    // ---- H2 variation run + parent compare (persist-on-save flow) ----
    variationRunResult: null as GroupRunResult | null,
    baselineRunResult: null as GroupRunResult | null,
    parentRunByGroupId: {} as Record<string, GroupRunResult>, // session cache, keyed by parent group id
    parentRunProgress: null as any,
    isRunningVariationRun: false,
    isRunningBaselineRun: false,
    isSavingVariation: false,
    runCompareError: null as string | null,
    baselineRunError: null as string | null,
    interruptedVariationRun: null as VariationRunRecoveryRecord | null,

    // ---- Variation Editor (optimistic-write, per-node save) ----
    parentRoutingGroupId: "" as string,
    // Flat server list for the variation picker.
    variationList: [] as VariationListItem[],
    listLoading: false,
    tree: null as VariationTree | null,
    // Per-node saving status keyed by a stable node key (routingId / routingId:ruleId / ...:seqId).
    saving: {} as Record<string, "saving" | "error">,
    isRunningVariation: false,
    isRunningParent: false,
    variationResult: null as GroupRunResult | null,
    parentResultByParentId: {} as Record<string, GroupRunResult>, // session cache, keyed by parent id
    runError: null as string | null,
    parentProgress: null as any,
  }),
  getters: {
    // ---- Simulate-tab getters ----
    getSimGroups: (s) => s.simGroups,
    canSubmit: (s) => s.variations.length > 0 && !s.isRunning,
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
    // Per-routing parent-vs-variation comparison rows for the active H2 variation run (canvas flow).
    variationCompareRows(s): CompareRow[] {
      const parent = s.parentRunByGroupId[s.routingGroupId];
      if (!s.variationRunResult || !parent) return [];
      const names = { ...buildRoutingNameMap({ routings: s.baseline?.routings ?? [] }), ...buildRoutingNameMap({ routings: s.working?.routings ?? [] }) };
      return joinRoutingResults({
        variationGroupId: s.variationRunResult.routingGroupId,
        parentResults: parent.routingResults ?? [],
        variationResults: s.variationRunResult.routingResults ?? [],
        routingNameById: names,
      });
    },

    // ---- Variation Editor getters ----
    routingNameById: (s): Record<string, string> => (s.tree ? buildRoutingNameMap(s.tree) : {}),
    // Routings sorted by sequence for the editor.
    sortedRoutings: (s): VariationRouting[] => (s.tree ? sortBySequence(s.tree.routings) : []),
    compareRows(s): CompareRow[] {
      const parent = s.parentResultByParentId[s.parentRoutingGroupId];
      if (!s.variationResult || !parent) return [];
      return joinRoutingResults({
        variationGroupId: s.variationResult.routingGroupId,
        parentResults: parent.routingResults,
        variationResults: s.variationResult.routingResults,
        routingNameById: this.routingNameById,
      });
    },
  },
  actions: {
    hasUnresolvedLiveDraft(): boolean {
      const liveGroup = orderRoutingStore().currentGroup;
      return String(liveGroup?.routingGroupId || "") === String(this.routingGroupId || "")
        && Boolean(liveGroup?.isNew || liveGroup?.hasUnsavedChanges);
    },
    // THE product-store resolution for the simulate tab — every sim call site (group list, past list,
    // submit) funnels through here so the precedence lives in one place.
    // Precedence: the configured sim store (VITE_SIM_PRODUCT_STORE_ID) > caller-supplied > OMS currentEComStore.
    resolveProductStoreId(prefer?: string): string {
      return simProductStoreId() || prefer || productStore().getCurrentEComStore?.productStoreId || "";
    },
    // Routing-group list for the picker, pulled from the sim instance via api. Errors are logged
    // and leave the list empty — callers must not blow up on a sim outage.
    async fetchSimGroups(signal?: AbortSignal) {
      try {
        const groups = await SimulationService.fetchRoutingGroups(this.resolveProductStoreId(), signal);
        if (!signal?.aborted) this.simGroups = groups;
      } catch (err) {
        if (signal?.aborted) throw err;
        logger.error(err);
        this.simGroups = [];
      }
    },

    async fetchSimGroupDetail(routingGroupId: string, signal?: AbortSignal): Promise<any> {
      let group = (this.simGroups || []).find((g: any) => g.routingGroupId === routingGroupId);
      if (group?.isNew) {
        throw new Error("Save this routing group before creating or running variations.");
      }

      group = await SimulationService.fetchRoutingGroupDetail(routingGroupId, signal);
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
      ++batchRunGeneration;
      (batchRunController as AbortController | null)?.abort();
      this.routingGroupId = routingGroupId;
      this.groupLoadState = "loading";
      this.loadError = null;
      this.baseline = null;
      this.working = null;
      this.variations = [];
      this.activeVariationId = "";
      this.results = null;
      this.lastSimulationId = null;
      this.runStates = [];
      this.batchProgress = [];
      this.variationRunResult = null;
      this.baselineRunResult = null;
      this.runCompareError = null;
      this.baselineRunError = null;
      this.interruptedVariationRun = null;
      this.parentRunProgress = null;
      this.isRunningVariationRun = false;
      this.isRunningBaselineRun = false;
      this.isSavingVariation = false;
      this.isRunning = false;
      delete this.parentRunByGroupId[routingGroupId];
      try {
        if (!this.simGroups?.length) {
          await this.fetchSimGroups(signal);
        }
        if (generation !== groupLoadGeneration) return false;
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
          this.loadError = e?.message ?? "Failed to load routing group.";
          this.groupLoadState = "error";
          this.baseline = null;
          this.working = null;
          this.variations = [];
        }
        return false;
      }
    },
    // Load the server-persisted (H2) variations for the parent group into the rail.
    async fetchServerVariations(parentRoutingGroupId: string, signal?: AbortSignal): Promise<Variation[]> {
      const list = await VariationService.listVariations(parentRoutingGroupId, signal);
      return list
        .filter((v) => v.statusId !== "VAR_ARCHIVED")
        .map((v) => ({ id: v.variationGroupId, label: v.variationName || v.variationGroupId, group: null, serverVid: v.variationGroupId }));
    },
    // A synchronous variation POST cannot be reattached after a reload. Even though successful new
    // responses include a simulation id, a reload or lost response can happen before the browser
    // receives it. Convert a leftover running marker into an explicit durable unknown outcome.
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
      this.variationRunResult = null;
      this.parentRunProgress = null;
      this.lastSimulationId = null;
      this.runCompareError = variationRunInterruptedMessage(interrupted.variationLabel);
      return true;
    },
    // Persist the current working copy as a NEW H2 variation. Returns true on success so
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
            this.loadError = err?.message || "Failed to create variation.";
          }
        }
        return false;
      } finally {
        if (generation === variationMutationGeneration) this.isSavingVariation = false;
      }
    },
    // Discard a saved variation. The backend archives the registry row so it disappears from normal
    // lists while retaining the H2 config for recovery/audit. If the active variation is discarded,
    // return the canvas to the live baseline in the same state transition as removing the rail row.
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
          this.parentRunProgress = null;
          this.clearRunResults();
        }
        return true;
      } catch (err: any) {
        logger.error(err);
        if (generation === variationMutationGeneration && this.routingGroupId === parentId) {
          this.loadError = err?.message || "Failed to discard variation.";
        }
        return false;
      } finally {
        if (generation === variationMutationGeneration) this.isSavingVariation = false;
      }
    },
    // Overwrite an existing H2 variation with the current working copy. Returns true on success.
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
          this.loadError = err?.message || "Failed to update variation.";
        }
        return false;
      } finally {
        if (generation === variationMutationGeneration) this.isSavingVariation = false;
      }
    },
    // Open a variation in the canvas: use the cached tree or fetch it from H2 (lazy).
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
          this.parentRunProgress = null;
          return true;
        }
        return false;
      } catch (err: any) {
        if (generation !== variationLoadGeneration || this.routingGroupId !== parentId) return false;
        logger.error(err);
        const message = err?.message ?? "Failed to load variation.";
        this.loadError = message;
        // Surface the failure — otherwise a thrown getVariation silently leaves the
        // canvas on the previous copy, which reads as "the variation didn't load".
        commonUtil.showToast(message);
        return false;
      }
    },
    // Run the selected live baseline through the existing async parent job. This is deliberately a
    // fresh run rather than a read from parentRunByGroupId: the user explicitly asked to simulate
    // the current baseline, while the cache only exists to avoid duplicate comparison work.
    async runBaseline(sampleCap = 500) {
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
      this.parentRunProgress = null;
      this.isRunningBaselineRun = true;
      this.view = "results";
      try {
        const result = await SimulationService.runParentLiveConfig(parentId, sampleCap, (progress) => {
          if (generation === variationRunGeneration && this.routingGroupId === parentId && !this.activeVariationId) {
            this.parentRunProgress = progress;
          }
        }, signal);
        if (generation !== variationRunGeneration || this.routingGroupId !== parentId || this.activeVariationId) return false;
        this.baselineRunResult = result;
        this.parentRunByGroupId[parentId] = result;
        this.lastSimulationId = result?.simulationId ? String(result.simulationId) : null;
        return true;
      } catch (error: any) {
        if (generation === variationRunGeneration && this.routingGroupId === parentId && !this.activeVariationId) {
          this.baselineRunResult = null;
          this.lastSimulationId = null;
          this.baselineRunError = error?.message || "Baseline simulation failed.";
        }
        return false;
      } finally {
        if (generation === variationRunGeneration) this.isRunningBaselineRun = false;
      }
    },
    // Run the active H2 variation (synchronous) and the parent live-config (cached) for compare.
    async runActiveVariation(sampleCap = 500) {
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
      if (!v?.serverVid) { this.runCompareError = "Save the variation before running it."; this.view = "results"; return false; }
      const generation = ++variationRunGeneration;
      variationRunController?.abort();
      variationRunController = new AbortController();
      const signal = variationRunController.signal;
      const variationId = v.id;
      this.clearRunResults();
      this.isRunningVariationRun = true;
      this.view = "results";
      const parentId = this.routingGroupId;
      const recoveryRecord: VariationRunRecoveryRecord = {
        routingGroupId: parentId,
        variationId,
        serverVariationId: v.serverVid,
        variationLabel: v.label || v.serverVid,
        sampleCap,
        startedAt: Date.now(),
        status: "running",
      };
      SimulationStorage.setVariationRun(recoveryRecord);
      this.interruptedVariationRun = null;
      const needParent = !this.parentRunByGroupId[parentId];
      try {
        const [vr, parentOutcome] = await Promise.all([
          VariationService.runVariation(v.serverVid, sampleCap, signal),
          needParent
            ? SimulationService.runParentLiveConfig(parentId, sampleCap, (p) => {
              if (generation === variationRunGeneration && this.routingGroupId === parentId && this.activeVariationId === variationId) {
                this.parentRunProgress = p;
              }
            }, signal).then((result) => ({ result })).catch((error) => ({ error }))
            : Promise.resolve({ result: this.parentRunByGroupId[parentId] }),
        ]);
        if (generation !== variationRunGeneration || this.routingGroupId !== parentId || this.activeVariationId !== variationId) return false;
        if (parentOutcome && "error" in parentOutcome) {
          logger.error(parentOutcome.error);
          this.runCompareError = "The variation ran, but the live parent configuration could not be run for comparison.";
        }
        else if (parentOutcome?.result) this.parentRunByGroupId[parentId] = parentOutcome.result;
        this.variationRunResult = vr;
        this.lastSimulationId = vr.simulationId ? String(vr.simulationId) : null;
        // Clear the durable marker only after the canonical group result and optional history id
        // have been adopted by the still-current editor. Older id-less successes remain valid.
        SimulationStorage.clearVariationRun(parentId);
        this.interruptedVariationRun = null;
        return true;
      } catch (e: any) {
        if (generation === variationRunGeneration && this.routingGroupId === parentId && this.activeVariationId === variationId) {
          const interrupted: VariationRunRecoveryRecord = {
            ...recoveryRecord,
            status: "interrupted",
            interruptedAt: Date.now(),
            lastError: e?.message ?? "The request ended before a result was received.",
          };
          SimulationStorage.setVariationRun(interrupted);
          this.interruptedVariationRun = interrupted;
          this.variationRunResult = null;
          this.lastSimulationId = null;
          this.runCompareError = variationRunInterruptedMessage(interrupted.variationLabel);
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
      this.parentRunProgress = null;
      this.clearRunResults();
    },
    // Run results belong to the selected source. Clear both baseline and variation presentation when
    // the source changes so the rail can never show numbers from the previously selected source.
    // parentRunByGroupId is a per-group comparison cache, so keep it.
    clearRunResults() {
      this.variationRunResult = null;
      this.runCompareError = null;
      this.baselineRunResult = null;
      this.baselineRunError = null;
      this.lastSimulationId = null;
    },
    // Flush the active editor's in-memory local state into `working` (via the registered
    // hook) so callers outside the editor — e.g. the Variations sheet's dirty check — see
    // an accurate `working`/`isDirty` before deciding to discard it.
    flushWorkingCopy() {
      workingFlushHook?.();
    },
    // Update the phase (+ optional error) of every runStates entry whose id is in `ids`.
    setVariationPhase(ids: string[], phase: VariationRunState["phase"], error?: string) {
      ids.forEach((id) => {
        const rs = this.runStates.find((r) => r.variationId === id);
        if (rs) { rs.phase = phase; if (error) rs.error = error; }
      });
    },

    // Poll one already-submitted batch job to completion, streaming progress into batchProgress.
    async runBatch(args: { batchIndex: number; ids: string[]; jobId: string; routingGroupId?: string; generation?: number; signal?: AbortSignal }): Promise<any | null> {
      const { batchIndex, ids, jobId, generation, signal } = args;
      const routingGroupId = args.routingGroupId ?? this.routingGroupId;
      const isCurrent = () => this.routingGroupId === routingGroupId
        && (generation == null || generation === batchRunGeneration);
      if (isCurrent()) this.setVariationPhase(ids, "running");
      try {
        const result = await SimulationService.pollJob(
          routingGroupId,
          jobId,
          (status) => { if (isCurrent() && status === "running") this.setVariationPhase(ids, "running"); },
          (progress) => {
            if (!isCurrent()) return;
            const bp = this.batchProgress[batchIndex];
            if (!bp) return;
            bp.phaseLabel = progress.phaseLabel;
            bp.phaseIndex = progress.phaseIndex;
            bp.phaseCount = progress.phaseCount;
            bp.ordersInScope = progress.ordersInScope;
            bp.ordersProcessed = progress.ordersProcessed;
            bp.brokered = progress.brokered;
            bp.queued = progress.queued;
            bp.events = mergeEvents(bp.events, progress.events ?? [], 50);
          },
          signal,
        );
        if (!isCurrent()) return null;
        const sid = (result as any)?.simulationId ?? (result as any)?.variation?.simulationId ?? (result as any)?.groupRun?.simulationId;
        if (sid && !this.lastSimulationId) this.lastSimulationId = String(sid);
        this.setVariationPhase(ids, "done");
        // Keep completed jobs until the aggregate finishes. If another batch loses its connection,
        // reload recovery must re-poll every batch so the final merged result is still complete.
        return result;
      } catch (err: any) {
        if (!isCurrent()) return null;
        this.setVariationPhase(ids, "failed", err?.message ?? "Batch failed.");
        // Terminal failures cannot be resumed. Network interruption, timeout, and cancellation keep
        // the job record so reopening the routing group can reattach to the backend job.
        if (!isRecoverableSimulationPollError(err)) SimulationStorage.removeJob(routingGroupId, jobId);
        return null;
      }
    },

    async submit() {
      const generation = ++batchRunGeneration;
      (batchRunController as AbortController | null)?.abort();
      batchRunController = new AbortController();
      const signal = batchRunController.signal;
      const routingGroupId = this.routingGroupId;
      const isCurrent = () => generation === batchRunGeneration && this.routingGroupId === routingGroupId;
      const built = this.variations.map((v) => ({ variation: v, variant: buildVariant(v.label, this.baseline, v.group) }));
      const live = built.filter((b) => !isNoOp(b.variant));
      this.runStates = built.map((b) => isNoOp(b.variant)
        ? { variationId: b.variation.id, label: b.variation.label, phase: "failed" as const, error: "No changes vs baseline — skipped." }
        : { variationId: b.variation.id, label: b.variation.label, phase: "pending" as const });
      if (live.length === 0) {
        this.isRunning = false;
        return;
      }

      this.isRunning = true;
      this.results = null;
      this.view = "results";
      try {
        const productStoreId = this.resolveProductStoreId(this.baseline?.productStoreId);
        const batches = chunkVariants(applyProductStoreId(live.map((b) => b.variant), productStoreId), 5);
        const idBatches = chunkVariants(live.map((b) => b.variation.id), 5);
        this.batchProgress = batches.map((_, i) => zeroedBatch(i));

        SimulationStorage.clearJobs(routingGroupId);
        const submitted = await Promise.all(batches.map(async (variants, i) => {
          const ids = idBatches[i];
          if (isCurrent()) this.setVariationPhase(ids, "submitted");
          try {
            const jobId = await SimulationService.submitBatch({ routingGroupId, variants, signal });
            if (isCurrent()) {
              SimulationStorage.upsertJob(routingGroupId, {
                jobId,
                batchIndex: i,
                batchCount: batches.length,
                variantLabels: variants.map((variant) => variant.label),
                submittedAt: Date.now(),
              });
            }
            return { batchIndex: i, ids, jobId, variantLabels: variants.map((v) => v.label) };
          } catch (err: any) {
            if (isCurrent()) this.setVariationPhase(ids, "failed", err?.message ?? "Failed to submit batch.");
            return { batchIndex: i, ids, jobId: null as string | null, variantLabels: variants.map((v) => v.label) };
          }
        }));
        if (!isCurrent()) return;

        // Preserve failed submissions as null entries so the aggregate is marked partial instead of
        // presenting the successful batches as a complete simulation.
        const batchResults = await Promise.all(submitted.map((s) => s.jobId
          ? this.runBatch({ batchIndex: s.batchIndex, ids: s.ids, jobId: s.jobId, routingGroupId, generation, signal })
          : Promise.resolve(null)));
        if (!isCurrent()) return;
        this.results = mergeVariationResults(batchResults);
        const successfulJobIds = new Set(submitted.flatMap((s, index) => s.jobId && batchResults[index] ? [s.jobId] : []));
        const hasRecoverableJob = SimulationStorage.getJobs(routingGroupId)
          .some((job) => !successfulJobIds.has(job.jobId));
        if (!hasRecoverableJob) SimulationStorage.clearJobs(routingGroupId);
      } finally {
        if (isCurrent()) this.isRunning = false;
      }
    },

    // Explicit recovery hook for a host that supports legacy multi-batch simulations. The canonical
    // routing-detail variation flow does not call this action; it has a separate run contract.
    async resumeInFlight(routingGroupId: string) {
      const jobs = SimulationStorage.getJobs(routingGroupId);
      if (!jobs.length) return;

      const generation = ++batchRunGeneration;
      (batchRunController as AbortController | null)?.abort();
      batchRunController = new AbortController();
      const signal = batchRunController.signal;
      const isCurrent = () => generation === batchRunGeneration && this.routingGroupId === routingGroupId;
      this.routingGroupId = routingGroupId;
      this.isRunning = true;
      this.results = null;
      this.view = "results";

      try {
        const batchCount = Math.max(0, ...jobs.map((j) => j.batchCount ?? 0));
        this.batchProgress = Array.from({ length: batchCount }, (_, i) => zeroedBatch(i));
        this.runStates = [];

        const toRun = jobs.map((j) => {
          const ids = j.variantLabels.map((label, n) => {
            const id = `${j.jobId}:${n}`;
            this.runStates.push({ variationId: id, label, phase: "running" as const });
            return id;
          });
          return { batchIndex: j.batchIndex, ids, jobId: j.jobId };
        });

        const batchResults = await Promise.all(toRun.map((x) => this.runBatch({ ...x, routingGroupId, generation, signal })));
        if (!isCurrent()) return;
        this.results = mergeVariationResults(batchResults);
        const successfulJobIds = new Set(jobs.flatMap((job, index) => batchResults[index] ? [job.jobId] : []));
        const hasRecoverableJob = SimulationStorage.getJobs(routingGroupId)
          .some((job) => !successfulJobIds.has(job.jobId));
        if (!hasRecoverableJob) SimulationStorage.clearJobs(routingGroupId);
      } finally {
        if (isCurrent()) this.isRunning = false;
      }
    },

    // ---- Variation Editor actions ----
    async fetchVariations(parentRoutingGroupId: string) {
      this.parentRoutingGroupId = parentRoutingGroupId;
      this.listLoading = true;
      try {
        this.variationList = await VariationService.listVariations(parentRoutingGroupId);
      } catch (err) {
        logger.error(err);
        this.variationList = [];
      } finally {
        this.listLoading = false;
      }
    },
    async createEditorVariation(parentRoutingGroupId: string, variationName?: string): Promise<string | null> {
      try {
        const vid = await VariationService.createVariation(parentRoutingGroupId, variationName);
        await this.fetchVariations(parentRoutingGroupId);
        return vid;
      } catch (err: any) {
        logger.error(err);
        this.loadError = err?.message ?? "Failed to create variation.";
        return null;
      }
    },
    async openVariation(vid: string) {
      this.loadError = null;
      this.tree = null;
      this.variationResult = null;
      this.runError = null;
      try {
        this.tree = await VariationService.getVariation(vid);
        this.parentRoutingGroupId = this.tree.parentRoutingGroupId;
      } catch (e: any) {
        this.loadError = e?.message ?? "Failed to load variation.";
      }
    },
    _findRouting(rid: string): VariationRouting | undefined {
      return this.tree?.routings.find((r: VariationRouting) => r.orderRoutingId === rid);
    },
    _findRule(rid: string, ruleId: string): VariationRule | undefined {
      return this._findRouting(rid)?.rules.find((x: VariationRule) => x.routingRuleId === ruleId);
    },
    // Optimistic write: mutate local tree, persist; on failure revert to the pre-edit snapshot.
    async _withSave(key: string, optimistic: () => void, persist: () => Promise<any>) {
      if (!this.tree?.variationGroupId) return;
      this.saving = { ...this.saving, [key]: "saving" };
      const snapshot = deepClone(this.tree);
      try {
        optimistic();
        await persist();
        const next = { ...this.saving }; delete next[key]; this.saving = next;
      } catch (err: any) {
        logger.error(err);
        this.tree = snapshot;
        this.saving = { ...this.saving, [key]: "error" };
      }
    },

    setRoutingStatus(rid: string, statusId: string) {
      return this._withSave(`routing:${rid}`,
        () => { const r = this._findRouting(rid); if (r) r.statusId = statusId; },
        () => VariationService.setRouting(this.tree!.variationGroupId, rid, { statusId }));
    },
    reorderRoutings(orderedIds: string[]) {
      const vid = this.tree!.variationGroupId;
      orderedIds.forEach((rid, i) => {
        const r = this._findRouting(rid); if (r) r.sequenceNum = i;
        void VariationService.setRouting(vid, rid, { sequenceNum: i }).catch((e) => logger.error(e));
      });
    },
    upsertFilter(rid: string, cond: VariationConditionInput) {
      return this._withSave(`filter:${rid}:${cond.conditionSeqId}`,
        () => {
          const r = this._findRouting(rid); if (!r) return;
          const existing = r.filters.find((f: any) => f.conditionSeqId === cond.conditionSeqId);
          if (existing) Object.assign(existing, cond); else r.filters.push({ ...cond });
        },
        () => VariationService.upsertFilter(this.tree!.variationGroupId, rid, cond));
    },
    removeFilter(rid: string, seqId: string) {
      return this._withSave(`filter:${rid}:${seqId}`,
        () => { const r = this._findRouting(rid); if (r) r.filters = r.filters.filter((f: any) => f.conditionSeqId !== seqId); },
        () => VariationService.deleteFilter(this.tree!.variationGroupId, rid, seqId));
    },
    setRuleStatus(rid: string, ruleId: string, statusId: string) {
      return this._withSave(`rule:${ruleId}`,
        () => { const rl = this._findRule(rid, ruleId); if (rl) rl.statusId = statusId; },
        () => VariationService.setRule(this.tree!.variationGroupId, rid, ruleId, { statusId }));
    },
    reorderRules(rid: string, orderedRuleIds: string[]) {
      const vid = this.tree!.variationGroupId;
      orderedRuleIds.forEach((ruleId, i) => {
        const rl = this._findRule(rid, ruleId); if (rl) rl.sequenceNum = i;
        void VariationService.setRule(vid, rid, ruleId, { sequenceNum: i }).catch((e) => logger.error(e));
      });
    },
    upsertInventoryCondition(rid: string, ruleId: string, cond: VariationConditionInput) {
      return this._withSave(`invcond:${ruleId}:${cond.conditionSeqId}`,
        () => {
          const rl = this._findRule(rid, ruleId); if (!rl) return;
          const ex = rl.inventoryConditions.find((c: any) => c.conditionSeqId === cond.conditionSeqId);
          if (ex) Object.assign(ex, cond); else rl.inventoryConditions.push({ ...cond });
        },
        () => VariationService.upsertInventoryCondition(this.tree!.variationGroupId, rid, ruleId, cond));
    },
    removeInventoryCondition(rid: string, ruleId: string, seqId: string) {
      return this._withSave(`invcond:${ruleId}:${seqId}`,
        () => { const rl = this._findRule(rid, ruleId); if (rl) rl.inventoryConditions = rl.inventoryConditions.filter((c: any) => c.conditionSeqId !== seqId); },
        () => VariationService.deleteInventoryCondition(this.tree!.variationGroupId, rid, ruleId, seqId));
    },
    upsertAction(rid: string, ruleId: string, action: VariationActionInput) {
      return this._withSave(`action:${ruleId}:${action.actionSeqId}`,
        () => {
          const rl = this._findRule(rid, ruleId); if (!rl) return;
          const ex = rl.actions.find((a: any) => a.actionSeqId === action.actionSeqId);
          if (ex) Object.assign(ex, action); else rl.actions.push({ ...action });
        },
        () => VariationService.upsertAction(this.tree!.variationGroupId, rid, ruleId, action));
    },
    removeAction(rid: string, ruleId: string, seqId: string) {
      return this._withSave(`action:${ruleId}:${seqId}`,
        () => { const rl = this._findRule(rid, ruleId); if (rl) rl.actions = rl.actions.filter((a: any) => a.actionSeqId !== seqId); },
        () => VariationService.deleteAction(this.tree!.variationGroupId, rid, ruleId, seqId));
    },
    async runComparison(sampleCap = 500) {
      const tree = this.tree;
      if (!tree) return;
      this.runError = null;
      this.variationResult = null;
      this.isRunningVariation = true;
      const needParent = !this.parentResultByParentId[tree.parentRoutingGroupId];
      if (needParent) { this.isRunningParent = true; this.parentProgress = null; }
      try {
        const [variation] = await Promise.all([
          VariationService.runVariation(tree.variationGroupId, sampleCap).finally(() => { this.isRunningVariation = false; }),
          needParent
            ? SimulationService.runParentLiveConfig(tree.parentRoutingGroupId, sampleCap, (p) => { this.parentProgress = p; })
                .then((gr) => { this.parentResultByParentId[tree.parentRoutingGroupId] = gr; })
                .catch((e) => { logger.error(e); })
                .finally(() => { this.isRunningParent = false; })
            : Promise.resolve(),
        ]);
        this.variationResult = variation;
      } catch (e: any) {
        this.runError = e?.message ?? "Simulation run failed.";
      } finally {
        this.isRunningVariation = false;
        this.isRunningParent = false;
      }
    },
    async rerunParent(sampleCap = 500) {
      const tree = this.tree;
      if (!tree) return;
      delete this.parentResultByParentId[tree.parentRoutingGroupId];
      this.isRunningParent = true;
      this.parentProgress = null;
      try {
        const gr = await SimulationService.runParentLiveConfig(tree.parentRoutingGroupId, sampleCap, (p) => { this.parentProgress = p; });
        this.parentResultByParentId[tree.parentRoutingGroupId] = gr;
      } catch (e) {
        logger.error(e);
      } finally {
        this.isRunningParent = false;
      }
    },
  },
});

// Hot-reload the store definition (new getters/actions) without a full page refresh during dev.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(simulationStore, import.meta.hot));
}
