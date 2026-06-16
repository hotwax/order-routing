// src/store/simulationStore.ts
import { acceptHMRUpdate, defineStore } from "pinia";
import { logger } from "@common";
import { productStore } from "./productStore";
import { buildVariant, isNoOp, applyProductStoreId } from "../util/simulationDiff";
import { chunkVariants, mergeVariationResults } from "../util/simulationBatch";
import { submitBatch, pollJob, runParentLiveConfig, simRequest, simApiName, simMoquiUrl, simProductStoreId } from "../services/SimulationService";
import { fetchRoutingGroupsList, fetchRoutingGroupDetail } from "../services/RoutingGroupService";
import { listVariations, createVariation, getVariation, replaceVariationConfig, runVariation } from "../services/VariationService";
import { toConfigPayload, fromVariationRoutings } from "../util/variationConfigAdapter";
import { joinRoutingResults } from "../util/routingResultJoin";
import { buildRoutingNameMap } from "../util/variationTree";
import { mergeEvents } from "../util/progressBuffer";
import { BatchProgress, Variation, VariationRunState } from "../types/simulation";
import { CompareRow, GroupRunResult } from "../types/variation";
import * as SimulationJobStore from "../services/SimulationJobStore";

const deepClone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));

const zeroedBatch = (batchIndex: number): BatchProgress => ({
  batchIndex, phaseLabel: "", phaseIndex: 0, phaseCount: 0,
  ordersInScope: 0, ordersProcessed: 0, brokered: 0, queued: 0, events: [],
});

export const simulationStore = defineStore("simulation", {
  state: () => ({
    routingGroupId: "" as string,
    // The routing-group list for the picker, fetched from the simulation backend via simRequest — kept
    // here, not in the shared orderRoutingStore, so the simulate tab never reads/writes OMS group state.
    simGroups: [] as any[],
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
    // ---- H2 variation run + parent compare (persist-on-save flow) ----
    variationRunResult: null as GroupRunResult | null,
    parentRunByGroupId: {} as Record<string, GroupRunResult>, // session cache, keyed by parent group id
    parentRunProgress: null as any,
    isRunningVariationRun: false,
    runCompareError: null as string | null,
  }),
  getters: {
    getSimGroups: (s) => s.simGroups,
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
    // Per-routing parent-vs-variation comparison rows for the active H2 variation run.
    variationCompareRows(s): CompareRow[] {
      const parent = s.parentRunByGroupId[s.routingGroupId];
      if (!s.variationRunResult || !parent) return [];
      // Names: parent routings (100008 -> name) + the active variation's working tree (VM…_100008 -> name).
      const names = { ...buildRoutingNameMap({ routings: s.baseline?.routings ?? [] }), ...buildRoutingNameMap({ routings: s.working?.routings ?? [] }) };
      return joinRoutingResults({
        variationGroupId: s.variationRunResult.routingGroupId,
        parentResults: parent.routingResults ?? [],
        variationResults: s.variationRunResult.routingResults ?? [],
        routingNameById: names,
      });
    },
  },
  actions: {
    // THE product-store resolution for the simulate tab — every sim call site (group list, past list,
    // submit) funnels through here so the precedence lives in one place (and the planned store
    // selector replaces one function, not three hand-rolled chains). Precedence: the configured sim
    // store (VITE_SIM_PRODUCT_STORE_ID) > a caller-supplied contextual store (e.g. the loaded
    // group's) > the OMS currentEComStore (single-instance behaviour).
    resolveProductStoreId(prefer?: string): string {
      return simProductStoreId() || prefer || productStore().getCurrentEComStore?.productStoreId || "";
    },
    // Routing-group list for the picker, pulled from the sim instance via simRequest. Errors are logged
    // and leave the list empty — callers (onMounted, loadGroup) must not blow up on a sim outage.
    async fetchSimGroups() {
      try {
        this.simGroups = await fetchRoutingGroupsList(this.resolveProductStoreId(), simRequest, simMoquiUrl(), simApiName());
      } catch (err) {
        logger.error(err);
        this.simGroups = [];
      }
    },
    async loadGroup(routingGroupId: string) {
      this.loadError = null;
      this.baseline = null;
      this.working = null;
      try {
        // On a fresh deep-link the list is empty; load it first so fetchRoutingGroupDetail has the
        // group metadata to fall back on. All reads go through simRequest to the simulation backend.
        if (!this.simGroups?.length) {
          await this.fetchSimGroups();
        }
        const group = await fetchRoutingGroupDetail(routingGroupId, this.simGroups, simRequest, simMoquiUrl(), simApiName());
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
        this.variationRunResult = null;
        this.runCompareError = null;
        await this.fetchServerVariations(routingGroupId);
      } catch (e: any) {
        this.loadError = e?.message ?? "Failed to load routing group.";
      }
    },
    // Load the server-persisted (H2) variations for the parent group into the rail. group=null until a
    // variation is opened (lazy). Errors leave the existing list intact.
    async fetchServerVariations(parentRoutingGroupId: string) {
      try {
        const list = await listVariations(parentRoutingGroupId);
        this.variations = list.map((v) => ({ id: v.variationGroupId, label: v.variationName || v.variationGroupId, group: null, serverVid: v.variationGroupId }));
      } catch (err) {
        logger.error(err);
      }
    },
    // Persist the current working copy as a NEW H2 variation: clone the parent, then PUT the whole
    // edited tree (lossless whole-tree replace). Cache the canonical returned tree as the group.
    async saveAsVariation(label: string) {
      try {
        const vid = await createVariation(this.routingGroupId, label);
        const tree = await replaceVariationConfig(vid, toConfigPayload(this.working?.routings ?? []));
        const group = { ...deepClone(this.working), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: vid };
        this.variations.push({ id: vid, label: label || tree?.variationName || vid, group, serverVid: vid });
        this.activeVariationId = vid;
        this.working = deepClone(group);
      } catch (err: any) {
        logger.error(err);
        this.loadError = err?.message ?? "Failed to save variation.";
      }
    },
    // Overwrite an existing H2 variation with the current working copy (PUT /config, lossless).
    async updateVariation(id: string) {
      const v = this.variations.find((x) => x.id === id);
      if (!v?.serverVid) return;
      try {
        const tree = await replaceVariationConfig(v.serverVid, toConfigPayload(this.working?.routings ?? []));
        v.group = { ...deepClone(this.working), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: v.serverVid };
        this.working = deepClone(v.group);
      } catch (err: any) {
        logger.error(err);
        this.loadError = err?.message ?? "Failed to update variation.";
      }
    },
    // Open a variation in the canvas: use the cached tree or fetch it from H2 (lazy).
    async loadVariation(id: string) {
      const v = this.variations.find((x) => x.id === id);
      if (!v) return;
      this.activeVariationId = id;
      try {
        if (!v.group && v.serverVid) {
          const tree = await getVariation(v.serverVid);
          v.group = { ...deepClone(this.baseline), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: v.serverVid };
        }
        if (v.group) this.working = deepClone(v.group);
      } catch (err: any) {
        logger.error(err);
        this.loadError = err?.message ?? "Failed to load variation.";
      }
    },
    // Run the active H2 variation (synchronous, slow) and the parent live-config (cached) for compare.
    async runActiveVariation(sampleCap = 500) {
      const v = this.activeVariationId ? this.variations.find((x) => x.id === this.activeVariationId) : null;
      if (!v?.serverVid) { this.runCompareError = "Save the variation before running it."; this.view = "results"; return; }
      this.runCompareError = null;
      this.variationRunResult = null;
      this.isRunningVariationRun = true;
      this.view = "results";
      const parentId = this.routingGroupId;
      const needParent = !this.parentRunByGroupId[parentId];
      try {
        const [vr] = await Promise.all([
          runVariation(v.serverVid, sampleCap),
          needParent
            ? runParentLiveConfig(parentId, sampleCap, (p) => { this.parentRunProgress = p; })
              .then((gr) => { this.parentRunByGroupId[parentId] = gr; })
              .catch((e) => { logger.error(e); })
            : Promise.resolve(),
        ]);
        this.variationRunResult = vr;
        const sid = (vr as any)?.simulationId;
        if (sid) this.lastSimulationId = String(sid);
      } catch (e: any) {
        this.runCompareError = e?.message ?? "Variation run failed.";
      } finally {
        this.isRunningVariationRun = false;
      }
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
        // Scope every variant to the sim product store (contextual fallback: the loaded group's own
        // store) so the backend simulates against the right store's data.
        const productStoreId = this.resolveProductStoreId(this.baseline?.productStoreId);
        const batches = chunkVariants(applyProductStoreId(live.map((b) => b.variant), productStoreId), 5);
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

      try {
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
