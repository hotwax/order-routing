// src/store/simulationStore.ts
import { acceptHMRUpdate, defineStore } from "pinia";
import { api, commonUtil, logger } from "@common";
import { productStore } from "./productStore";
import { buildVariant, isNoOp, applyProductStoreId, chunkVariants, mergeVariationResults } from "../utils/simulationCompute";
import { SimulationService } from "../services/SimulationService";
import { simProductStoreId, simBaseURL, simApiBaseUrl } from "../utils/simConfig";
import { orderRoutingStore } from "./orderRoutingStore";
import { VariationService } from "../services/VariationService";
import { normalizeRoutingGroupHierarchy } from "../utils/ruleUtil";
import { toConfigPayload, fromVariationRoutings, buildRoutingNameMap, sortBySequence } from "../utils/variationUtils";
import { joinRoutingResults } from "../utils/simulationResults";
import { mergeEvents } from "../utils/simulationCompute";
import { BatchProgress, Variation, VariationRunState } from "../types/simulation";
import { CompareRow, GroupRunResult, VariationListItem, VariationRouting, VariationRule, VariationTree } from "../types/variation";
import type { VariationConditionInput, VariationActionInput } from "../types/variation";
import { SimulationStorage } from "../services/simulationStorage";

const deepClone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));

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
    results: null as { baseline: any; variants: any[]; partial: boolean; simulationRan?: boolean } | null,
    isRunning: false,
    loadError: null as string | null,
    // Which pane is shown. User-controlled so the editor and the (possibly still-running)
    // simulation can be switched between freely — the run continues in the background.
    view: "editor" as any,
    // The persisted simulationId of the most recently completed run (backend R3), for deep-linking.
    lastSimulationId: null as string | null,
    // ---- H2 variation run + parent compare (persist-on-save flow) ----
    variationRunResult: null as GroupRunResult | null,
    parentRunByGroupId: {} as Record<string, GroupRunResult>, // session cache, keyed by parent group id
    parentRunProgress: null as any,
    isRunningVariationRun: false,
    runCompareError: null as string | null,

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
    // The variation the working copy was loaded from (null = editing a fresh draft off baseline).
    activeVariation: (s) => s.variations.find((v) => v.id === s.activeVariationId) || null,
    // True when the working copy differs from its source (the loaded variation, or baseline).
    isDirty: (s) => {
      const source = s.activeVariationId
        ? s.variations.find((v) => v.id === s.activeVariationId)?.group
        : s.baseline;
      return JSON.stringify(s.working ?? {}) !== JSON.stringify(source ?? {});
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
    // THE product-store resolution for the simulate tab — every sim call site (group list, past list,
    // submit) funnels through here so the precedence lives in one place.
    // Precedence: the configured sim store (VITE_SIM_PRODUCT_STORE_ID) > caller-supplied > OMS currentEComStore.
    resolveProductStoreId(prefer?: string): string {
      return simProductStoreId() || prefer || productStore().getCurrentEComStore?.productStoreId || "";
    },
    // Routing-group list for the picker, pulled from the sim instance via api. Errors are logged
    // and leave the list empty — callers must not blow up on a sim outage.
    async fetchSimGroups() {
      try {
        this.simGroups = await orderRoutingStore().fetchRoutingGroupsList(this.resolveProductStoreId());
      } catch (err) {
        logger.error(err);
        this.simGroups = [];
      }
    },

    async fetchSimGroupDetail(routingGroupId: string): Promise<any> {
      let group = (this.simGroups || []).find((g: any) => g.routingGroupId === routingGroupId);
      if (!group?.isNew) {
        
        let resp;
        try {
          resp = await api({
            url: `order-routing/groups/${routingGroupId}/raw`,
            method: "GET",
            baseURL: simApiBaseUrl(),
          });
        } catch (err) {
          if (group) return normalizeRoutingGroupHierarchy({ ...group });
          throw err;
        }
        if (!commonUtil.hasError(resp) && resp.data && typeof resp.data === "object" && !Array.isArray(resp.data)) {
          group = resp.data;
        } else if (group) {
          group = { ...group, routings: [] };
        } else {
          throw resp?.data;
        }
      }
      return normalizeRoutingGroupHierarchy(group);
    },

    // ---- Simulate-tab actions ----
    async loadGroup(routingGroupId: string) {
      this.loadError = null;
      this.baseline = null;
      this.working = null;
      try {
        if (!this.simGroups?.length) {
          await this.fetchSimGroups();
        }
        const group = await this.fetchSimGroupDetail(routingGroupId);
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
    // Load the server-persisted (H2) variations for the parent group into the rail.
    async fetchServerVariations(parentRoutingGroupId: string) {
      try {
        const list = await VariationService.listVariations(parentRoutingGroupId);
        this.variations = list.map((v) => ({ id: v.variationGroupId, label: v.variationName || v.variationGroupId, group: null, serverVid: v.variationGroupId }));
      } catch (err) {
        logger.error(err);
      }
    },
    // Persist the current working copy as a NEW H2 variation. Returns true on success so
    // callers only report success when the save actually reached the backend.
    async saveAsVariation(label: string): Promise<boolean> {
      try {
        const vid = await VariationService.createVariation(this.routingGroupId, label);
        const tree = await VariationService.replaceVariationConfig(vid, toConfigPayload(this.working?.routings ?? []));
        const group = { ...deepClone(this.working), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: vid };
        this.variations.push({ id: vid, label: label || tree?.variationName || vid, group, serverVid: vid });
        this.activeVariationId = vid;
        this.working = deepClone(group);
        return true;
      } catch (err: any) {
        logger.error(err);
        this.loadError = err?.message ?? "Failed to save variation.";
        return false;
      }
    },
    // Overwrite an existing H2 variation with the current working copy. Returns true on success.
    async updateVariation(id: string): Promise<boolean> {
      const v = this.variations.find((x) => x.id === id);
      if (!v?.serverVid) return false;
      try {
        const tree = await VariationService.replaceVariationConfig(v.serverVid, toConfigPayload(this.working?.routings ?? []));
        v.group = { ...deepClone(this.working), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: v.serverVid };
        this.working = deepClone(v.group);
        return true;
      } catch (err: any) {
        logger.error(err);
        this.loadError = err?.message ?? "Failed to update variation.";
        return false;
      }
    },
    // Open a variation in the canvas: use the cached tree or fetch it from H2 (lazy).
    async loadVariation(id: string) {
      const v = this.variations.find((x) => x.id === id);
      if (!v) return;
      this.activeVariationId = id;
      try {
        if (!v.group && v.serverVid) {
          const tree = await VariationService.getVariation(v.serverVid);
          v.group = { ...deepClone(this.baseline), routings: fromVariationRoutings(tree?.routings ?? []), variationGroupId: v.serverVid };
        }
        if (v.group) this.working = deepClone(v.group);
      } catch (err: any) {
        logger.error(err);
        const message = err?.message ?? "Failed to load variation.";
        this.loadError = message;
        // Surface the failure — otherwise a thrown getVariation silently leaves the
        // canvas on the previous copy, which reads as "the variation didn't load".
        commonUtil.showToast(message);
      }
    },
    // Run the active H2 variation (synchronous) and the parent live-config (cached) for compare.
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
          VariationService.runVariation(v.serverVid, sampleCap),
          needParent
            ? SimulationService.runParentLiveConfig(parentId, sampleCap, (p) => { this.parentRunProgress = p; })
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

    // Poll one already-submitted batch job to completion, streaming progress into batchProgress.
    async runBatch(args: { batchIndex: number; ids: string[]; jobId: string }): Promise<any | null> {
      const { batchIndex, ids, jobId } = args;
      this.setVariationPhase(ids, "running");
      try {
        const result = await SimulationService.pollJob(
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
        SimulationStorage.removeJob(this.routingGroupId, jobId);
        return result;
      } catch (err: any) {
        this.setVariationPhase(ids, "failed", err?.message ?? "Batch failed.");
        SimulationStorage.removeJob(this.routingGroupId, jobId);
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
        const productStoreId = this.resolveProductStoreId(this.baseline?.productStoreId);
        const batches = chunkVariants(applyProductStoreId(live.map((b) => b.variant), productStoreId), 5);
        const idBatches = chunkVariants(live.map((b) => b.variation.id), 5);
        this.batchProgress = batches.map((_, i) => zeroedBatch(i));

        SimulationStorage.clearJobs(this.routingGroupId);
        const submitted = await Promise.all(batches.map(async (variants, i) => {
          const ids = idBatches[i];
          this.setVariationPhase(ids, "submitted");
          try {
            const jobId = await SimulationService.submitBatch({ routingGroupId: this.routingGroupId, variants });
            return { batchIndex: i, ids, jobId, variantLabels: variants.map((v) => v.label) };
          } catch (err: any) {
            this.setVariationPhase(ids, "failed", err?.message ?? "Failed to submit batch.");
            return { batchIndex: i, ids, jobId: null as string | null, variantLabels: variants.map((v) => v.label) };
          }
        }));

        const okJobs = submitted.filter((s) => s.jobId) as Array<{ batchIndex: number; ids: string[]; jobId: string; variantLabels: string[] }>;
        SimulationStorage.recordJobs(this.routingGroupId, okJobs.map((s) => ({
          jobId: s.jobId, batchIndex: s.batchIndex, batchCount: batches.length,
          variantLabels: s.variantLabels, submittedAt: Date.now(),
        })));

        const batchResults = await Promise.all(okJobs.map((s) => this.runBatch({ batchIndex: s.batchIndex, ids: s.ids, jobId: s.jobId })));
        this.results = mergeVariationResults(batchResults);
      } finally {
        this.isRunning = false;
      }
    },

    // On reopening a group's Simulate screen, re-attach to any persisted in-flight jobs and resume polling.
    async resumeInFlight(routingGroupId: string) {
      const jobs = SimulationStorage.getJobs(routingGroupId);
      if (!jobs.length) return;

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

        const batchResults = await Promise.all(toRun.map((x) => this.runBatch(x)));
        this.results = mergeVariationResults(batchResults);
      } finally {
        this.isRunning = false;
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
