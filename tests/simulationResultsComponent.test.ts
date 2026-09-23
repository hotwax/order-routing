import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ items: vi.fn(), rules: vi.fn(), push: vi.fn() }));
vi.mock("@common", () => ({ translate: (text: string) => text }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/store/simulationStore", () => ({
  simulationStore: () => ({ lastSimulationId: null, currentRun: null, isRunningBaselineRun: false, isRunningVariationRun: false }),
}));
vi.mock("@/services/SimulationService", () => ({
  listSimulationItems: (...args: any[]) => mocks.items(...args),
  listSimulationRuleResults: (...args: any[]) => mocks.rules(...args),
}));

import SimulationResults from "../src/components/simulation/SimulationResults.vue";

const element = (name: string, tag = "div") => ({ name, template: `<${tag}><slot /></${tag}>` });
const stubs = {
  IonBadge: element("IonBadge", "span"),
  IonButton: element("IonButton", "button"),
  IonItem: element("IonItem"),
  IonLabel: element("IonLabel"),
  IonList: element("IonList"),
  IonNote: element("IonNote"),
  IonSelect: { name: "IonSelect", props: ["modelValue"], template: "<div><slot /></div>" },
  IonSelectOption: element("IonSelectOption"),
  IonSpinner: element("IonSpinner"),
};

function completeRun() {
  return {
    simulation: { simulationId: "S1", statusId: "BRSIM_COMPLETE", routingGroupId: "G1", attemptedItemCount: 2 },
    variants: [
      { variantSeqId: 1, isBaseline: "Y", attemptedItemCount: 2, brokeredItemCount: 1, queuedItemCount: 1 },
      { variantSeqId: 2, isBaseline: "N", label: "Faster", attemptedItemCount: 2, brokeredItemCount: 2, queuedItemCount: 0 },
    ],
  };
}

describe("persisted simulation results", () => {
  beforeEach(() => {
    mocks.rules.mockReset().mockResolvedValue({ ruleResultList: [], totalCount: 0 });
  });

  it("shows persisted routing outcomes for the selected variant", async () => {
    mocks.items.mockReset().mockResolvedValue({ itemList: [], totalCount: 0 });
    mocks.rules.mockResolvedValue({ ruleResultList: [
      { ruleResultSeqId: 1, orderRoutingId: "R1", eligibleEntryCount: 4, attemptedItemCount: 3, brokeredItemCount: 2, queuedItemCount: 1 },
    ], totalCount: 1 });
    const wrapper = mount(SimulationResults, { props: { run: completeRun() }, global: { stubs } });
    await flushPromises();

    expect(mocks.rules).toHaveBeenCalledWith("S1", 1, 0, 25);
    expect(wrapper.text()).toContain("Routing R1");
    expect(wrapper.text()).toContain("Eligible: 4");
    expect(wrapper.text()).toContain("Attempted: 3");
  });

  it("shows real paged item outcomes beneath the baseline and variation aggregates", async () => {
    mocks.items.mockReset().mockResolvedValue({ itemList: [
      { ruleResultSeqId: 1, itemSeqId: 1, orderId: "O1", orderItemSeqId: "01", productId: "P1", facilityId: "F1", finalReason: "BROKERED", routedQty: 1, itemQty: 1 },
    ], totalCount: 1 });
    const wrapper = mount(SimulationResults, { props: { run: completeRun() }, global: { stubs } });
    await flushPromises();

    expect(mocks.items).toHaveBeenCalledWith("S1", 1, 0, 25);
    expect(wrapper.text()).toContain("Faster");
    expect(wrapper.text()).toContain("Order O1 · Item 01");
    expect(wrapper.text()).toContain("Product P1 · Facility F1");
    expect(wrapper.text()).toContain("BROKERED");
  });

  it("shows the saved variation's brokered and queued differences from its baseline", async () => {
    mocks.items.mockReset().mockResolvedValue({ itemList: [], totalCount: 0 });
    const wrapper = mount(SimulationResults, { props: { run: completeRun() }, global: { stubs } });
    await flushPromises();

    expect(wrapper.text()).toContain("Compared with baseline");
    expect(wrapper.text()).toContain("Brokered: +1");
    expect(wrapper.text()).toContain("Queued: -1");
  });

  it("labels an empty result honestly instead of fabricating route deltas", async () => {
    mocks.items.mockReset().mockResolvedValue({ itemList: [], totalCount: 0 });
    const wrapper = mount(SimulationResults, { props: { run: completeRun() }, global: { stubs } });
    await flushPromises();

    expect(wrapper.text()).toContain("No order item outcomes were recorded for this variant.");
    expect(wrapper.text()).not.toContain("Order O1");
  });

  it("explains a completed run that attempted no orders", async () => {
    mocks.items.mockReset().mockResolvedValue({ itemList: [], totalCount: 0 });
    const run = completeRun();
    run.simulation.attemptedItemCount = 0;
    run.variants = run.variants.map((variant) => ({ ...variant, attemptedItemCount: 0, brokeredItemCount: 0 }));
    const wrapper = mount(SimulationResults, { props: { run }, global: { stubs } });
    await flushPromises();

    expect(wrapper.text()).toContain("No orders were attempted");
    expect(wrapper.text()).toContain("approved orders waiting in a queue");
    expect(wrapper.text()).not.toContain("Compared with baseline");
  });

  it("keeps partial item outcomes visible when a persisted run failed", async () => {
    mocks.items.mockReset().mockResolvedValue({ itemList: [
      { ruleResultSeqId: 1, itemSeqId: 1, orderId: "O1", orderItemSeqId: "01", finalReason: "ERROR" },
    ], totalCount: 1 });
    const run = completeRun();
    run.simulation.statusId = "BRSIM_FAILED";
    const wrapper = mount(SimulationResults, { props: { run }, global: { stubs } });
    await flushPromises();

    expect(mocks.items).toHaveBeenCalledWith("S1", 1, 0, 25);
    expect(wrapper.text()).toContain("may be incomplete");
    expect(wrapper.text()).toContain("Order O1");
  });

  it("switches variants and pages the selected variant's outcomes", async () => {
    mocks.items.mockReset().mockResolvedValue({ itemList: [], totalCount: 26 });
    const wrapper = mount(SimulationResults, { props: { run: completeRun() }, global: { stubs } });
    await flushPromises();

    wrapper.findComponent({ name: "IonSelect" }).vm.$emit("update:modelValue", 2);
    await flushPromises();
    expect(mocks.items).toHaveBeenLastCalledWith("S1", 2, 0, 25);

    const next = wrapper.findAllComponents({ name: "IonButton" }).find((button) => button.text() === "Next");
    await next?.trigger("click");
    await flushPromises();
    expect(mocks.items).toHaveBeenLastCalledWith("S1", 2, 1, 25);
  });
});
