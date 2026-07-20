import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  didEnter: [] as Array<() => void | Promise<void>>,
  willEnter: [] as Array<() => void | Promise<void>>,
  willLeave: [] as Array<() => void | Promise<void>>,
  activateCanvas: vi.fn(async () => undefined),
  deactivateCanvas: vi.fn(),
  setActiveContext: vi.fn(),
  fetchOrderRoutingGroups: vi.fn(async () => undefined),
  devModeEnabled: true,
  simulation: {
    routingGroupId: "",
    groupLoadState: "idle",
    loadGroup: vi.fn(async () => true),
  },
}));

vi.mock("@ionic/vue", () => ({
  onIonViewDidEnter: (callback: () => void | Promise<void>) => mocks.didEnter.push(callback),
  onIonViewWillEnter: (callback: () => void | Promise<void>) => mocks.willEnter.push(callback),
  onIonViewWillLeave: (callback: () => void | Promise<void>) => mocks.willLeave.push(callback),
}));

vi.mock("vue-router", async () => {
  const { ref } = await import("vue");
  return {
    useRouter: () => ({ currentRoute: ref({ params: { routingGroupId: "G1" } }) }),
  };
});

vi.mock("@/components/circuit/RoutingDetailCanvas.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      name: "RoutingDetailCanvas",
      props: {
        routingGroupId: { type: String, required: true },
        simulationEnabled: Boolean,
      },
      setup(_props, { expose }) {
        expose({
          activateForVisiblePage: mocks.activateCanvas,
          deactivateForHiddenPage: mocks.deactivateCanvas,
        });
        return () => h("div", { "data-testid": "routing-detail-canvas" });
      },
    }),
  };
});

vi.mock("@/store/circuit", () => ({
  useCircuitStore: () => ({ setActiveContext: mocks.setActiveContext }),
}));

vi.mock("@/store/orderRoutingStore", () => ({
  orderRoutingStore: () => ({
    getRoutingGroups: [],
    fetchOrderRoutingGroups: mocks.fetchOrderRoutingGroups,
  }),
}));

vi.mock("@/store/simulationStore", () => ({
  simulationStore: () => mocks.simulation,
}));

vi.mock("@/store/preferences", () => ({
  usePreferencesStore: () => ({
    get isDevModeEnabled() { return mocks.devModeEnabled; },
  }),
}));

vi.mock("@/utils/simConfig", () => ({
  isDeveloperFeatureEnabled: (flag: string, devModeEnabled: boolean) => flag === "simulation" && devModeEnabled,
}));

import RoutingDetail from "../src/views/RoutingDetail.vue";

describe("regular order-routing detail navigation", () => {
  beforeEach(() => {
    mocks.didEnter.length = 0;
    mocks.willEnter.length = 0;
    mocks.willLeave.length = 0;
    vi.clearAllMocks();
    mocks.simulation.routingGroupId = "";
    mocks.simulation.groupLoadState = "idle";
    mocks.devModeEnabled = true;
  });

  it("lets the routed page activate the editor on entry and release it on cached-page leave", async () => {
    mount(RoutingDetail, { props: { routingGroupId: "G1" } });

    expect(mocks.didEnter).toHaveLength(1);
    expect(mocks.willLeave).toHaveLength(1);

    await mocks.didEnter[0]();
    await flushPromises();
    expect(mocks.activateCanvas).toHaveBeenCalledOnce();

    await mocks.willLeave[0]();
    expect(mocks.deactivateCanvas).toHaveBeenCalledOnce();

    // A cached page is not remounted. Its routed lifecycle must reactivate the same canvas.
    await mocks.didEnter[0]();
    await flushPromises();
    expect(mocks.activateCanvas).toHaveBeenCalledTimes(2);
  });

  it("loads the deep-linked group immediately and restores it on cached re-entry", async () => {
    mount(RoutingDetail, { props: { routingGroupId: "G1" } });

    expect(mocks.setActiveContext).toHaveBeenCalledWith(expect.objectContaining({ routingGroupId: "G1" }));
    expect(mocks.simulation.loadGroup).toHaveBeenCalledWith("G1");

    mocks.simulation.routingGroupId = "G2";
    mocks.simulation.groupLoadState = "ready";
    await mocks.willEnter[0]();

    expect(mocks.simulation.loadGroup).toHaveBeenLastCalledWith("G1");
    expect(mocks.setActiveContext).toHaveBeenLastCalledWith(expect.objectContaining({ routingGroupId: "G1" }));
  });

  it("does not load Simulation while developer mode is disabled", () => {
    mocks.devModeEnabled = false;

    mount(RoutingDetail, { props: { routingGroupId: "G1" } });

    expect(mocks.simulation.loadGroup).not.toHaveBeenCalled();
  });

  it("switches the authoritative context and simulation load when the deep route param changes", async () => {
    mocks.simulation.routingGroupId = "G1";
    mocks.simulation.groupLoadState = "ready";
    const wrapper = mount(RoutingDetail, { props: { routingGroupId: "G1" } });
    mocks.setActiveContext.mockClear();
    mocks.simulation.loadGroup.mockClear();

    await wrapper.setProps({ routingGroupId: "G2" });
    await flushPromises();

    expect(mocks.setActiveContext).toHaveBeenCalledWith(expect.objectContaining({ routingGroupId: "G2" }));
    expect(mocks.simulation.loadGroup).toHaveBeenCalledWith("G2");
  });
});
