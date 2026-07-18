import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import SimulationResults from "../src/components/simulation/SimulationResults.vue";
import { simulationStore } from "../src/store/simulationStore";
import { modalController } from "@ionic/vue";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";

vi.mock("@common", () => ({
  translate: (s: string) => s,
  commonUtil: { formatCurrency: (a: number, c: string) => `${c === "USD" ? "$" : ""}${Number(a).toFixed(2)}` },
}));

// SimulationResults calls useRouter() for the "View saved result" deep-link; provide a stub so the
// component mounts without a real router (the link only renders when lastSimulationId is set).
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: routerMocks.push }) }));

// Stub child panels + Ionic so the container test stays focused on composition.
const childStubs = {
  SimulationProgress: { template: "<div class='progress-stub' />" },
  OutcomeHeadline: { props: ["rows", "winnerLabel"], template: "<div class='headline-stub'>{{ rows.length }}|{{ winnerLabel }}</div>" },
  TradeoffChart: { props: ["rows"], template: "<div class='tradeoff-stub' />" },
  ExpeditedPanel: { props: ["rows"], template: "<div class='expedited-stub' />" },
  StockoutPanel: { props: ["rows"], template: "<div class='stockout-stub' />" },
  FulfillmentMixPanel: { props: ["rows"], template: "<div class='mix-stub' />" },
  CompositeScorePanel: { props: ["results"], emits: ["winner"], template: "<button class='score-stub' @click=\"$emit('winner','v1')\" />" },
  AdvancedDetails: { props: ["results"], template: "<div class='advanced-stub' />" },
  IonButton: { template: "<button><slot /></button>" },
  IonCard: { template: "<div><slot /></div>" },
  IonCardHeader: { template: "<div><slot /></div>" },
  IonCardTitle: { template: "<div><slot /></div>" },
  IonCardContent: { template: "<div><slot /></div>" },
  IonIcon: { template: "<i />" },
  IonAccordion: { template: "<div><slot /></div>" },
  IonAccordionGroup: { template: "<div><slot /></div>" },
  IonItem: { name: "IonItem", template: "<div><slot /></div>" },
  IonLabel: { template: "<span><slot /></span>" },
  IonList: { template: "<div><slot /></div>" },
  IonListHeader: { template: "<div><slot /></div>" },
  IonNote: { template: "<span><slot /></span>" },
  IonProgressBar: { template: "<div class='progress-bar-stub' />" },
};

function mountIt() {
  return mount(SimulationResults, { global: { stubs: childStubs } });
}

describe("SimulationResults container", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    routerMocks.push.mockReset();
  });

  it("composes panels with baseline+variant rows and reflects the winner from the score panel", async () => {
    const sim = simulationStore();
    sim.results = makeResults(makeOutcomes(), [{ label: "v1", outcomes: makeOutcomes() }]) as any;
    sim.isRunning = false;
    const w = mountIt();
    expect(w.find(".headline-stub").text()).toContain("2|"); // 2 rows
    expect(w.find(".advanced-stub").exists()).toBe(true);

    await w.find(".score-stub").trigger("click"); // emits winner = v1
    expect(w.find(".headline-stub").text()).toContain("v1");
  });

  it("shows partial and simulationRan warnings", () => {
    const sim = simulationStore();
    sim.results = makeResults(makeOutcomes(), [], { partial: true, simulationRan: false }) as any;
    sim.isRunning = false;
    const w = mountIt();
    const t = w.text();
    expect(t).toContain("partial");
    expect(t).toContain("did not run");
  });

  it("falls back to the legacy headline when no outcomes block is present", () => {
    const sim = simulationStore();
    // baseline/variants with NO outcomes anywhere
    sim.results = makeResults(null, [{ label: "v1", outcomes: null }]) as any;
    sim.isRunning = false;
    const w = mountIt();
    // legacy headline still renders rows; tradeoff hidden path handled inside child
    expect(w.find(".headline-stub").exists()).toBe(true);
    expect(w.find(".headline-stub").text()).toContain("2|");
  });

  it("renders a baseline run without presenting it as a variation comparison", () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.baseline = { routings: [{ orderRoutingId: "P1", routingName: "Standard" }] };
    sim.baselineRunResult = {
      routingGroupId: "G1",
      routingResults: [{
        orderRoutingId: "P1",
        sequenceNum: 1,
        eligibleEntryCount: 5,
        brokeredItemCount: 4,
        queuedItemCount: 1
      }]
    } as any;

    const wrapper = mountIt();

    expect(wrapper.text()).toContain("Baseline results");
    expect(wrapper.text()).toContain("Standard");
    expect(wrapper.text()).toContain("Eligible5");
    expect(wrapper.text()).not.toContain("Baseline → Variation");
  });

  it("labels baseline and the active variation in per-routing comparison results", () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.activeVariationId = "V1";
    sim.variations = [{ id: "V1", label: "Faster routing", serverVid: "V1", group: null }] as any;
    sim.baseline = { routings: [{ orderRoutingId: "P1", routingName: "Standard" }] };
    sim.working = { routings: [{ orderRoutingId: "V1_r0", routingName: "Standard" }] };
    sim.parentRunByGroupId.G1 = { routingGroupId: "G1", routingResults: [{ orderRoutingId: "P1", sequenceNum: 1, eligibleEntryCount: 2 }] } as any;
    sim.variationRunResult = { routingGroupId: "V1", routingResults: [{ orderRoutingId: "V1_r0", sequenceNum: 1, eligibleEntryCount: 3 }] } as any;

    const wrapper = mountIt();

    expect(wrapper.find(".compare-legend").text()).toBe("Baseline → Faster routing");
    expect(wrapper.text()).toContain("Standard");
    expect(wrapper.text()).toContain("2 → 3");
  });

  it("opens canonical history for a persisted synchronous variation result", async () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.activeVariationId = "V1";
    sim.variations = [{ id: "V1", label: "Faster routing", serverVid: "V1", group: null }] as any;
    sim.variationRunResult = { simulationId: "M100374", routingGroupId: "V1", routingResults: [] } as any;
    sim.lastSimulationId = "M100374";

    const wrapper = mountIt();
    const link = wrapper.find('[data-testid="view-saved-simulation"]');
    expect(link.exists()).toBe(true);
    await link.trigger("click");
    expect(routerMocks.push).toHaveBeenCalledWith("/simulate/history/M100374");
  });

  it("renders explicit empty, partial, and failed payload states", () => {
    const sim = simulationStore();
    sim.results = { baseline: null, variants: [], partial: true, simulationRan: false } as any;
    let wrapper = mountIt();
    expect(wrapper.text()).toContain("No result payload was returned");
    expect(wrapper.find(".headline-stub").exists()).toBe(false);

    sim.results = {
      baseline: { failed: true, failureReason: "Parent timed out" },
      variants: [{ label: "Candidate", failed: true, failureReason: "No inventory snapshot", groupRun: null }],
      partial: true,
      simulationRan: true
    } as any;
    wrapper = mountIt();
    expect(wrapper.text()).toContain("Baseline: Parent timed out");
    expect(wrapper.text()).toContain("Candidate: No inventory snapshot");
  });

  it("shows a failed variation run and opens routing detail from a rendered row", async () => {
    const sim = simulationStore();
    sim.routingGroupId = "G1";
    sim.activeVariationId = "V1";
    sim.variations = [{ id: "V1", label: "Candidate", serverVid: "V1", group: null }] as any;
    sim.baseline = { routings: [] };
    sim.working = { routings: [{ orderRoutingId: "V1_r0", routingName: "Only variation" }] };
    sim.variationRunResult = { routingGroupId: "V1", routingResults: [{ orderRoutingId: "V1_r0", sequenceNum: 1, eligibleEntryCount: 0 }] } as any;
    sim.runCompareError = "Parent comparison failed";
    const present = vi.fn(async () => undefined);
    vi.spyOn(modalController, "create").mockResolvedValue({ present } as any);

    const wrapper = mountIt();
    expect(wrapper.text()).toContain("Parent comparison failed");
    expect(wrapper.text()).toContain("Parent run unavailable");
    await wrapper.find(".cmp").trigger("click");
    await flushPromises();

    expect(modalController.create).toHaveBeenCalledWith(expect.objectContaining({
      componentProps: { row: expect.objectContaining({ routingName: "Only variation", parent: null }) }
    }));
    expect(present).toHaveBeenCalledOnce();
  });
});
