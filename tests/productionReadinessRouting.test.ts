import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import router, {
  ROUTING_TEST_DRIVE_PERMISSION_ID,
  routingGroupRequiresSaveBeforeTest,
  routingTestDrivePermissionGuard
} from "../src/router";
import { isFeatureEnabled } from "../src/utils/simConfig";
import { registerWorkingFlushHook, simulationStore } from "../src/store/simulationStore";
import { useUserStore } from "../src/store/userStore";
import { VariationService } from "../src/services/VariationService";
import { SimulationService } from "../src/services/SimulationService";
import { orderRoutingStore } from "../src/store/orderRoutingStore";

function redirectFor(path: string, params: Record<string, string> = {}) {
  const record = router.getRoutes().find((route) => route.path === path);
  expect(record, `missing route record for ${path}`).toBeTruthy();
  const redirect = record!.redirect;
  return typeof redirect === "function"
    ? redirect({ params } as any)
    : redirect;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("production-ready routing contracts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_TEST_DRIVE_ENABLED", "true");
    vi.stubEnv("VITE_TEST_DRIVE_BACKEND_AUTH_VERIFIED", "true");
    setActivePinia(createPinia());
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps every removed Brokering and tabs deep link on a canonical page", () => {
    expect(redirectFor("/brokering")).toBe("/order-routing");
    expect(redirectFor("/brokering/:routingGroupId/routes", { routingGroupId: "G1" })).toBe("/order-routing/G1");
    expect(redirectFor("/brokering/:routingGroupId/routes/test", { routingGroupId: "G1" })).toBe("/order-routing/G1/test");
    expect(redirectFor("/brokering/:routingGroupId/:orderRoutingId/rules", { routingGroupId: "G1", orderRoutingId: "R1" })).toBe("/order-routing/G1");
    expect(redirectFor("/circuit")).toBe("/order-routing");
    expect(redirectFor("/simulate/:routingGroupId", { routingGroupId: "G1" })).toBe("/order-routing/G1");
    expect(redirectFor("/tabs/brokering/:routingGroupId/routes", { routingGroupId: "G1" })).toBe("/order-routing/G1");
    expect(redirectFor("/tabs/brokering/:routingGroupId/routes/test", { routingGroupId: "G1" })).toBe("/order-routing/G1/test");
    expect(redirectFor("/tabs/brokering/:routingGroupId/:orderRoutingId/rules", { routingGroupId: "G1", orderRoutingId: "R1" })).toBe("/order-routing/G1");
  });

  it("honors the deployment simulation flag", () => {
    expect(isFeatureEnabled("simulation", { VITE_SIMULATION_ENABLED: "false" })).toBe(false);
    expect(isFeatureEnabled("simulation", { VITE_SIMULATION_ENABLED: "TRUE" })).toBe(false);
    expect(isFeatureEnabled("simulation", {
      VITE_SIMULATION_ENABLED: "TRUE",
      VITE_SIM_ALLOW_OMS_BEARER: "true",
      VITE_SIM_URL: "https://sim.example.test"
    })).toBe(true);
  });

  it("allows an authorized user to open the Test Drive route directly", () => {
    const user = useUserStore();
    user.permissions = [ROUTING_TEST_DRIVE_PERMISSION_ID];
    const next = vi.fn();

    routingTestDrivePermissionGuard({ params: { routingGroupId: "G1" } }, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    const record = router.getRoutes().find((route) => route.path === "/order-routing/:routingGroupId/test");
    expect(record?.meta.permissionId).toBe(ROUTING_TEST_DRIVE_PERMISSION_ID);
    expect(record?.beforeEnter).toBeTruthy();
  });

  it("redirects an unauthorized Test Drive deep link to its routing group", () => {
    const user = useUserStore();
    user.permissions = [];
    const next = vi.fn();

    routingTestDrivePermissionGuard({ params: { routingGroupId: "G1" } }, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith("/order-routing/G1");
  });

  it.each([
    { isNew: true },
    { hasUnsavedChanges: true }
  ])("redirects a permitted Test Drive deep link until the target is saved and clean", (state) => {
    const user = useUserStore();
    const routing = orderRoutingStore();
    user.permissions = [ROUTING_TEST_DRIVE_PERMISSION_ID];
    routing.currentGroup = { routingGroupId: "G1", ...state };
    routing.groups = [{ routingGroupId: "G1", ...state }];
    const next = vi.fn();

    expect(routingGroupRequiresSaveBeforeTest("G1")).toBe(true);
    routingTestDrivePermissionGuard({ params: { routingGroupId: "G1" } }, {}, next);

    expect(next).toHaveBeenCalledWith("/order-routing/G1");
  });

  it("does not let an old keyed editor unregister the active flush hook", () => {
    const sim = simulationStore();
    const first = vi.fn();
    const second = vi.fn();
    const disposeFirst = registerWorkingFlushHook(first);
    const disposeSecond = registerWorkingFlushHook(second);

    disposeFirst();
    sim.flushWorkingCopy();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    disposeSecond();
    sim.flushWorkingCopy();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("refuses to run a variation whose visible working copy is dirty", async () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.activeVariationId = "V1";
    sim.variations = [{ id: "V1", label: "Draft", serverVid: "V1", group: { routingGroupId: "G1", routings: [] } } as any];
    sim.baseline = { routingGroupId: "G1", routings: [] };
    sim.working = { routingGroupId: "G1", routings: [{ orderRoutingId: "R1" }] };

    await sim.runActiveVariation();

    expect(sim.runCompareError).toBe("Update the variation before running it.");
    expect(sim.isRunningVariationRun).toBe(false);
  });

  it("keeps a just-saved variation clean after an equivalent editor flush", () => {
    const sim = simulationStore();
    const saved = {
      routingGroupId: "G1",
      variationGroupId: "V1",
      routings: [{
        orderRoutingId: "V1_R1",
        routingName: "Standard",
        statusId: "ROUTING_ACTIVE",
        sequenceNum: 1,
        orderFilters: [
          { conditionSeqId: "01", conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "deliveryDays", sequenceNum: 2 },
          { conditionSeqId: "02", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityId", operator: "not-equals", fieldValue: "F1", sequenceNum: 1 }
        ],
        rules: []
      }]
    };
    const editorFlushed = structuredClone(saved);
    editorFlushed.routings[0].orderRoutingId = "editor-key";
    editorFlushed.routings[0].orderFilters.reverse();
    editorFlushed.routings[0].orderFilters[0].fieldName = "facilityId_excluded";
    sim.activeVariationId = "V1";
    sim.variations = [{ id: "V1", label: "Saved", serverVid: "V1", group: saved }] as any;
    sim.working = editorFlushed;

    expect(sim.isDirty).toBe(false);

    sim.working.routings[0].statusId = "ROUTING_DRAFT";
    expect(sim.isDirty).toBe(true);
  });

  it("runs a just-updated variation when the Run flush only changes editor projection shape", async () => {
    const sim = simulationStore();
    const saved = {
      routingGroupId: "G1",
      variationGroupId: "V1",
      routings: [{
        orderRoutingId: "V1_R1",
        routingName: "Standard",
        statusId: "ROUTING_ACTIVE",
        sequenceNum: 1,
        orderFilters: [
          { conditionSeqId: "01", conditionTypeEnumId: "ENTCT_SORT_BY", fieldName: "deliveryDays", sequenceNum: 2 },
          { conditionSeqId: "02", conditionTypeEnumId: "ENTCT_FILTER", fieldName: "facilityId", operator: "not-equals", fieldValue: "F1", sequenceNum: 1 }
        ],
        rules: []
      }]
    };
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = structuredClone(saved);
    sim.activeVariationId = "V1";
    sim.variations = [{ id: "V1", label: "Saved", serverVid: "V1", group: structuredClone(saved) }] as any;
    sim.working = structuredClone(saved);
    sim.parentRunByGroupId.G1 = { routingGroupId: "G1", routingResults: [] } as any;
    const run = vi.spyOn(VariationService, "runVariation").mockResolvedValue({
      routingGroupId: "V1",
      routingResults: [],
      simulationId: "S1"
    } as any);
    const disposeFlush = registerWorkingFlushHook(() => {
      sim.working.routings[0].orderRoutingId = "editor-key";
      sim.working.routings[0].orderFilters.reverse();
      sim.working.routings[0].orderFilters[0].fieldName = "facilityId_excluded";
    });

    try {
      expect(await sim.runActiveVariation()).toBe(true);
      expect(run).toHaveBeenCalledWith("V1", 500, expect.any(AbortSignal));
      expect(sim.runCompareError).toBeNull();
    } finally {
      disposeFlush();
    }
  });

  it("ignores a slower previous group load after navigation", async () => {
    const sim = simulationStore();
    sim.simGroups = [{ routingGroupId: "A" }, { routingGroupId: "B" }];
    const a = deferred<any>();
    const b = deferred<any>();
    sim.fetchSimGroupDetail = vi.fn((id: string) => id === "A" ? a.promise : b.promise) as any;
    sim.fetchServerVariations = vi.fn(async () => []) as any;

    const loadA = sim.loadGroup("A");
    const loadB = sim.loadGroup("B");
    b.resolve({ routingGroupId: "B", routings: [] });
    await loadB;
    a.resolve({ routingGroupId: "A", routings: [] });
    await loadA;

    expect(sim.routingGroupId).toBe("B");
    expect(sim.baseline?.routingGroupId).toBe("B");
    expect(sim.working?.routingGroupId).toBe("B");
  });

  it("keeps the newest variation when two lazy loads resolve out of order", async () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = { routingGroupId: "G1", routings: [] };
    sim.working = { routingGroupId: "G1", routings: [] };
    sim.variations = [
      { id: "V1", label: "First", serverVid: "V1", group: null },
      { id: "V2", label: "Second", serverVid: "V2", group: null }
    ] as any;
    const v1 = deferred<any>();
    const v2 = deferred<any>();
    vi.spyOn(VariationService, "getVariation").mockImplementation((id: string) => id === "V1" ? v1.promise : v2.promise);

    const loadV1 = sim.loadVariation("V1");
    const loadV2 = sim.loadVariation("V2");
    v2.resolve({ variationGroupId: "V2", routings: [] });
    expect(await loadV2).toBe(true);
    v1.resolve({ variationGroupId: "V1", routings: [] });
    expect(await loadV1).toBe(false);

    expect(sim.activeVariationId).toBe("V2");
    expect(sim.working?.variationGroupId).toBe("V2");
    expect(sim.variations.find((v) => v.id === "V1")?.group).toBeNull();
  });

  it("ignores a completed variation run after navigating to another group", async () => {
    const sim = simulationStore();
    const group = { routingGroupId: "G1", routings: [] };
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = structuredClone(group);
    sim.working = structuredClone(group);
    sim.activeVariationId = "V1";
    sim.variations = [{ id: "V1", label: "First", serverVid: "V1", group: structuredClone(group) }] as any;
    const variationRun = deferred<any>();
    const parentRun = deferred<any>();
    vi.spyOn(VariationService, "runVariation").mockReturnValue(variationRun.promise);
    vi.spyOn(SimulationService, "runParentLiveConfig").mockReturnValue(parentRun.promise);
    sim.fetchSimGroupDetail = vi.fn(async () => ({ routingGroupId: "G2", routings: [] })) as any;
    sim.fetchServerVariations = vi.fn(async () => []) as any;

    const running = sim.runActiveVariation();
    expect(sim.isRunningVariationRun).toBe(true);
    await sim.loadGroup("G2");
    variationRun.resolve({ routingGroupId: "V1", routingResults: [], simulationId: "S1" });
    parentRun.resolve({ routingGroupId: "G1", routingResults: [] });
    expect(await running).toBe(false);

    expect(sim.routingGroupId).toBe("G2");
    expect(sim.groupLoadState).toBe("ready");
    expect(sim.variationRunResult).toBeNull();
    expect(sim.parentRunByGroupId.G1).toBeUndefined();
    expect(sim.lastSimulationId).toBeNull();
    expect(sim.isRunningVariationRun).toBe(false);
  });

  it("ignores a completed baseline run after navigating to another group", async () => {
    const sim = simulationStore();
    const group = { routingGroupId: "G1", routings: [] };
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = structuredClone(group);
    sim.working = structuredClone(group);
    const baselineRun = deferred<any>();
    vi.spyOn(SimulationService, "runParentLiveConfig").mockReturnValue(baselineRun.promise);
    sim.fetchSimGroupDetail = vi.fn(async () => ({ routingGroupId: "G2", routings: [] })) as any;
    sim.fetchServerVariations = vi.fn(async () => []) as any;

    const running = sim.runBaseline();
    expect(sim.isRunningBaselineRun).toBe(true);
    await sim.loadGroup("G2");
    baselineRun.resolve({ routingGroupId: "G1", routingResults: [], simulationId: "S_BASE" });
    expect(await running).toBe(false);

    expect(sim.routingGroupId).toBe("G2");
    expect(sim.baselineRunResult).toBeNull();
    expect(sim.parentRunByGroupId.G1).toBeUndefined();
    expect(sim.lastSimulationId).toBeNull();
    expect(sim.isRunningBaselineRun).toBe(false);
  });

  it("invalidates the parent comparison cache whenever a group baseline is reloaded", async () => {
    const sim = simulationStore();
    sim.parentRunByGroupId.G1 = { routingGroupId: "G1", routingResults: [] } as any;
    sim.simGroups = [{ routingGroupId: "G1" }];
    sim.fetchSimGroupDetail = vi.fn(async () => ({ routingGroupId: "G1", routings: [] })) as any;
    sim.fetchServerVariations = vi.fn(async () => []) as any;

    await sim.loadGroup("G1");

    expect(sim.parentRunByGroupId.G1).toBeUndefined();
    expect(sim.groupLoadState).toBe("ready");
  });

  it("fails closed when authoritative group detail cannot be loaded", async () => {
    const sim = simulationStore();
    sim.simGroups = [{ routingGroupId: "G1" }];
    sim.fetchSimGroupDetail = vi.fn(async () => { throw new Error("raw detail unavailable"); }) as any;
    const create = vi.spyOn(VariationService, "createVariation");

    expect(await sim.loadGroup("G1")).toBe(false);
    expect(sim.groupLoadState).toBe("error");
    expect(sim.baseline).toBeNull();
    expect(sim.working).toBeNull();
    expect(await sim.saveAsVariation("Unsafe")).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("fails closed when the server variation list cannot be loaded", async () => {
    const sim = simulationStore();
    sim.simGroups = [{ routingGroupId: "G1" }];
    sim.fetchSimGroupDetail = vi.fn(async () => ({ routingGroupId: "G1", routings: [] })) as any;
    sim.fetchServerVariations = vi.fn(async () => { throw new Error("variation list unavailable"); }) as any;
    const create = vi.spyOn(VariationService, "createVariation");

    expect(await sim.loadGroup("G1")).toBe(false);
    expect(sim.groupLoadState).toBe("error");
    expect(sim.variations).toEqual([]);
    expect(await sim.saveAsVariation("Unsafe")).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("archives a partially-created variation when its config cannot be saved", async () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = { routingGroupId: "G1", routings: [] };
    sim.working = { routingGroupId: "G1", routings: [] };
    vi.spyOn(VariationService, "createVariation").mockResolvedValue("V_ORPHAN");
    vi.spyOn(VariationService, "replaceVariationConfig").mockRejectedValue(new Error("replace failed"));
    const discard = vi.spyOn(VariationService, "deleteVariation").mockResolvedValue(undefined);

    expect(await sim.saveAsVariation("Needs recovery")).toBe(false);

    expect(discard).toHaveBeenCalledWith("V_ORPHAN");
    expect(sim.variations).toEqual([]);
    expect(sim.loadError).toContain("could not be configured");
  });

  it("refreshes a partially-created variation when discard is unavailable on an older backend", async () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = { routingGroupId: "G1", routings: [] };
    sim.working = { routingGroupId: "G1", routings: [] };
    vi.spyOn(VariationService, "createVariation").mockResolvedValue("V_ORPHAN");
    vi.spyOn(VariationService, "replaceVariationConfig").mockRejectedValue(new Error("replace failed"));
    vi.spyOn(VariationService, "deleteVariation").mockRejectedValue(new Error("delete unavailable"));
    vi.spyOn(VariationService, "listVariations").mockResolvedValue([
      { variationGroupId: "V_ORPHAN", variationName: "Needs recovery", statusId: "VAR_DRAFT" }
    ] as any);

    expect(await sim.saveAsVariation("Needs recovery")).toBe(false);

    expect(sim.variations.map((variation) => variation.id)).toContain("V_ORPHAN");
    expect(sim.loadError).toContain("could not be configured");
  });

  it("cannot create or open a variation over unresolved live-group edits", async () => {
    const sim = simulationStore();
    const routing = orderRoutingStore();
    sim.routingGroupId = "G1";
    sim.groupLoadState = "ready";
    sim.baseline = { routingGroupId: "G1", routings: [] };
    sim.working = { routingGroupId: "G1", routings: [] };
    sim.variations = [{ id: "V1", label: "Saved", serverVid: "V1", group: null }] as any;
    routing.currentGroup = { routingGroupId: "G1", hasUnsavedChanges: true };
    const create = vi.spyOn(VariationService, "createVariation");
    const load = vi.spyOn(VariationService, "getVariation");

    expect(await sim.saveAsVariation("Unsafe")).toBe(false);
    expect(await sim.loadVariation("V1")).toBe(false);

    expect(create).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(sim.activeVariationId).toBe("");
  });
});
