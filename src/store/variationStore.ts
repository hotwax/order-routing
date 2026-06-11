// src/store/variationStore.ts
import { acceptHMRUpdate, defineStore } from "pinia";
import { logger } from "@common";
import { productStore } from "./productStore";
import { listVariations, createVariation, getVariation } from "../services/VariationService";
import { simProductStoreId } from "../services/SimulationService";
import { joinRoutingResults } from "../util/routingResultJoin";
import { buildRoutingNameMap, sortBySequence } from "../util/variationTree";
import type { CompareRow, GroupRunResult, VariationListItem, VariationRouting, VariationTree } from "../types/variation";

export const variationStore = defineStore("variation", {
  state: () => ({
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
    // --- edit actions (Task 8) and run actions (Task 9) inserted below ---
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(variationStore, import.meta.hot));
}
