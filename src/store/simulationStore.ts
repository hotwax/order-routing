// src/store/simulationStore.ts
import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";
import { orderRoutingStore } from "./orderRoutingStore";
import { buildVariant, isNoOp } from "../util/simulationDiff";
import { chunkVariants, mergeVariationResults } from "../util/simulationBatch";
import { submitBatch, pollJob } from "../services/SimulationService";
import { Variation, VariationRunState } from "../types/simulation";

const deepClone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));

export const simulationStore = defineStore("simulation", {
  state: () => ({
    routingGroupId: "" as string,
    baseline: null as any,
    working: null as any,
    variations: [] as Variation[],
    activeVariationId: "" as string,
    runStates: [] as VariationRunState[],
    results: null as { baseline: any; variants: any[]; partial: boolean } | null,
    isRunning: false,
    loadError: null as string | null,
  }),
  getters: {
    canSubmit: (s) => s.variations.length > 0 && !s.isRunning,
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
      } catch (e: any) {
        this.loadError = e?.message ?? "Failed to load routing group.";
      }
    },
    saveAsVariation(label: string) {
      const variation: Variation = { id: uuidv4(), label: label || `Variation ${this.variations.length + 1}`, group: deepClone(this.working) };
      this.variations.push(variation);
      this.activeVariationId = variation.id;
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
      const setPhase = (id: string, phase: VariationRunState["phase"], error?: string) => {
        const rs = this.runStates.find((r) => r.variationId === id);
        if (rs) { rs.phase = phase; if (error) rs.error = error; }
      };

      const batches = chunkVariants(live.map((b) => b.variant), 5);
      const idBatches = chunkVariants(live.map((b) => b.variation.id) as any, 5) as unknown as string[][];

      const batchResults = await Promise.all(batches.map(async (variants, i) => {
        const ids = idBatches[i];
        ids.forEach((id) => setPhase(id, "submitted"));
        try {
          const jobId = await submitBatch({ routingGroupId: this.routingGroupId, variants });
          const result = await pollJob(this.routingGroupId, jobId, (status) => {
            if (status === "running") ids.forEach((id) => setPhase(id, "running"));
          });
          ids.forEach((id) => setPhase(id, "done"));
          return result;
        } catch (err: any) {
          ids.forEach((id) => setPhase(id, "failed", err?.message ?? "Batch failed."));
          return null;
        }
      }));

      this.results = mergeVariationResults(batchResults);
      this.isRunning = false;
    },
  },
});
