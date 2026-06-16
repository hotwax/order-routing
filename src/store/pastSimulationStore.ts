// src/store/pastSimulationStore.ts
// SWR orchestration for the Past Simulations viewer.
// - List: cache-then-revalidate (default view only); filtered queries always live, never cached.
// - Detail: cache-first for immutable (COMPLETE/FAILED) runs; fetch on miss or non-terminal.
import { acceptHMRUpdate, defineStore } from "pinia";
import { SimulationService } from "@/services/SimulationService";
import { SimulationStorage } from "@/services/simulationStorage";
import type { PastSimulationsFilters, PastSimHeader } from "@/types/simulation";
import { persistedSimulationAdapter, type AdaptedResults } from "@/util/simulationResults";

const TERMINAL = new Set(["COMPLETE", "FAILED"]);

export const usePastSimulationStore = defineStore("pastSimulation", {
  state: () => ({
    list: [] as PastSimHeader[],
    listLoading: false,
    listRefreshing: false,
    listError: null as string | null,
    total: 0,
    detailById: {} as Record<string, AdaptedResults>,
    detailRawById: {} as Record<string, any>,
    detailLoading: false,
    detailError: null as string | null,
  }),
  actions: {
    async loadList(filters: PastSimulationsFilters) {
      this.listError = null;
      const filtered = SimulationService.isFilteredQuery(filters);
      if (filtered) {
        this.listLoading = true;
        try { const { headers, total } = await SimulationService.fetchPastSimulations(filters); this.list = headers; this.total = total; }
        catch (e: any) { this.listError = e?.message ?? "Failed to load simulations."; }
        finally { this.listLoading = false; }
        return;
      }
      // default view: show cache immediately, revalidate in the background.
      const cached = SimulationStorage.getList(filters.productStoreId);
      if (cached.length) { this.list = cached; this.listLoading = false; this.listRefreshing = true; }
      else { this.listLoading = true; }
      try {
        const { headers, total } = await SimulationService.fetchPastSimulations(filters);
        this.list = headers; this.total = total;
        SimulationStorage.setList(filters.productStoreId, headers);
      } catch (e: any) {
        this.listError = e?.message ?? "Failed to refresh simulations.";
      } finally {
        this.listLoading = false; this.listRefreshing = false;
      }
    },

    async loadDetail(simulationId: string): Promise<AdaptedResults> {
      this.detailError = null;
      if (this.detailById[simulationId]) return this.detailById[simulationId];
      const cached = SimulationStorage.getDetail(simulationId);
      if (cached && TERMINAL.has(String(cached.header?.statusId))) {
        const adapted = persistedSimulationAdapter(cached.raw);
        this.detailRawById[simulationId] = cached.raw; this.detailById[simulationId] = adapted;
        return adapted;
      }
      this.detailLoading = true;
      try {
        const raw = await SimulationService.fetchPastSimulation(simulationId);   // R2: { simulation:{header}, variants:[] }
        const header = raw?.simulation ?? raw;
        const adapted = persistedSimulationAdapter(raw);
        this.detailRawById[simulationId] = raw; this.detailById[simulationId] = adapted;
        if (TERMINAL.has(String(header?.statusId))) {
          SimulationStorage.putDetail(simulationId, { header, raw, cachedAt: Date.now() });
        }
        return adapted;
      } catch (e: any) {
        this.detailError = e?.message ?? "Failed to load simulation.";
        throw e;
      } finally {
        this.detailLoading = false;
      }
    },

    // Called when a fresh live run completes (simulationStore deep-link hook): make it visible now.
    recordCompletedRun(header: PastSimHeader) {
      if (!header?.simulationId || !header?.productStoreId) return;
      SimulationStorage.prependHeader(header.productStoreId, header);
      this.list = [header, ...this.list.filter((h) => h.simulationId !== header.simulationId)];
    },
  },
});

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePastSimulationStore, import.meta.hot));
