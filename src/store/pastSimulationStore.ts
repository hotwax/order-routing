// src/store/pastSimulationStore.ts
// SWR orchestration for the Past Simulations viewer.
// - List: cache-then-revalidate (default view only); filtered queries always live, never cached.
// - Detail: cache-first for immutable (COMPLETE/FAILED) runs; fetch on miss or non-terminal.
import { acceptHMRUpdate, defineStore } from "pinia";
import { SimulationService } from "@/services/SimulationService";
import { SimulationStorage } from "@/services/simulationStorage";
import type { PastSimulationsFilters, PastSimHeader } from "@/types/simulation";
import { persistedSimulationAdapter, type AdaptedResults } from "@/utils/simulationResults";

const TERMINAL = new Set(["COMPLETE", "FAILED"]);
let listGeneration = 0;
let detailGeneration = 0;
let listController: AbortController | null = null;
let detailController: AbortController | null = null;

function staleRequestError() {
  return new DOMException("A newer simulation request replaced this one.", "AbortError");
}

export const usePastSimulationStore = defineStore("pastSimulation", {
  state: () => ({
    list: [] as PastSimHeader[],
    listLoading: false,
    listRefreshing: false,
    listError: null as string | null,
    total: 0,
    listProductStoreId: "" as string,
    detailById: {} as Record<string, AdaptedResults>,
    detailRawById: {} as Record<string, any>,
    detailLoading: false,
    detailError: null as string | null,
  }),
  actions: {
    async loadList(filters: PastSimulationsFilters) {
      const generation = ++listGeneration;
      listController?.abort();
      listController = new AbortController();
      const signal = listController.signal;
      this.listError = null;
      const requestedProductStoreId = String(filters.productStoreId || "").trim();
      if (requestedProductStoreId !== this.listProductStoreId) {
        this.list = [];
        this.total = 0;
        this.listProductStoreId = requestedProductStoreId;
      }
      const filtered = SimulationService.isFilteredQuery(filters);
      if (filtered) {
        this.listLoading = true;
        try {
          const { headers, total } = await SimulationService.fetchPastSimulations(filters, signal);
          if (generation !== listGeneration) return;
          this.list = headers; this.total = total;
        }
        catch (e: any) {
          if (generation === listGeneration && e?.name !== "AbortError") this.listError = e?.message ?? "Failed to load simulations.";
        }
        finally { if (generation === listGeneration) this.listLoading = false; }
        return;
      }
      // default view: show cache immediately, revalidate in the background.
      const cached = SimulationStorage.getList(filters.productStoreId);
      if (cached.length) { this.list = cached; this.listLoading = false; this.listRefreshing = true; }
      else { this.listLoading = true; }
      try {
        const { headers, total } = await SimulationService.fetchPastSimulations(filters, signal);
        if (generation !== listGeneration) return;
        this.list = headers; this.total = total;
        SimulationStorage.setList(filters.productStoreId, headers);
      } catch (e: any) {
        if (generation === listGeneration && e?.name !== "AbortError") this.listError = e?.message ?? "Failed to refresh simulations.";
      } finally {
        if (generation === listGeneration) { this.listLoading = false; this.listRefreshing = false; }
      }
    },

    async loadDetail(simulationId: string): Promise<AdaptedResults> {
      const generation = ++detailGeneration;
      detailController?.abort();
      detailController = new AbortController();
      const signal = detailController.signal;
      this.detailError = null;
      if (this.detailById[simulationId]) {
        this.detailLoading = false;
        return this.detailById[simulationId];
      }
      const cached = SimulationStorage.getDetail(simulationId);
      if (cached && TERMINAL.has(String(cached.header?.statusId))) {
        const adapted = persistedSimulationAdapter(cached.raw);
        this.detailRawById[simulationId] = cached.raw; this.detailById[simulationId] = adapted;
        this.detailLoading = false;
        return adapted;
      }
      this.detailLoading = true;
      try {
        const raw = await SimulationService.fetchPastSimulation(simulationId, signal);   // R2: { simulation:{header}, variants:[] }
        if (generation !== detailGeneration) throw staleRequestError();
        const header = raw?.simulation ?? raw;
        const adapted = persistedSimulationAdapter(raw);
        this.detailRawById[simulationId] = raw; this.detailById[simulationId] = adapted;
        if (TERMINAL.has(String(header?.statusId))) {
          SimulationStorage.putDetail(simulationId, { header, raw, cachedAt: Date.now() });
        }
        return adapted;
      } catch (e: any) {
        if (generation === detailGeneration && e?.name !== "AbortError") this.detailError = e?.message ?? "Failed to load simulation.";
        throw e;
      } finally {
        if (generation === detailGeneration) this.detailLoading = false;
      }
    },

    // Called when a fresh live run completes (simulationStore deep-link hook): make it visible now.
    recordCompletedRun(header: PastSimHeader) {
      if (!header?.simulationId || !header?.productStoreId) return;
      SimulationStorage.prependHeader(header.productStoreId, header);
      if (header.productStoreId === this.listProductStoreId) {
        this.list = [header, ...this.list.filter((h) => h.simulationId !== header.simulationId)];
      }
    },
  },
});

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePastSimulationStore, import.meta.hot));
