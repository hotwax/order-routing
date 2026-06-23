import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CompositeScorePanel from "../src/components/simulation/CompositeScorePanel.vue";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";

vi.mock("@common", () => ({ translate: (s: string) => s }));

const stubs = {
  IonAccordionGroup: { template: "<div><slot /></div>" },
  IonAccordion: { template: "<div><slot /></div>" },
  IonItem: { template: "<div><slot /></div>" },
  IonLabel: { template: "<span><slot /></span>" },
  IonRange: {
    props: ["value"],
    emits: ["ionInput"],
    template: "<input type='range' :value='value' @input=\"$emit('ionInput', { detail: { value: Number($event.target.value) } })\" />",
  },
};

function mountIt(results: any) {
  return mount(CompositeScorePanel, { props: { results }, global: { stubs } });
}

describe("CompositeScorePanel", () => {
  it("names the suggested winner and emits it on mount", () => {
    const results = makeResults(makeOutcomes(), [
      { label: "great", outcomes: makeOutcomes({ unfillable: { itemCount: 0, orderCount: 0, rate: 0 }, sla: { ...makeOutcomes().sla, complianceRate: 0.99 }, cost: { ...makeOutcomes().cost, totalShippingCost: 1000 } }) },
      { label: "meh", outcomes: makeOutcomes({ unfillable: { itemCount: 80, orderCount: 30, rate: 0.16 }, sla: { ...makeOutcomes().sla, complianceRate: 0.70 }, cost: { ...makeOutcomes().cost, totalShippingCost: 2500 } }) },
    ]);
    const w = mountIt(results);
    expect(w.text()).toContain("great");
    expect(w.emitted("winner")?.[0]).toEqual(["great"]);
  });

  it("recomputes the winner when weights change", async () => {
    // A wins on cost only; B wins decisively on unfillable + SLA (weighted 0.8 > A's 0.2 cost edge).
    // Cranking cost weight to 1 flips the winner from B to A.
    const results = makeResults(makeOutcomes(), [
      { label: "A-cheap", outcomes: makeOutcomes({ unfillable: { itemCount: 250, orderCount: 90, rate: 0.50 }, sla: { ...makeOutcomes().sla, complianceRate: 0.50 }, cost: { ...makeOutcomes().cost, totalShippingCost: 800 } }) },
      { label: "B-reliable", outcomes: makeOutcomes({ unfillable: { itemCount: 5, orderCount: 2, rate: 0.01 }, sla: { ...makeOutcomes().sla, complianceRate: 0.99 }, cost: { ...makeOutcomes().cost, totalShippingCost: 2400 } }) },
    ]);
    const w = mountIt(results);
    expect(w.emitted("winner")?.[0]).toEqual(["B-reliable"]); // default weights favor unfillable/SLA

    const ranges = w.findAll("input[type='range']");
    // order of sliders: [unfillable, sla, cost]; set unfillable=0, sla=0, cost=1
    await ranges[0].setValue(0);
    await ranges[0].trigger("input");
    await ranges[1].setValue(0);
    await ranges[1].trigger("input");
    await ranges[2].setValue(1);
    await ranges[2].trigger("input");

    const emissions = w.emitted("winner") as string[][];
    expect(emissions[emissions.length - 1]).toEqual(["A-cheap"]);
  });
});
