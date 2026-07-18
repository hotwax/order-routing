import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@common", () => ({
  api: vi.fn(),
  client: vi.fn(),
  commonUtil: {
    getToken: () => "token",
    hasError: (response: any) => response?._error === true,
    showToast: vi.fn(),
  },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  translate: (value: string) => value,
}));

import {
  SimulationStorage,
  clearJobs,
  clearVariationRun,
  getJobs,
  getVariationRun,
  recordJobs,
  removeJob,
  setVariationRun,
  upsertJob,
} from "../src/services/simulationStorage";
import type { SimJobRecord, StorageLike } from "../src/types/simulation";
import {
  SimulationPollError,
  SimulationService,
} from "../src/services/SimulationService";
import { simulationStore } from "../src/store/simulationStore";
import { VariationService } from "../src/services/VariationService";

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
}

const NOW = 1_000_000_000_000;
const record = (jobId: string, submittedAt = NOW, batchIndex = 0, batchCount = 1, variantLabels = ["V"]): SimJobRecord => ({
  jobId,
  batchIndex,
  batchCount,
  variantLabels,
  submittedAt,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function prepareBatchStore(count = 6) {
  const sim = simulationStore();
  const baseline = { routingGroupId: "G1", productStoreId: "STORE", distance: 100, routings: [] };
  sim.routingGroupId = "G1";
  sim.baseline = JSON.parse(JSON.stringify(baseline));
  sim.working = JSON.parse(JSON.stringify(baseline));
  sim.variations = Array.from({ length: count }, (_, index) => ({
    id: `V${index + 1}`,
    label: `Variation ${index + 1}`,
    group: { ...JSON.parse(JSON.stringify(baseline)), distance: 101 + index },
  })) as any;
  return sim;
}

function prepareCanonicalVariationStore() {
  const sim = simulationStore();
  const group = { routingGroupId: "G1", productStoreId: "STORE", routings: [] };
  sim.routingGroupId = "G1";
  sim.groupLoadState = "ready";
  sim.baseline = JSON.parse(JSON.stringify(group));
  sim.working = { ...JSON.parse(JSON.stringify(group)), variationGroupId: "V1" };
  sim.variations = [{
    id: "V1",
    label: "Safer routing",
    serverVid: "V1",
    group: JSON.parse(JSON.stringify(sim.working)),
  }] as any;
  sim.activeVariationId = "V1";
  sim.parentRunByGroupId.G1 = { routingGroupId: "G1", routingResults: [] } as any;
  return sim;
}

describe("simulation in-flight job storage", () => {
  it("round-trips, prunes, removes, and clears records", () => {
    const storage = fakeStorage();
    recordJobs("G1", [record("old", NOW - 3 * 60 * 60_000), record("young", NOW - 10 * 60_000)], storage);

    expect(getJobs("G1", NOW, storage).map((job) => job.jobId)).toEqual(["young"]);
    removeJob("G1", "young", storage);
    expect(storage.map.has("sim.inflight.G1")).toBe(false);

    const currentTime = Date.now();
    recordJobs("G1", [record("j1", currentTime)], storage);
    upsertJob("G1", record("j2", currentTime, 1), storage);
    expect(getJobs("G1", currentTime, storage).map((job) => job.jobId)).toEqual(["j1", "j2"]);
    clearJobs("G1", storage);
    expect(getJobs("G1", NOW, storage)).toEqual([]);
  });

  it("fails closed for corrupt and unavailable browser storage", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const storage = fakeStorage();
    storage.setItem("sim.inflight.BAD", "{not json");
    expect(getJobs("BAD", NOW, storage)).toEqual([]);

    const unavailable: StorageLike = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("SecurityError"); },
      removeItem: () => { throw new Error("SecurityError"); },
    };
    expect(() => recordJobs("G1", [record("j1")], unavailable)).not.toThrow();
    expect(() => removeJob("G1", "j1", unavailable)).not.toThrow();
    expect(() => clearJobs("G1", unavailable)).not.toThrow();
    expect(getJobs("G1", NOW, unavailable)).toEqual([]);
  });

  it("persists and prunes canonical variation-run recovery markers", () => {
    const storage = fakeStorage();
    const marker = {
      routingGroupId: "G1",
      variationId: "V1",
      serverVariationId: "V1",
      variationLabel: "Safer routing",
      sampleCap: 500,
      startedAt: NOW,
      status: "running" as const,
    };

    setVariationRun(marker, storage);
    expect(getVariationRun("G1", NOW, storage)).toEqual(marker);
    expect(getVariationRun("G1", NOW + 8 * 24 * 60 * 60_000, storage)).toBeNull();

    setVariationRun(marker, storage);
    clearVariationRun("G1", storage);
    expect(getVariationRun("G1", NOW, storage)).toBeNull();
  });
});

describe("simulation batch submission and recovery", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("localStorage", fakeStorage());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("streams batch progress and marks a completed batch done", async () => {
    const sim = prepareBatchStore(1);
    sim.runStates = [{ variationId: "V1", label: "Variation 1", phase: "submitted" }];
    sim.batchProgress = [{
      batchIndex: 0,
      phaseLabel: "",
      phaseIndex: 0,
      phaseCount: 0,
      ordersInScope: 0,
      ordersProcessed: 0,
      brokered: 0,
      queued: 0,
      events: [],
    }];
    recordJobs("G1", [record("J1", Date.now())]);
    vi.spyOn(SimulationService, "pollJob").mockImplementation(async (_group, _job, onPhase, onProgress) => {
      onPhase?.("running");
      onProgress?.({
        phase: "BROKER",
        phaseLabel: "Brokering",
        phaseIndex: 1,
        phaseCount: 2,
        ordersInScope: 20,
        ordersProcessed: 10,
        brokered: 8,
        queued: 2,
        events: [{ seq: 1, orderId: "O1", facilityId: "F1", finalReason: "routed" }],
        nextSeq: 2,
      });
      return { variation: { simulationId: "S1", variants: [] } };
    });

    await expect(sim.runBatch({ batchIndex: 0, ids: ["V1"], jobId: "J1" }))
      .resolves.toEqual({ variation: { simulationId: "S1", variants: [] } });

    expect(sim.runStates[0].phase).toBe("done");
    expect(sim.batchProgress[0]).toMatchObject({ phaseLabel: "Brokering", ordersProcessed: 10, brokered: 8 });
    expect(sim.lastSimulationId).toBe("S1");
    // Aggregate submit/resume owns cleanup so another interrupted batch can recover this result.
    expect(getJobs("G1").map((job) => job.jobId)).toEqual(["J1"]);
  });

  it("marks the aggregate partial when one batch cannot be submitted", async () => {
    const sim = prepareBatchStore(6);
    vi.spyOn(SimulationService, "submitBatch")
      .mockResolvedValueOnce("J1")
      .mockRejectedValueOnce(new Error("submit unavailable"));
    vi.spyOn(SimulationService, "pollJob").mockResolvedValue({
      variation: {
        baseline: { groupRun: { brokeredItemCount: 10 } },
        variants: Array.from({ length: 5 }, (_, index) => ({ label: `Variation ${index + 1}` })),
      },
    });

    await sim.submit();

    expect(SimulationService.submitBatch).toHaveBeenCalledTimes(2);
    expect(SimulationService.submitBatch).toHaveBeenCalledWith(expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(sim.results?.partial).toBe(true);
    expect(sim.results?.variants).toHaveLength(5);
    expect(sim.runStates.slice(0, 5).every((state) => state.phase === "done")).toBe(true);
    expect(sim.runStates[5]).toMatchObject({ phase: "failed", error: "submit unavailable" });
    expect(sim.isRunning).toBe(false);
    expect(getJobs("G1")).toEqual([]);
  });

  it("records each accepted job before the other parallel submissions finish", async () => {
    const sim = prepareBatchStore(6);
    const secondJob = deferred<string>();
    vi.spyOn(SimulationService, "submitBatch")
      .mockResolvedValueOnce("J1")
      .mockImplementationOnce(() => secondJob.promise);
    vi.spyOn(SimulationService, "pollJob").mockResolvedValue({
      variation: { baseline: { groupRun: {} }, variants: [] },
    });

    const submitting = sim.submit();
    await vi.waitFor(() => expect(getJobs("G1").map((job) => job.jobId)).toEqual(["J1"]));

    secondJob.resolve("J2");
    await submitting;
    expect(getJobs("G1")).toEqual([]);
  });

  it("keeps every batch record after a recoverable interruption and merges all batches on resume", async () => {
    const sim = simulationStore();
    recordJobs("G1", [
      record("J1", Date.now(), 0, 2, ["First"]),
      record("J2", Date.now(), 1, 2, ["Second"]),
    ]);
    vi.spyOn(SimulationService, "pollJob").mockImplementation(async (_group, jobId) => {
      if (jobId === "J2") throw new SimulationPollError("offline", true);
      return { variation: { baseline: { groupRun: { brokeredItemCount: 2 } }, variants: [{ label: "First" }] } };
    });

    await sim.resumeInFlight("G1");

    expect(sim.results?.partial).toBe(true);
    expect(getJobs("G1").map((job) => job.jobId)).toEqual(["J1", "J2"]);

    vi.mocked(SimulationService.pollJob).mockImplementation(async (_group, jobId) => ({
      variation: {
        baseline: { groupRun: { brokeredItemCount: 2 } },
        variants: [{ label: jobId === "J1" ? "First" : "Second" }],
      },
    }));
    await sim.resumeInFlight("G1");

    expect(sim.results?.partial).toBe(false);
    expect(sim.results?.variants.map((variant) => variant.label)).toEqual(["First", "Second"]);
    expect(getJobs("G1")).toEqual([]);
  });

  it("does not let an older submission overwrite a newer completed result", async () => {
    const sim = prepareBatchStore(1);
    const oldResult = deferred<any>();
    vi.spyOn(SimulationService, "submitBatch")
      .mockResolvedValueOnce("OLD")
      .mockResolvedValueOnce("NEW");
    vi.spyOn(SimulationService, "pollJob").mockImplementation(async (_group, jobId) => {
      if (jobId === "OLD") return oldResult.promise;
      return { variation: { baseline: { groupRun: {} }, variants: [{ label: "new-result" }] } };
    });

    const first = sim.submit();
    await vi.waitFor(() => expect(SimulationService.pollJob).toHaveBeenCalledWith(
      "G1", "OLD", expect.any(Function), expect.any(Function), expect.any(AbortSignal),
    ));
    const second = sim.submit();
    await second;
    expect(sim.results?.variants[0]?.label).toBe("new-result");

    oldResult.resolve({ variation: { baseline: { groupRun: {} }, variants: [{ label: "stale-result" }] } });
    await first;

    expect(sim.results?.variants[0]?.label).toBe("new-result");
    expect(sim.isRunning).toBe(false);
  });

  it("durably marks a synchronous variation run until its result is adopted", async () => {
    const sim = prepareCanonicalVariationStore();
    const runResult = deferred<any>();
    vi.spyOn(VariationService, "runVariation").mockImplementation(() => runResult.promise);

    const running = sim.runActiveVariation(250);
    await vi.waitFor(() => expect(getVariationRun("G1")).toMatchObject({
      status: "running",
      variationId: "V1",
      variationLabel: "Safer routing",
      sampleCap: 250,
    }));

    runResult.resolve({ routingGroupId: "V1", routingResults: [] });
    await expect(running).resolves.toBe(true);
    expect(getVariationRun("G1")).toBeNull();
    expect(sim.interruptedVariationRun).toBeNull();
    expect(sim.lastSimulationId).toBeNull();
  });

  it("archives and removes an active variation before returning the canvas to baseline", async () => {
    const sim = prepareCanonicalVariationStore();
    sim.variationRunResult = { routingGroupId: "V1", routingResults: [] } as any;
    const discard = vi.spyOn(VariationService, "deleteVariation").mockResolvedValue(undefined);

    await expect(sim.discardVariation("V1")).resolves.toBe(true);

    expect(discard).toHaveBeenCalledWith("V1");
    expect(sim.variations).toEqual([]);
    expect(sim.activeVariationId).toBe("");
    expect(sim.working).toEqual(sim.baseline);
    expect(sim.variationRunResult).toBeNull();
    expect(sim.isSavingVariation).toBe(false);
  });

  it("runs the live baseline as a first-class simulation source", async () => {
    const sim = simulationStore();
    const baseline = { routingGroupId: "G1", productStoreId: "STORE", routings: [] };
    const result = {
      simulationId: "S_BASE",
      routingGroupId: "G1",
      productStoreId: "STORE",
      attemptedItemCount: 10,
      brokeredItemCount: 8,
      queuedItemCount: 2,
      routingResults: []
    };
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = structuredClone(baseline);
    sim.working = structuredClone(baseline);
    const runParent = vi.spyOn(SimulationService, "runParentLiveConfig")
      .mockImplementation(async (_groupId, _sampleCap, onProgress) => {
        onProgress?.({ phaseLabel: "Brokering", ordersProcessed: 4 } as any);
        return result;
      });

    await expect(sim.runBaseline(250)).resolves.toBe(true);

    expect(runParent).toHaveBeenCalledWith("G1", 250, expect.any(Function), expect.any(AbortSignal));
    expect(sim.baselineRunResult).toEqual(result);
    expect(sim.parentRunByGroupId.G1).toEqual(result);
    expect(sim.parentRunProgress).toMatchObject({ phaseLabel: "Brokering", ordersProcessed: 4 });
    expect(sim.lastSimulationId).toBe("S_BASE");
    expect(sim.isRunningBaselineRun).toBe(false);
  });

  it("refuses to run a baseline whose visible working copy is dirty", async () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = { routingGroupId: "G1", routings: [] };
    sim.working = { routingGroupId: "G1", routings: [{ orderRoutingId: "LOCAL" }] };
    const runParent = vi.spyOn(SimulationService, "runParentLiveConfig");

    await expect(sim.runBaseline()).resolves.toBe(false);

    expect(runParent).not.toHaveBeenCalled();
    expect(sim.baselineRunError).toBe("Save or discard live changes before running the baseline.");
  });

  it("adopts a persisted variation simulation id before clearing the durable marker", async () => {
    const sim = prepareCanonicalVariationStore();
    const runResult = deferred<any>();
    vi.spyOn(VariationService, "runVariation").mockImplementation(() => runResult.promise);
    const originalClear = SimulationStorage.clearVariationRun;
    const clear = vi.spyOn(SimulationStorage, "clearVariationRun").mockImplementation((routingGroupId) => {
      expect(sim.variationRunResult).toMatchObject({ simulationId: "M100374", routingGroupId: "V1" });
      expect(sim.lastSimulationId).toBe("M100374");
      originalClear(routingGroupId);
    });

    const running = sim.runActiveVariation();
    await vi.waitFor(() => expect(getVariationRun("G1")?.status).toBe("running"));
    runResult.resolve({ simulationId: "M100374", routingGroupId: "V1", routingResults: [] });

    await expect(running).resolves.toBe(true);
    expect(clear).toHaveBeenCalledWith("G1");
    expect(sim.lastSimulationId).toBe("M100374");
    expect(getVariationRun("G1")).toBeNull();
  });

  it("preserves an explicit outcome-unknown record when the synchronous request is interrupted", async () => {
    const sim = prepareCanonicalVariationStore();
    vi.spyOn(VariationService, "runVariation").mockRejectedValue(new Error("connection lost"));

    await expect(sim.runActiveVariation()).resolves.toBe(false);

    expect(sim.isRunningVariationRun).toBe(false);
    expect(sim.variationRunResult).toBeNull();
    expect(sim.lastSimulationId).toBeNull();
    expect(sim.interruptedVariationRun).toMatchObject({ status: "interrupted", variationId: "V1" });
    expect(getVariationRun("G1")).toMatchObject({ status: "interrupted", lastError: "connection lost" });
    expect(sim.runCompareError).toContain("outcome is unknown");
    expect(sim.runCompareError).toContain("safe to run the saved variation again");
  });

  it("turns a leftover running marker into an interrupted state when the group reloads", async () => {
    const sim = simulationStore();
    setVariationRun({
      routingGroupId: "G1",
      variationId: "V1",
      serverVariationId: "V1",
      variationLabel: "Safer routing",
      sampleCap: 500,
      startedAt: Date.now(),
      status: "running",
    });
    sim.isRunningVariationRun = true;
    sim.variationRunResult = { routingGroupId: "stale" } as any;
    sim.lastSimulationId = "not-confirmed";
    sim.simGroups = [{ routingGroupId: "G1" }];
    sim.fetchSimGroupDetail = vi.fn(async () => ({ routingGroupId: "G1", routings: [] })) as any;
    sim.fetchServerVariations = vi.fn(async () => [{
      id: "V1", label: "Safer routing", serverVid: "V1", group: null,
    }]) as any;

    await expect(sim.loadGroup("G1")).resolves.toBe(true);

    expect(sim.isRunningVariationRun).toBe(false);
    expect(sim.variationRunResult).toBeNull();
    expect(sim.lastSimulationId).toBeNull();
    expect(sim.interruptedVariationRun?.status).toBe("interrupted");
    expect(getVariationRun("G1")?.status).toBe("interrupted");
    expect(sim.runCompareError).toContain("did not receive a saved simulation ID");
  });
});
