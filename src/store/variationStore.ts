// src/store/variationStore.ts
import { acceptHMRUpdate, defineStore } from "pinia";
import { logger } from "@common";
import { productStore } from "./productStore";
import {
  listVariations, createVariation, getVariation, runVariation,
  setRouting, upsertFilter, deleteFilter, setRule,
  upsertInventoryCondition, deleteInventoryCondition, upsertAction, deleteAction,
  type VariationConditionInput, type VariationActionInput,
} from "../services/VariationService";
import { runParentLiveConfig, simProductStoreId } from "../services/SimulationService";
import { joinRoutingResults } from "../util/routingResultJoin";
import { buildRoutingNameMap, sortBySequence } from "../util/variationTree";
import type { CompareRow, GroupRunResult, VariationListItem, VariationRouting, VariationRule, VariationTree } from "../types/variation";

const deepClone = (o: any) => JSON.parse(JSON.stringify(o ?? null));

export const variationStore = defineStore("variation", {
  state: () => ({
    // Routing-group list for the picker, pulled from the sim instance (formerly in simulationStore).
    simGroups: [] as any[],
    parentRoutingGroupId: "" as string,
    variations: [] as VariationListItem[],
    listLoading: false,
    tree: null as VariationTree | null,
    loadError: null as string | null,
    // Per-node saving status keyed by a stable node key (routingId / routingId:ruleId / ...:seqId).
    saving: {} as Record<string, "saving" | "error">,
    // Run + compare state.
    isRunningVariation: false,
    isRunningParent: false,
    variationResult: null as GroupRunResult | null,
    parentResultByParentId: {} as Record<string, GroupRunResult>, // session cache, keyed by parent id
    runError: null as string | null,
    parentProgress: null as any,
  }),
  getters: {
    getSimGroups: (s) => s.simGroups,
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
    resolveProductStoreId(prefer?: string): string {
      return simProductStoreId() || prefer || productStore().getCurrentEComStore?.productStoreId || "";
    },
    // Routing-group list for the picker, pulled from the sim instance. Errors leave the list empty so
    // a sim outage can't reject (mirrors the retired simulationStore.fetchSimGroups).
    async fetchSimGroups() {
      try {
        const { fetchRoutingGroupsList } = await import("../services/RoutingGroupService");
        const { simRequest, simApiName, simMoquiUrl } = await import("../services/SimulationService");
        this.simGroups = await fetchRoutingGroupsList(this.resolveProductStoreId(), simRequest, simMoquiUrl(), simApiName());
      } catch (err) {
        logger.error(err);
        this.simGroups = [];
      }
    },
    async fetchVariations(parentRoutingGroupId: string) {
      this.parentRoutingGroupId = parentRoutingGroupId;
      this.listLoading = true;
      try {
        this.variations = await listVariations(parentRoutingGroupId);
      } catch (err) {
        logger.error(err);
        this.variations = [];
      } finally {
        this.listLoading = false;
      }
    },
    async createVariation(parentRoutingGroupId: string, variationName?: string): Promise<string | null> {
      try {
        const vid = await createVariation(parentRoutingGroupId, variationName);
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
        this.tree = await getVariation(vid);
        this.parentRoutingGroupId = this.tree.parentRoutingGroupId;
      } catch (e: any) {
        this.loadError = e?.message ?? "Failed to load variation.";
      }
    },
    _findRouting(rid: string): VariationRouting | undefined {
      return this.tree?.routings.find((r) => r.orderRoutingId === rid);
    },
    _findRule(rid: string, ruleId: string): VariationRule | undefined {
      return this._findRouting(rid)?.rules.find((x) => x.routingRuleId === ruleId);
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
        this.tree = snapshot; // revert
        this.saving = { ...this.saving, [key]: "error" };
      }
    },

    setRoutingStatus(rid: string, statusId: string) {
      return this._withSave(`routing:${rid}`,
        () => { const r = this._findRouting(rid); if (r) r.statusId = statusId; },
        () => setRouting(this.tree!.variationGroupId, rid, { statusId }));
    },
    reorderRoutings(orderedIds: string[]) {
      const vid = this.tree!.variationGroupId;
      orderedIds.forEach((rid, i) => {
        const r = this._findRouting(rid); if (r) r.sequenceNum = i;
        void setRouting(vid, rid, { sequenceNum: i }).catch((e) => logger.error(e));
      });
    },
    upsertFilter(rid: string, cond: VariationConditionInput) {
      return this._withSave(`filter:${rid}:${cond.conditionSeqId}`,
        () => {
          const r = this._findRouting(rid); if (!r) return;
          const existing = r.filters.find((f) => f.conditionSeqId === cond.conditionSeqId);
          if (existing) Object.assign(existing, cond); else r.filters.push({ ...cond });
        },
        () => upsertFilter(this.tree!.variationGroupId, rid, cond));
    },
    removeFilter(rid: string, seqId: string) {
      return this._withSave(`filter:${rid}:${seqId}`,
        () => { const r = this._findRouting(rid); if (r) r.filters = r.filters.filter((f) => f.conditionSeqId !== seqId); },
        () => deleteFilter(this.tree!.variationGroupId, rid, seqId));
    },
    setRuleStatus(rid: string, ruleId: string, statusId: string) {
      return this._withSave(`rule:${ruleId}`,
        () => { const rl = this._findRule(rid, ruleId); if (rl) rl.statusId = statusId; },
        () => setRule(this.tree!.variationGroupId, rid, ruleId, { statusId }));
    },
    reorderRules(rid: string, orderedRuleIds: string[]) {
      const vid = this.tree!.variationGroupId;
      orderedRuleIds.forEach((ruleId, i) => {
        const rl = this._findRule(rid, ruleId); if (rl) rl.sequenceNum = i;
        void setRule(vid, rid, ruleId, { sequenceNum: i }).catch((e) => logger.error(e));
      });
    },
    upsertInventoryCondition(rid: string, ruleId: string, cond: VariationConditionInput) {
      return this._withSave(`invcond:${ruleId}:${cond.conditionSeqId}`,
        () => {
          const rl = this._findRule(rid, ruleId); if (!rl) return;
          const ex = rl.inventoryConditions.find((c) => c.conditionSeqId === cond.conditionSeqId);
          if (ex) Object.assign(ex, cond); else rl.inventoryConditions.push({ ...cond });
        },
        () => upsertInventoryCondition(this.tree!.variationGroupId, rid, ruleId, cond));
    },
    removeInventoryCondition(rid: string, ruleId: string, seqId: string) {
      return this._withSave(`invcond:${ruleId}:${seqId}`,
        () => { const rl = this._findRule(rid, ruleId); if (rl) rl.inventoryConditions = rl.inventoryConditions.filter((c) => c.conditionSeqId !== seqId); },
        () => deleteInventoryCondition(this.tree!.variationGroupId, rid, ruleId, seqId));
    },
    upsertAction(rid: string, ruleId: string, action: VariationActionInput) {
      return this._withSave(`action:${ruleId}:${action.actionSeqId}`,
        () => {
          const rl = this._findRule(rid, ruleId); if (!rl) return;
          const ex = rl.actions.find((a) => a.actionSeqId === action.actionSeqId);
          if (ex) Object.assign(ex, action); else rl.actions.push({ ...action });
        },
        () => upsertAction(this.tree!.variationGroupId, rid, ruleId, action));
    },
    removeAction(rid: string, ruleId: string, seqId: string) {
      return this._withSave(`action:${ruleId}:${seqId}`,
        () => { const rl = this._findRule(rid, ruleId); if (rl) rl.actions = rl.actions.filter((a) => a.actionSeqId !== seqId); },
        () => deleteAction(this.tree!.variationGroupId, rid, ruleId, seqId));
    },
    async runComparison(sampleCap = 500) {
      const tree = this.tree;
      if (!tree) return;
      this.runError = null;
      this.variationResult = null;
      this.isRunningVariation = true;
      // Parent run only if not already cached for this parent (it's stable).
      const needParent = !this.parentResultByParentId[tree.parentRoutingGroupId];
      if (needParent) { this.isRunningParent = true; this.parentProgress = null; }
      try {
        const [variation] = await Promise.all([
          runVariation(tree.variationGroupId, sampleCap).finally(() => { this.isRunningVariation = false; }),
          needParent
            ? runParentLiveConfig(tree.parentRoutingGroupId, sampleCap, (p) => { this.parentProgress = p; })
                .then((gr) => { this.parentResultByParentId[tree.parentRoutingGroupId] = gr; })
                .catch((e) => { logger.error(e); }) // parent failure -> variation-only view
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
        const gr = await runParentLiveConfig(tree.parentRoutingGroupId, sampleCap, (p) => { this.parentProgress = p; });
        this.parentResultByParentId[tree.parentRoutingGroupId] = gr;
      } catch (e) {
        logger.error(e);
      } finally {
        this.isRunningParent = false;
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(variationStore, import.meta.hot));
}
