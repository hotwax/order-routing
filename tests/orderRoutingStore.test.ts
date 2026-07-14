import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@common";
import { orderRoutingStore } from "@/store/orderRoutingStore";

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn((response: any) => Boolean(response?.error || response?.data?._ERROR_MESSAGE_)),
    sortSequence: vi.fn((items: any[] = []) => [...items].sort((a, b) => Number(a?.sequenceNum ?? 0) - Number(b?.sequenceNum ?? 0))),
    showToast: vi.fn()
  },
  logger: {
    error: vi.fn()
  },
  translate: (value: string) => value
}));

vi.mock("@/store/productStore", () => ({
  productStore: vi.fn(() => ({
    currentEComStore: { productStoreId: "STORE" },
    getCurrentEComStore: { productStoreId: "STORE" }
  }))
}));

vi.mock("@/store/product", () => ({
  productStore: vi.fn(() => ({
    fetchProducts: vi.fn()
  }))
}));

vi.mock("@/utils/simConfig", () => ({
  simApiBaseUrl: () => "https://sim.example/rest/s1/"
}));

const mockedApi = vi.mocked(api);

describe("orderRoutingStore.fetchCurrentRoutingGroup", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
  });

  it("refreshes a persisted same-group shell from /raw before rendering route detail", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: {
        routingGroupId: "G1",
        groupName: "",
        routings: [],
        hasUnsavedChanges: false
      },
      groups: [{
        routingGroupId: "G1",
        groupName: "List shell",
        routings: []
      }]
    });

    mockedApi.mockResolvedValue({
      data: {
        routingGroupId: "G1",
        groupName: "Raw detail",
        routings: [{
          orderRoutingId: "R1",
          routingName: "Rejected items",
          sequenceNum: 0,
          rules: []
        }]
      }
    });

    const group = await store.fetchCurrentRoutingGroup("G1");

    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "order-routing/groups/G1/raw",
      method: "GET"
    }));
    expect(group.groupName).toBe("Raw detail");
    expect(group.routings).toHaveLength(1);
    expect(group.isRoutingGroupDetailLoaded).toBe(true);
  });

  it("preserves unsaved local edits only after raw detail has been loaded", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: {
        routingGroupId: "G1",
        groupName: "Unsaved raw detail",
        routings: [{
          orderRoutingId: "R1",
          routingName: "Edited route",
          rules: []
        }],
        hasUnsavedChanges: true,
        isRoutingGroupDetailLoaded: true
      }
    });

    const group = await store.fetchCurrentRoutingGroup("G1");

    expect(mockedApi).not.toHaveBeenCalled();
    expect(group.routings[0].routingName).toBe("Edited route");
  });

  it("reloads raw group detail when discarding staged edits", async () => {
    const store = orderRoutingStore();
    store.$patch({
      currentGroup: {
        routingGroupId: "G1",
        groupName: "Edited group",
        routings: [{
          orderRoutingId: "R1",
          routingName: "Edited route",
          rules: []
        }],
        hasUnsavedChanges: true,
        isRoutingGroupDetailLoaded: true
      },
      groups: [{
        routingGroupId: "G1",
        groupName: "Edited group",
        routings: [{
          orderRoutingId: "R1",
          routingName: "Edited route",
          rules: []
        }],
        hasUnsavedChanges: true
      }]
    });

    mockedApi.mockResolvedValue({
      data: {
        routingGroupId: "G1",
        groupName: "Raw group",
        routings: [{
          orderRoutingId: "R1",
          routingName: "Raw route",
          rules: []
        }]
      }
    });

    const group = await store.discardCurrentGroupChanges("G1");

    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "order-routing/groups/G1/raw",
      method: "GET"
    }));
    expect(group.groupName).toBe("Raw group");
    expect(group.routings[0].routingName).toBe("Raw route");
    expect(group.hasUnsavedChanges).toBe(false);
    expect(store.groups[0].routings[0].routingName).toBe("Raw route");
  });
});
