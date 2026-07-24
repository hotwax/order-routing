import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@common";
import { orderRoutingStore } from "@/store/orderRoutingStore";

const productStoreId = vi.hoisted(() => ({ value: "STORE" }));

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn((response: any) => Boolean(response?.error || response?.data?._ERROR_MESSAGE_)),
    sortSequence: vi.fn((items: any[] = []) => [...items].sort((a, b) => Number(a?.sequenceNum ?? 0) - Number(b?.sequenceNum ?? 0))),
    showToast: vi.fn(),
    getOmsURL: vi.fn(() => "https://oms.example/")
  },
  logger: { error: vi.fn(), warn: vi.fn() },
  translate: (value: string) => value
}));

vi.mock("@/store/productStore", () => ({
  productStore: vi.fn(() => ({
    currentEComStore: { productStoreId: productStoreId.value },
    getCurrentEComStore: { productStoreId: productStoreId.value },
    fetchCarrierInformation: vi.fn()
  }))
}));

vi.mock("@/store/product", () => ({
  productStore: vi.fn(() => ({ fetchProducts: vi.fn() }))
}));

vi.mock("@/utils/simConfig", () => ({
  simApiBaseUrl: () => "https://sim.example/rest/s1/"
}));

const mockedApi = vi.mocked(api);

function rawGroup(name = "Server group") {
  return {
    routingGroupId: "G1",
    groupName: name,
    routings: [{ orderRoutingId: "R1", routingName: "Server route", rules: [] }]
  };
}

describe("orderRoutingStore persisted detail state", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
    productStoreId.value = "STORE";
  });

  it("clears persisted routing data when the authenticated instance or user changes", () => {
    const store = orderRoutingStore();
    store.$patch({
      sessionContextKey: "instance-a::user-a",
      groups: [{ routingGroupId: "M100459", productStoreId: "STORE" }],
      currentGroup: { routingGroupId: "M100459", productStoreId: "STORE" },
      baseline: { routingGroupId: "M100459", productStoreId: "STORE" },
      currentRoutingId: "ROUTE_A",
      currentRuleId: "RULE_A"
    });

    expect(store.activateSessionContext("instance-b::user-b")).toBe(true);
    expect(store.sessionContextKey).toBe("instance-b::user-b");
    expect(store.groups).toEqual([]);
    expect(store.currentGroup).toEqual({});
    expect(store.baseline).toEqual({});
    expect(store.currentRoutingId).toBe("");
    expect(store.currentRuleId).toBe("");
  });

  it("preserves persisted routing data when the authenticated session owner is unchanged", () => {
    const store = orderRoutingStore();
    store.$patch({
      sessionContextKey: "instance-a::user-a",
      groups: [{ routingGroupId: "G1", productStoreId: "STORE" }],
      currentGroup: { ...rawGroup("Draft"), hasUnsavedChanges: true }
    });

    expect(store.activateSessionContext("INSTANCE-A::USER-A")).toBe(false);
    expect(store.groups).toHaveLength(1);
    expect(store.currentGroup.groupName).toBe("Draft");
  });

  it("migrates a same-group persisted shell by fetching raw detail and a baseline", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: { routingGroupId: "G1", groupName: "Shell", routings: [], hasUnsavedChanges: false },
      baseline: {},
      groups: [{ routingGroupId: "G1", groupName: "Shell", routings: [] }]
    });
    mockedApi.mockResolvedValueOnce({ data: rawGroup() });

    const group = await store.fetchCurrentRoutingGroup("G1");

    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "order-routing/groups/G1/raw",
      method: "GET"
    }));
    expect(group.groupName).toBe("Server group");
    expect(group.isRoutingGroupDetailLoaded).toBe(true);
    expect(store.baseline.routings).toHaveLength(1);
    expect(store.baseline.hasUnsavedChanges).toBe(false);
  });

  it("keeps a trusted dirty draft when its matching hydrated baseline exists", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: {
        ...rawGroup("Edited group"),
        isRoutingGroupDetailLoaded: true,
        hasUnsavedChanges: true
      },
      baseline: {
        ...rawGroup(),
        isRoutingGroupDetailLoaded: true,
        hasUnsavedChanges: false
      }
    });

    const group = await store.fetchCurrentRoutingGroup("G1");

    expect(mockedApi).not.toHaveBeenCalled();
    expect(group.groupName).toBe("Edited group");
  });

  it("backfills a missing baseline without losing a marked dirty draft", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: {
        ...rawGroup("Edited group"),
        isRoutingGroupDetailLoaded: true,
        hasUnsavedChanges: true
      },
      baseline: {}
    });
    mockedApi.mockResolvedValueOnce({ data: rawGroup() });

    const group = await store.fetchCurrentRoutingGroup("G1");

    expect(group.groupName).toBe("Edited group");
    expect(group.hasUnsavedChanges).toBe(true);
    expect(store.baseline.groupName).toBe("Server group");
    expect(store.baseline.hasUnsavedChanges).toBe(false);
  });

  it("opens a newly created local group as dirty without inventing a baseline", async () => {
    const store = orderRoutingStore();
    store.$patch({
      groups: [{ routingGroupId: "NEW1", groupName: "New group", isNew: true, hasUnsavedChanges: true }]
    });

    const group = await store.fetchCurrentRoutingGroup("NEW1");

    expect(mockedApi).not.toHaveBeenCalled();
    expect(group.routings).toEqual([]);
    expect(group.isRoutingGroupDetailLoaded).toBe(true);
    expect(group.hasUnsavedChanges).toBe(true);
    expect(store.baseline).toEqual({});
  });

  it("refuses a discard without a matching hydrated baseline", () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: { ...rawGroup("Edited"), isRoutingGroupDetailLoaded: true, hasUnsavedChanges: true },
      baseline: { ...rawGroup(), hasUnsavedChanges: false }
    });

    expect(store.discardChanges()).toBe(false);
    expect(store.currentGroup.groupName).toBe("Edited");
    expect(store.currentGroup.hasUnsavedChanges).toBe(true);
  });

  it("restores a deep-cloned matching baseline and reports success", () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: { ...rawGroup("Edited"), isRoutingGroupDetailLoaded: true, hasUnsavedChanges: true },
      baseline: { ...rawGroup(), isRoutingGroupDetailLoaded: true, hasUnsavedChanges: false }
    });

    expect(store.discardChanges()).toBe(true);
    expect(store.currentGroup.groupName).toBe("Server group");
    expect(store.currentGroup.hasUnsavedChanges).toBe(false);
    store.currentGroup.routings[0].routingName = "Changed again";
    expect(store.baseline.routings[0].routingName).toBe("Server route");
  });

  it("can republish a persisted discard as clean after a queued editor event", () => {
    const store = orderRoutingStore();
    store.$patch({
      groups: [{ ...rawGroup("Edited"), isRoutingGroupDetailLoaded: true, hasUnsavedChanges: true }],
      currentGroup: { ...rawGroup("Edited"), isRoutingGroupDetailLoaded: true, hasUnsavedChanges: true },
      baseline: { ...rawGroup(), isRoutingGroupDetailLoaded: true, hasUnsavedChanges: false }
    });

    expect(store.discardChanges()).toBe(true);
    // Model a programmatic Ionic change event queued by the component's value rebind.
    store.setHasUnsavedChanges(true);
    store.setHasUnsavedChanges(false);

    expect(store.currentGroup.groupName).toBe("Server group");
    expect(store.currentGroup.hasUnsavedChanges).toBe(false);
    expect(store.baseline.hasUnsavedChanges).toBe(false);
    expect(store.groups[0].hasUnsavedChanges).toBe(false);
  });

  it("discards a new local group without requiring a server baseline", () => {
    const store = orderRoutingStore();
    store.$patch({
      groups: [
        { routingGroupId: "SAVED", groupName: "Saved" },
        { routingGroupId: "NEW1", groupName: "Draft", isNew: true, hasUnsavedChanges: true }
      ],
      currentGroup: {
        routingGroupId: "NEW1",
        groupName: "Draft",
        isNew: true,
        hasUnsavedChanges: true,
        routings: []
      },
      baseline: {},
      currentRoutingId: "TEMP_ROUTE",
      currentRuleId: "TEMP_RULE"
    });

    expect(store.discardChanges()).toBe(true);
    expect(store.groups.map((group: any) => group.routingGroupId)).toEqual(["SAVED"]);
    expect(store.currentGroup).toEqual({});
    expect(store.baseline).toEqual({});
    expect(store.currentRoutingId).toBe("");
    expect(store.currentRuleId).toBe("");
  });

  it("clears both the working copy and baseline on logout reset", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: { ...rawGroup(), isRoutingGroupDetailLoaded: true },
      baseline: { ...rawGroup(), isRoutingGroupDetailLoaded: true }
    });

    await store.clearRouting();

    expect(store.currentGroup).toEqual({});
    expect(store.baseline).toEqual({});
  });
});

describe("orderRoutingStore save payload and schedule side effects", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
  });

  function draftPayload() {
    return {
      routingGroupId: "G1",
      hasUnsavedChanges: true,
      isRoutingGroupDetailLoaded: true,
      schedule: { cronExpression: "0 0 * * * ?", routingGroupId: "G1" },
      routings: [{
        orderRoutingId: "00000000-0000-4000-8000-000000000030",
        _tempId: "route-key",
        orderFilters: [{ orderRoutingId: "R0", conditionSeqId: "01", fieldName: "queue" }],
        rules: [{
          routingRuleId: "00000000-0000-4000-8000-000000000031",
          orderRoutingId: "R0",
          inventoryFilters: [{ routingRuleId: "RR0", conditionSeqId: "02", fieldName: "distance" }],
          actions: [{ routingRuleId: "RR0", actionSeqId: "03", actionTypeEnumId: "ORA_NEXT_RULE" }]
        }]
      }]
    };
  }

  it("sanitizes the hierarchy and does not repost a loaded schedule by default", async () => {
    mockedApi
      .mockResolvedValueOnce({ data: { routingGroupId: "G1" } })
      .mockResolvedValueOnce({ data: rawGroup() });
    const store = orderRoutingStore();

    await store.saveRoutingGroupRaw(draftPayload());

    const saveRequest = mockedApi.mock.calls[0][0];
    expect(saveRequest.url).toBe("order-routing/groups");
    expect(saveRequest.data).not.toHaveProperty("hasUnsavedChanges");
    expect(saveRequest.data).not.toHaveProperty("isRoutingGroupDetailLoaded");
    expect(saveRequest.data).not.toHaveProperty("schedule");
    expect(saveRequest.data.routings[0]).not.toHaveProperty("orderRoutingId");
    expect(saveRequest.data.routings[0].orderFilters[0]).toEqual({ fieldName: "queue" });
    expect(saveRequest.data.routings[0].rules[0].inventoryFilters[0]).toEqual({ fieldName: "distance" });
    expect(mockedApi.mock.calls.map(([request]) => request.url)).toEqual([
      "order-routing/groups",
      "order-routing/groups/G1/raw"
    ]);
  });

  it("posts the schedule only when the caller explicitly requests it", async () => {
    mockedApi
      .mockResolvedValueOnce({ data: { routingGroupId: "G1" } })
      .mockResolvedValueOnce({ data: { jobName: "JOB1" } })
      .mockResolvedValueOnce({ data: rawGroup() });
    const store = orderRoutingStore();

    await store.saveRoutingGroupRaw(draftPayload(), { saveSchedule: true });

    expect(mockedApi.mock.calls.map(([request]) => [request.method, request.url])).toEqual([
      ["POST", "order-routing/groups"],
      ["POST", "order-routing/groups/G1/schedule"],
      ["GET", "order-routing/groups/G1/raw"]
    ]);
    expect(mockedApi.mock.calls[1][0].data.routingGroupId).toBe("G1");
  });
});

describe("orderRoutingStore list reconciliation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
    productStoreId.value = "STORE";
  });

  it("accepts an empty server snapshot and retains only local drafts for the active store", async () => {
    const store = orderRoutingStore();
    store.groups = [
      { routingGroupId: "DELETED", productStoreId: "STORE", groupName: "Deleted on server" },
      { routingGroupId: "LOCAL", productStoreId: "STORE", groupName: "Local draft", isNew: true },
      { routingGroupId: "OTHER", productStoreId: "OTHER_STORE", groupName: "Other store" }
    ];
    mockedApi.mockResolvedValueOnce({ data: [] });

    await store.fetchOrderRoutingGroups();

    expect(store.groups).toEqual([
      expect.objectContaining({ routingGroupId: "LOCAL", isNew: true })
    ]);
  });

  it("replaces rows from the previous product store with the selected store snapshot", async () => {
    const store = orderRoutingStore();
    store.groups = [
      { routingGroupId: "G1", productStoreId: "STORE", groupName: "Old store group" },
      { routingGroupId: "OLD_LOCAL", productStoreId: "STORE", groupName: "Old local draft", isNew: true },
      { routingGroupId: "NEW_LOCAL", productStoreId: "STORE_2", groupName: "New local draft", isNew: true }
    ];
    productStoreId.value = "STORE_2";
    mockedApi.mockResolvedValueOnce({
      data: [{ routingGroupId: "G2", productStoreId: "STORE_2", groupName: "New store group" }]
    });

    await store.fetchOrderRoutingGroups();

    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "order-routing/groups",
      params: { productStoreId: "STORE_2", pageSize: 200 }
    }));
    expect(store.groups.map((group: any) => group.routingGroupId).sort()).toEqual(["G2", "NEW_LOCAL"]);
  });

  it("keeps the current snapshot when the list request fails", async () => {
    const store = orderRoutingStore();
    store.groups = [{ routingGroupId: "G1", productStoreId: "STORE" }];
    mockedApi.mockRejectedValueOnce(new Error("unavailable"));

    await store.fetchOrderRoutingGroups();

    expect(store.groups).toEqual([{ routingGroupId: "G1", productStoreId: "STORE" }]);
  });
});

describe("orderRoutingStore committed schedule adoption", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
  });

  function hydrated(name: string, extra: any = {}) {
    return {
      routingGroupId: "G1",
      groupName: name,
      isRoutingGroupDetailLoaded: true,
      routings: [{ orderRoutingId: "R1", routingName: "Route", rules: [] }],
      schedule: { jobName: "JOB1", cronExpression: "0 0 0 * * ?", paused: "Y" },
      jobName: "JOB1",
      ...extra
    };
  }

  it("mirrors an accepted schedule into the baseline so discard keeps it", () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: hydrated("Edited", { hasUnsavedChanges: true }),
      baseline: hydrated("Saved", { hasUnsavedChanges: false })
    });

    const committed = { jobName: "JOB1", cronExpression: "0 0 6 * * ?", paused: "N" };
    store.adoptCommittedSchedule("G1", committed);

    expect(store.currentGroup.hasUnsavedChanges).toBe(true);
    expect(store.baseline.hasUnsavedChanges).toBe(false);
    expect(store.baseline.groupName).toBe("Saved");

    expect(store.discardChanges()).toBe(true);
    expect(store.currentGroup.schedule.cronExpression).toBe("0 0 6 * * ?");
    expect(store.currentGroup.schedule.paused).toBe("N");
  });

  it("mirrors the readback schedule into the baseline without absorbing draft edits", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: hydrated("Edited", { hasUnsavedChanges: true }),
      baseline: hydrated("Saved", { hasUnsavedChanges: false })
    });
    const canonical = { jobName: "JOB1", cronExpression: "0 0 12 * * ?", paused: "N" };
    mockedApi.mockResolvedValueOnce({ data: { schedule: canonical } });

    await store.fetchCurrentGroupSchedule({ routingGroupId: "G1", currentGroup: store.currentGroup });

    expect(store.baseline.schedule.cronExpression).toBe("0 0 12 * * ?");
    expect(store.baseline.groupName).toBe("Saved");
    expect(store.baseline.hasUnsavedChanges).toBe(false);
    expect(store.currentGroup.groupName).toBe("Edited");
    expect(store.currentGroup.hasUnsavedChanges).toBe(true);
  });

  it("does not touch a baseline belonging to a different group", () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: hydrated("Edited"),
      baseline: { ...hydrated("Other"), routingGroupId: "G2" }
    });

    store.adoptCommittedSchedule("G1", { jobName: "JOB1", cronExpression: "0 0 6 * * ?" });

    expect(store.baseline.schedule.cronExpression).toBe("0 0 0 * * ?");
    expect(store.currentGroup.schedule.cronExpression).toBe("0 0 6 * * ?");
  });
});

describe("orderRoutingStore clone lifecycle", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
  });

  function hydratedSource() {
    return {
      routingGroupId: "G1",
      groupName: "Source group",
      isRoutingGroupDetailLoaded: true,
      hasUnsavedChanges: false,
      jobName: "JOB_SRC",
      schedule: { jobName: "JOB_SRC", paused: "N" },
      runTime: 1234,
      routings: [{
        routingGroupId: "G1",
        orderRoutingId: "R1",
        routingName: "Source route",
        rules: [{ routingRuleId: "RR1", orderRoutingId: "R1", ruleName: "Source rule" }]
      }]
    };
  }

  it("clones the hydrated working copy as a local-only unscheduled draft", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: hydratedSource(),
      groups: [{ routingGroupId: "G1", groupName: "Source group" }]
    });

    const resp = await store.cloneGroup({ routingGroupId: "G1", newGroupName: "Source group copy" });
    const cloneId = resp.data.routingGroupId;
    expect(cloneId).not.toBe("G1");

    const clone = store.groups.find((g: any) => g.routingGroupId === cloneId);
    expect(clone.isNew).toBe(true);
    expect(clone.hasUnsavedChanges).toBe(true);
    expect(clone.routings).toHaveLength(1);
    expect(clone).not.toHaveProperty("jobName");
    expect(clone).not.toHaveProperty("schedule");
    expect(clone).not.toHaveProperty("runTime");

    const detail = await store.fetchRoutingGroupDetail(cloneId);
    expect(mockedApi).not.toHaveBeenCalled();
    expect(detail.routings).toHaveLength(1);
    expect(detail.routings[0].rules).toHaveLength(1);
  });

  it("first save strips the client uuid and every source id, then drops the temp row", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: hydratedSource(),
      groups: [{ routingGroupId: "G1", groupName: "Source group" }]
    });
    const resp = await store.cloneGroup({ routingGroupId: "G1" });
    const cloneId = resp.data.routingGroupId;
    const clone = store.groups.find((g: any) => g.routingGroupId === cloneId);

    mockedApi
      .mockResolvedValueOnce({ data: { routingGroupId: "SERVER1" } })
      .mockResolvedValueOnce({ data: { routingGroupId: "SERVER1", groupName: "Source group copy", routings: [] } });

    await store.saveRoutingGroupRaw(JSON.parse(JSON.stringify(clone)));

    const saveRequest = mockedApi.mock.calls[0][0];
    expect(saveRequest.data).not.toHaveProperty("routingGroupId");
    expect(saveRequest.data.routings[0]).not.toHaveProperty("orderRoutingId");
    expect(saveRequest.data.routings[0]).not.toHaveProperty("routingGroupId");
    expect(saveRequest.data.routings[0].rules[0]).not.toHaveProperty("routingRuleId");
    expect(store.groups.some((g: any) => g.routingGroupId === cloneId)).toBe(false);
  });
});
