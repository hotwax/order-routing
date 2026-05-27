// src/store/simulationStore.ts
import { acceptHMRUpdate, defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { orderRoutingStore } from "./orderRoutingStore";
import { buildVariant, isNoOp } from "../util/simulationDiff";
import { chunkVariants, mergeVariationResults } from "../util/simulationBatch";
import { submitBatch, pollJob } from "../services/SimulationService";
import { mergeEvents } from "../util/progressBuffer";
import { BatchProgress, Variation, VariationRunState } from "../types/simulation";

const deepClone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));

export const simulationStore = defineStore("simulation", {
  state: () => ({
    routingGroupId: "" as string,
    baseline: null as any,
    working: null as any,
    variations: [] as Variation[],
    activeVariationId: "" as string,
    runStates: [] as VariationRunState[],
    batchProgress: [] as BatchProgress[],
    results: null as { baseline: any; variants: any[]; partial: boolean; simulationRan?: boolean } | null,
    isRunning: false,
    loadError: null as string | null,
    // Which pane is shown. User-controlled so the editor and the (possibly still-running)
    // simulation can be switched between freely — the run continues in the background.
    view: "editor" as "editor" | "results",
  }),
  getters: {
    canSubmit: (s) => s.variations.length > 0 && !s.isRunning,
    // The variation the working copy was loaded from (null = editing a fresh draft off baseline).
    activeVariation: (s) => s.variations.find((v) => v.id === s.activeVariationId) || null,
    // True when the working copy differs from its source (the loaded variation, or baseline).
    // Reads flushed working state, so it refreshes when the canvas flushes (routing switch / save).
    isDirty: (s) => {
      const source = s.activeVariationId
        ? s.variations.find((v) => v.id === s.activeVariationId)?.group
        : s.baseline;
      return JSON.stringify(s.working ?? {}) !== JSON.stringify(source ?? {});
    },
  },
  actions: {
    async loadGroup(routingGroupId: string) {
      this.loadError = null;
      this.baseline = null;
      this.working = null;
      try {
        const ors = orderRoutingStore();
        // On a fresh deep-link the groups[] list is empty. fetchCurrentRoutingGroup looks the
        // group up there, and when it's missing the downstream schedule fetch throws on an
        // undefined currentGroup. Loading the list first mirrors the picker entry path and
        // keeps currentGroup defined.
        if (!ors.getRoutingGroups?.length) {
          await ors.fetchOrderRoutingGroups();
        }
        await ors.fetchCurrentRoutingGroup(routingGroupId);
        const group = ors.getCurrentRoutingGroup;
        if (!group?.routingGroupId) {
          throw new Error(`Routing group ${routingGroupId} could not be loaded.`);
        }
        this.routingGroupId = routingGroupId;
        this.baseline = deepClone(group);
        this.working = deepClone(group);
        this.variations = [];
        this.activeVariationId = "";
        this.results = null;
        this.runStates = [];
        this.batchProgress = [];
      } catch (e: any) {
        this.loadError = e?.message ?? "Failed to load routing group.";
      }
    },
    saveAsVariation(label: string) {
      const variation: Variation = { id: uuidv4(), label: label || `Variation ${this.variations.length + 1}`, group: deepClone(this.working) };
      this.variations.push(variation);
      this.activeVariationId = variation.id;
    },
    // Overwrite an existing variation's snapshot with the current working copy.
    updateVariation(id: string) {
      const v = this.variations.find((x) => x.id === id);
      if (v) v.group = deepClone(this.working);
    },
    loadVariation(id: string) {
      const v = this.variations.find((x) => x.id === id);
      if (v) { this.working = deepClone(v.group); this.activeVariationId = id; }
    },
    resetWorkingToBaseline() {
      this.working = deepClone(this.baseline);
      this.activeVariationId = "";
    },
    renameVariation(id: string, label: string) {
      const v = this.variations.find((x) => x.id === id);
      if (v) v.label = label;
    },
    deleteVariation(id: string) {
      this.variations = this.variations.filter((x) => x.id !== id);
      if (this.activeVariationId === id) this.resetWorkingToBaseline();
    },
    async submit() {
      const built = this.variations.map((v) => ({ variation: v, variant: buildVariant(v.label, this.baseline, v.group) }));
      const live = built.filter((b) => !isNoOp(b.variant));
      this.runStates = built.map((b) => isNoOp(b.variant)
        ? { variationId: b.variation.id, label: b.variation.label, phase: "failed" as const, error: "No changes vs baseline — skipped." }
        : { variationId: b.variation.id, label: b.variation.label, phase: "pending" as const });
      if (live.length === 0) return;

      this.isRunning = true;
      this.results = null;
      this.view = "results"; // surface progress on submit; user can switch back to the editor anytime
      const setPhase = (id: string, phase: VariationRunState["phase"], error?: string) => {
        const rs = this.runStates.find((r) => r.variationId === id);
        if (rs) { rs.phase = phase; if (error) rs.error = error; }
      };

      const batches = chunkVariants(live.map((b) => b.variant), 5);
      const idBatches = chunkVariants(live.map((b) => b.variation.id), 5);
      this.batchProgress = batches.map((_, i) => ({
        batchIndex: i, phaseLabel: "", phaseIndex: 0, phaseCount: 0,
        ordersInScope: 0, ordersProcessed: 0, brokered: 0, queued: 0, events: [],
      }));

      const batchResults = await Promise.all(batches.map(async (variants, i) => {
        const ids = idBatches[i];
        ids.forEach((id) => setPhase(id, "submitted"));
        try {
          const jobId = await submitBatch({ routingGroupId: this.routingGroupId, variants });
          const result = await pollJob(
            this.routingGroupId,
            jobId,
            (status) => { if (status === "running") ids.forEach((id) => setPhase(id, "running")); },
            (progress) => {
              const bp = this.batchProgress[i];
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
          );
          ids.forEach((id) => setPhase(id, "done"));
          return result;
        } catch (err: any) {
          ids.forEach((id) => setPhase(id, "failed", err?.message ?? "Batch failed."));
          return null;
        }
      }));

      try {
        this.results = mergeVariationResults(batchResults);
      } finally {
        this.isRunning = false;
      }
    },
  },
});

// Hot-reload the store definition (new getters/actions) without a full page refresh during dev.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(simulationStore, import.meta.hot));
}
