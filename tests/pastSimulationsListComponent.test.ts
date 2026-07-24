import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  history: null as any,
  live: null as any,
  push: vi.fn()
}));

vi.mock("@common", () => ({
  translate: (message: string) => message,
  commonUtil: { getDateAndTime: (value: string) => `date:${value}` }
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/store/pastSimulationStore", () => ({ usePastSimulationStore: () => mocks.history }));
vi.mock("@/store/simulationStore", () => ({ simulationStore: () => mocks.live }));
vi.mock("@ionic/vue", () => {
  const component = (name: string, tag = "div") => ({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` });
  return {
    IonBadge: component("IonBadge", "span"), IonButton: component("IonButton", "button"),
    IonItem: component("IonItem", "button"), IonLabel: component("IonLabel"), IonList: component("IonList"),
    IonNote: component("IonNote", "span"), IonSelectOption: component("IonSelectOption"),
    IonSpinner: component("IonSpinner"), IonText: component("IonText", "span"),
    IonSelect: { name: "IonSelect", props: { value: String }, emits: ["ionChange"], template: "<div><slot /></div>" }
  };
});

import PastSimulationsList from "../src/components/simulation/PastSimulationsList.vue";

function setup(storeId = "STORE_A") {
  mocks.history = reactive({
    list: [], listLoading: false, listRefreshing: false, listError: null, loadList: vi.fn()
  });
  mocks.live = reactive({
    storeId,
    resolveProductStoreId() { return this.storeId; }
  });
}

describe("PastSimulationsList", () => {
  beforeEach(() => { setup(); vi.clearAllMocks(); });

  it("loads and reloads history within the resolved product-store scope", async () => {
    mount(PastSimulationsList);
    await flushPromises();
    expect(mocks.history.loadList).toHaveBeenCalledWith({ productStoreId: "STORE_A", statusId: undefined, pageIndex: 0, pageSize: 25 });

    mocks.live.storeId = "STORE_B";
    await flushPromises();
    expect(mocks.history.loadList).toHaveBeenLastCalledWith({ productStoreId: "STORE_B", statusId: undefined, pageIndex: 0, pageSize: 25 });
  });

  it("fails closed without a product store and does not show a misleading empty state", async () => {
    setup("");
    const wrapper = mount(PastSimulationsList);
    await flushPromises();

    expect(mocks.history.loadList).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Select a product store");
    expect(wrapper.text()).not.toContain("No past simulations yet");
  });

  it("hides rows from the previous store when product-store scope disappears", async () => {
    mocks.history.list = [{
      simulationId: "SIM_A", routingGroupId: "STORE_A_ONLY", statusId: "COMPLETE", runType: "SINGLE",
      brokeredItemCount: 1, attemptedItemCount: 1, createdDate: "2026-07-17T00:00:00Z"
    }];
    const wrapper = mount(PastSimulationsList);
    expect(wrapper.text()).toContain("STORE_A_ONLY");

    mocks.live.storeId = "";
    await flushPromises();

    expect(wrapper.text()).toContain("Select a product store");
    expect(wrapper.text()).not.toContain("STORE_A_ONLY");
  });

  it("renders an error without also claiming history is empty", () => {
    mocks.history.listError = "History unavailable";
    const wrapper = mount(PastSimulationsList);

    expect(wrapper.text()).toContain("History unavailable");
    expect(wrapper.text()).not.toContain("No past simulations yet");
  });

  it("renders failed runs and opens their saved deep link", async () => {
    mocks.history.list = [{
      simulationId: "SIM_1", routingGroupId: "G1", statusId: "FAILED", runType: "VARIATION",
      brokeredItemCount: 2, attemptedItemCount: 5, createdDate: "2026-07-17T00:00:00Z"
    }];
    const wrapper = mount(PastSimulationsList);
    await wrapper.findAllComponents({ name: "IonItem" }).at(-1)!.trigger("click");

    expect(wrapper.text()).toContain("Failed");
    expect(wrapper.text()).toContain("2/5 brokered");
    expect(mocks.push).toHaveBeenCalledWith("/simulate/history/SIM_1");
  });

  it("labels synchronous parent and variation records from variationGroupId, not list order", async () => {
    mocks.history.list = [
      {
        simulationId: "M100374", routingGroupId: "M100255", variationGroupId: "VM100005",
        statusId: "COMPLETE", runType: "SINGLE", brokeredItemCount: 16, attemptedItemCount: 663,
        createdDate: "2026-07-17T01:11:55Z"
      },
      {
        simulationId: "M100375", routingGroupId: "M100255", statusId: "COMPLETE", runType: "SINGLE",
        brokeredItemCount: 16, attemptedItemCount: 663, createdDate: "2026-07-17T01:11:55Z"
      }
    ];

    const wrapper = mount(PastSimulationsList);
    await flushPromises();

    expect(wrapper.text()).toContain("Variation");
    expect(wrapper.text()).toContain("VM100005 · SINGLE");
    expect(wrapper.text()).toContain("Baseline");
  });

  it("reloads the scoped list when the status filter changes", async () => {
    const wrapper = mount(PastSimulationsList);
    await flushPromises();
    mocks.history.loadList.mockClear();
    wrapper.findComponent({ name: "IonSelect" }).vm.$emit("ionChange", { detail: { value: "FAILED" } });
    await flushPromises();

    expect(mocks.history.loadList).toHaveBeenCalledWith({ productStoreId: "STORE_A", statusId: "FAILED", pageIndex: 0, pageSize: 25 });
  });
});
