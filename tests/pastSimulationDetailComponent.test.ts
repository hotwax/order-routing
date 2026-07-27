import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ past: null as any, live: null as any }));
vi.mock("@common", () => ({ translate: (message: string) => message }));
vi.mock("@/store/pastSimulationStore", () => ({ usePastSimulationStore: () => mocks.past }));
vi.mock("@/store/simulationStore", () => ({ simulationStore: () => mocks.live }));
vi.mock("@/components/simulation/SimulationResults.vue", () => ({
  default: { name: "SimulationResults", props: { embedded: Boolean }, template: "<div class='results'>results</div>" }
}));
vi.mock("@ionic/vue", () => {
  const component = (name: string, tag = "div") => ({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` });
  return {
    IonBackButton: component("IonBackButton"), IonButton: component("IonButton", "button"), IonButtons: component("IonButtons"),
    IonContent: component("IonContent"), IonHeader: component("IonHeader"), IonPage: component("IonPage"),
    IonSpinner: component("IonSpinner"), IonText: component("IonText", "span"), IonTitle: component("IonTitle"), IonToolbar: component("IonToolbar")
  };
});

import PastSimulationDetail from "../src/views/PastSimulationDetail.vue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("PastSimulationDetail", () => {
  beforeEach(() => {
    mocks.past = reactive({ detailLoading: false, detailError: null, loadDetail: vi.fn() });
    mocks.live = reactive({ results: { stale: true }, isRunning: true, view: "editor" });
    vi.clearAllMocks();
  });

  it("loads a saved deep link immediately and reloads when its id changes", async () => {
    mocks.past.loadDetail
      .mockResolvedValueOnce({ baseline: { id: "ONE" }, variants: [] })
      .mockResolvedValueOnce({ baseline: { id: "TWO" }, variants: [] });
    const wrapper = mount(PastSimulationDetail, { props: { simulationId: "SIM_1" } });
    await flushPromises();
    expect(mocks.past.loadDetail).toHaveBeenCalledWith("SIM_1");
    expect(mocks.live.results.baseline.id).toBe("ONE");

    await wrapper.setProps({ simulationId: "SIM_2" });
    await flushPromises();
    expect(mocks.past.loadDetail).toHaveBeenLastCalledWith("SIM_2");
    expect(mocks.live.results.baseline.id).toBe("TWO");
    expect(mocks.live.isRunning).toBe(false);
    expect(mocks.live.view).toBe("results");
  });

  it("does not let an older deep-link request replace a newer result", async () => {
    const oldRun = deferred<any>();
    const newRun = deferred<any>();
    mocks.past.loadDetail.mockReturnValueOnce(oldRun.promise).mockReturnValueOnce(newRun.promise);
    const wrapper = mount(PastSimulationDetail, { props: { simulationId: "OLD" } });
    await wrapper.setProps({ simulationId: "NEW" });
    newRun.resolve({ baseline: { id: "NEW" }, variants: [] });
    await flushPromises();
    oldRun.resolve({ baseline: { id: "OLD" }, variants: [] });
    await flushPromises();

    expect(mocks.live.results.baseline.id).toBe("NEW");
  });

  it("shows detail errors and retries the same saved id", async () => {
    mocks.past.detailError = "Saved run unavailable";
    mocks.past.loadDetail.mockRejectedValue(new Error("failed"));
    const wrapper = mount(PastSimulationDetail, { props: { simulationId: "SIM_BAD" } });
    await flushPromises();
    expect(wrapper.text()).toContain("Saved run unavailable");

    mocks.past.loadDetail.mockClear();
    await wrapper.findComponent({ name: "IonButton" }).trigger("click");
    await flushPromises();
    expect(mocks.past.loadDetail).toHaveBeenCalledWith("SIM_BAD");
  });
});
