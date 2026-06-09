// src/store/simulationStore.ts
import { acceptHMRUpdate, defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { orderRoutingStore } from "./orderRoutingStore";
import { buildVariant, isNoOp } from "../util/simulationDiff";
import { chunkVariants, mergeVariationResults } from "../util/simulationBatch";
import { submitBatch, pollJob } from "../services/SimulationService";
import { mergeEvents } from "../util/progressBuffer";
import { BatchProgress, Variation, VariationRunState } from "../types/simulation";
import * as SimulationJobStore from "../services/SimulationJobStore";

const deepClone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));

const zeroedBatch = (batchIndex: number): BatchProgress => ({
  batchIndex, phaseLabel: "", phaseIndex: 0, phaseCount: 0,
  ordersInScope: 0, ordersProcessed: 0, brokered: 0, queued: 0, events: [],
});

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
    // The persisted simulationId of the most recently completed run (backend R3), for deep-linking.
    lastSimulationId: null as string | null,
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
        this.lastSimulationId = null;
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
    // Update the phase (+ optional error) of every runStates entry whose id is in `ids`.
    setVariationPhase(ids: string[], phase: VariationRunState["phase"], error?: string) {
      ids.forEach((id) => {
        const rs = this.runStates.find((r) => r.variationId === id);
        if (rs) { rs.phase = phase; if (error) rs.error = error; }
      });
    },

    // Poll one already-submitted batch job to completion, streaming progress into batchProgress
    // and updating runStates. Removes the persisted record on terminal. Returns the poll result
    // ({ groupRun?|variation? }) or null on failure. Used by both submit() and resumeInFlight().
    async runBatch(args: { batchIndex: number; ids: string[]; jobId: string }): Promise<any | null> {
      const { batchIndex, ids, jobId } = args;
      this.setVariationPhase(ids, "running");
      try {
        const result = await pollJob(
          this.routingGroupId,
          jobId,
          (status) => { if (status === "running") this.setVariationPhase(ids, "running"); },
          (progress) => {
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
        );
        const sid = (result as any)?.simulationId ?? (result as any)?.variation?.simulationId ?? (result as any)?.groupRun?.simulationId;
        if (sid && !this.lastSimulationId) this.lastSimulationId = String(sid);
        this.setVariationPhase(ids, "done");
        SimulationJobStore.removeJob(this.routingGroupId, jobId);
        return result;
      } catch (err: any) {
        this.setVariationPhase(ids, "failed", err?.message ?? "Batch failed.");
        SimulationJobStore.removeJob(this.routingGroupId, jobId);
        return null;
      }
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
      this.view = "results";
      try {
        const batches = chunkVariants(live.map((b) => b.variant), 5);
        const idBatches = chunkVariants(live.map((b) => b.variation.id), 5);
        this.batchProgress = batches.map((_, i) => zeroedBatch(i));

        // Submit every batch first (instant responses) so we have all jobIds to persist up-front.
        SimulationJobStore.clearJobs(this.routingGroupId);
        const submitted = await Promise.all(batches.map(async (variants, i) => {
          const ids = idBatches[i];
          this.setVariationPhase(ids, "submitted");
          try {
            const jobId = await submitBatch({ routingGroupId: this.routingGroupId, variants });
            return { batchIndex: i, ids, jobId, variantLabels: variants.map((v) => v.label) };
          } catch (err: any) {
            this.setVariationPhase(ids, "failed", err?.message ?? "Failed to submit batch.");
            return { batchIndex: i, ids, jobId: null as string | null, variantLabels: variants.map((v) => v.label) };
          }
        }));

        const okJobs = submitted.filter((s) => s.jobId) as Array<{ batchIndex: number; ids: string[]; jobId: string; variantLabels: string[] }>;
        SimulationJobStore.recordJobs(this.routingGroupId, okJobs.map((s) => ({
          jobId: s.jobId, batchIndex: s.batchIndex, batchCount: batches.length,
          variantLabels: s.variantLabels, submittedAt: Date.now(),
        })));

        const batchResults = await Promise.all(okJobs.map((s) => this.runBatch({ batchIndex: s.batchIndex, ids: s.ids, jobId: s.jobId })));
        this.results = mergeVariationResults(batchResults);
      } finally {
        this.isRunning = false;
      }
    },

    // On reopening a group's Simulate screen, re-attach to any persisted in-flight jobs and resume
    // polling — rebuilding the live panels + runStates summary and merging results on completion.
    async resumeInFlight(routingGroupId: string) {
      const jobs = SimulationJobStore.getJobs(routingGroupId);
      if (!jobs.length) return;

      this.routingGroupId = routingGroupId;
      this.isRunning = true;
      this.results = null;
      this.view = "results";

      // Use the max recorded batchCount (records may have been partially removed after some batches
      // completed before the refresh). 0/missing values are safely ignored by Math.max with seed 0.
      const batchCount = Math.max(0, ...jobs.map((j) => j.batchCount ?? 0));
      this.batchProgress = Array.from({ length: batchCount }, (_, i) => zeroedBatch(i));
      this.runStates = [];

      const toRun = jobs.map((j) => {
        // jobId-keyed synthetic ids guarantee uniqueness across batches.
        const ids = j.variantLabels.map((label, n) => {
          const id = `${j.jobId}:${n}`;
          this.runStates.push({ variationId: id, label, phase: "running" as const });
          return id;
        });
        return { batchIndex: j.batchIndex, ids, jobId: j.jobId };
      });

      const batchResults = await Promise.all(toRun.map((x) => this.runBatch(x)));
      try { this.results = mergeVariationResults(batchResults); } finally { this.isRunning = false; }
    },
  },
});

// Hot-reload the store definition (new getters/actions) without a full page refresh during dev.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(simulationStore, import.meta.hot));
}
