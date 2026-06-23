import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import SimulationResults from "../src/components/simulation/SimulationResults.vue";
import { simulationStore } from "../src/store/simulationStore";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";

vi.mock("@common", () => ({
  translate: (s: string) => s,
  commonUtil: { formatCurrency: (a: number, c: string) => `${c === "USD" ? "$" : ""}${Number(a).toFixed(2)}` },
}));

// SimulationResults calls useRouter() for the "View saved result" deep-link; provide a stub so the
// component mounts without a real router (the link only renders when lastSimulationId is set).
vi.mock("vue-router", () => ({ useRouter: () => ({ push: () => {} }) }));

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
  IonItem: { template: "<div><slot /></div>" },
  IonLabel: { template: "<span><slot /></span>" },
};

function mountIt() {
  return mount(SimulationResults, { global: { stubs: childStubs } });
}

describe("SimulationResults container", () => {
  beforeEach(() => { setActivePinia(createPinia()); });

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
});
