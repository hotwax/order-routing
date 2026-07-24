// tests/pastSimulationStore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@common", () => ({})); // store imports nothing from @common directly, but guard the alias.
const fetchPastSimulations = vi.fn();
const fetchPastSimulation = vi.fn();
vi.mock("@/services/SimulationService", () => ({
  SimulationService: {
    fetchPastSimulations: (...a: any[]) => fetchPastSimulations(...a),
    fetchPastSimulation: (...a: any[]) => fetchPastSimulation(...a),
    isFilteredQuery: (f: any) => Boolean(f.routingGroupId || f.statusId || f.runType || f.fromDate || f.thruDate),
  },
}));
// In-memory storage so the cache module persists within the test.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

// Relative import for the SUT (matches the repo's existing vitest pattern); the store's own
// internal `@/services/...` imports still resolve via the vitest `@` alias and are mocked above.
import { usePastSimulationStore } from "../src/store/pastSimulationStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("pastSimulationStore", () => {
  beforeEach(() => { setActivePinia(createPinia()); store.clear(); fetchPastSimulations.mockReset(); fetchPastSimulation.mockReset(); });

  it("serves cached list immediately, then revalidates and swaps", async () => {
    const s = usePastSimulationStore();
    // seed cache via a first successful load
    fetchPastSimulations.mockResolvedValueOnce({ headers: [{ simulationId: "A", productStoreId: "ST", createdDate: "2026-06-09T10:00:00Z", statusId: "COMPLETE" }], total: 1 });
    await s.loadList({ productStoreId: "ST", pageIndex: 0, pageSize: 25 });
    expect(s.list.map((h: any) => h.simulationId)).toEqual(["A"]);

    // second load: cache hit is shown synchronously; revalidate returns A+B
    fetchPastSimulations.mockResolvedValueOnce({ headers: [
      { simulationId: "B", productStoreId: "ST", createdDate: "2026-06-09T11:00:00Z", statusId: "COMPLETE" },
      { simulationId: "A", productStoreId: "ST", createdDate: "2026-06-09T10:00:00Z", statusId: "COMPLETE" },
    ], total: 2 });
    const p = s.loadList({ productStoreId: "ST", pageIndex: 0, pageSize: 25 });
    expect(s.list.map((h: any) => h.simulationId)).toEqual(["A"]); // cached shown first
    await p;
    expect(s.list.map((h: any) => h.simulationId)).toEqual(["B", "A"]); // revalidated
  });

  it("keeps cached list and sets listError when revalidate fails", async () => {
    const s = usePastSimulationStore();
    fetchPastSimulations.mockResolvedValueOnce({ headers: [{ simulationId: "A", productStoreId: "ST", createdDate: "2026-06-09T10:00:00Z", statusId: "COMPLETE" }], total: 1 });
    await s.loadList({ productStoreId: "ST", pageIndex: 0, pageSize: 25 });
    fetchPastSimulations.mockRejectedValueOnce(new Error("boom"));
    await s.loadList({ productStoreId: "ST", pageIndex: 0, pageSize: 25 });
    expect(s.list.map((h: any) => h.simulationId)).toEqual(["A"]);
    expect(s.listError).toBeTruthy();
  });

  it("bypasses cache for filtered queries", async () => {
    const s = usePastSimulationStore();
    fetchPastSimulations.mockResolvedValueOnce({ headers: [{ simulationId: "F", productStoreId: "ST", createdDate: "2026-06-09T10:00:00Z", statusId: "FAILED" }], total: 1 });
    await s.loadList({ productStoreId: "ST", statusId: "FAILED", pageIndex: 0, pageSize: 25 });
    expect(store.has("sim.history.list.ST")).toBe(false); // not cached
  });

  it("loadDetail serves cached terminal run without refetch, fetches on miss", async () => {
    const s = usePastSimulationStore();
    fetchPastSimulation.mockResolvedValueOnce({
      simulation: { simulationId: "A", statusId: "COMPLETE", runType: "SINGLE", partial: "N", simulationRan: "Y" },
      variants: [{ variantSeqId: 0, isBaseline: "Y", failed: "N", brokeredItemCount: 1, attemptedItemCount: 1, queuedItemCount: 0 }],
    });
    const d1 = await s.loadDetail("A");
    expect(d1.baseline.brokeredItemCount).toBe(1);
    expect(fetchPastSimulation).toHaveBeenCalledTimes(1);
    const d2 = await s.loadDetail("A"); // cached terminal -> no second fetch
    expect(d2.baseline.brokeredItemCount).toBe(1);
    expect(fetchPastSimulation).toHaveBeenCalledTimes(1);
  });

  it("recordCompletedRun prepends + dedupes in the list cache", async () => {
    const s = usePastSimulationStore();
    fetchPastSimulations.mockResolvedValueOnce({ headers: [{ simulationId: "A", productStoreId: "ST", createdDate: "2026-06-09T10:00:00Z", statusId: "COMPLETE" }], total: 1 });
    await s.loadList({ productStoreId: "ST", pageIndex: 0, pageSize: 25 });
    s.recordCompletedRun({ simulationId: "NEW", productStoreId: "ST", createdDate: "2026-06-09T12:00:00Z", statusId: "COMPLETE" });
    expect(s.list[0].simulationId).toBe("NEW");
  });

  it("does not let an older list response replace a newer store/filter request", async () => {
    const s = usePastSimulationStore();
    const oldRequest = deferred<any>();
    const newRequest = deferred<any>();
    fetchPastSimulations
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const oldLoad = s.loadList({ productStoreId: "OLD", pageIndex: 0, pageSize: 25 });
    const newLoad = s.loadList({ productStoreId: "NEW", pageIndex: 0, pageSize: 25 });
    newRequest.resolve({ headers: [{ simulationId: "NEW", productStoreId: "NEW" }], total: 1 });
    await newLoad;
    oldRequest.resolve({ headers: [{ simulationId: "OLD", productStoreId: "OLD" }], total: 1 });
    await oldLoad;

    expect(s.list.map((header) => header.simulationId)).toEqual(["NEW"]);
    expect(s.total).toBe(1);
  });

  it("rejects a stale detail completion without publishing it", async () => {
    const s = usePastSimulationStore();
    const oldRequest = deferred<any>();
    const newRequest = deferred<any>();
    fetchPastSimulation
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const oldLoad = s.loadDetail("OLD");
    const newLoad = s.loadDetail("NEW");
    newRequest.resolve({
      simulation: { simulationId: "NEW", statusId: "COMPLETE", runType: "SINGLE" },
      variants: [{ variantSeqId: 0, isBaseline: "Y", brokeredItemCount: 2, attemptedItemCount: 2, queuedItemCount: 0 }],
    });
    await newLoad;
    oldRequest.resolve({
      simulation: { simulationId: "OLD", statusId: "COMPLETE", runType: "SINGLE" },
      variants: [{ variantSeqId: 0, isBaseline: "Y", brokeredItemCount: 1, attemptedItemCount: 1, queuedItemCount: 0 }],
    });
    await expect(oldLoad).rejects.toMatchObject({ name: "AbortError" });

    expect(s.detailById.NEW).toBeTruthy();
    expect(s.detailById.OLD).toBeUndefined();
  });
});
