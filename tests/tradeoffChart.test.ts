import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import TradeoffChart from "../src/components/simulation/TradeoffChart.vue";
import { toRows } from "../src/util/simulationResults";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";

vi.mock("@common", () => ({ translate: (s: string) => s }));

function mountIt(results: any) {
  return mount(TradeoffChart, { props: { rows: toRows(results) } });
}

describe("TradeoffChart", () => {
  it("renders one point per row when >=2 rows have cost + SLA", () => {
    const w = mountIt(makeResults(makeOutcomes(), [
      { label: "v1", outcomes: makeOutcomes({ cost: { ...makeOutcomes().cost, totalShippingCost: 1500 } }) },
    ]));
    expect(w.findAll("circle.point").length).toBe(2);
    expect(w.find("svg").exists()).toBe(true);
  });

  it("shows the needs-metrics note when fewer than 2 rows have cost + SLA", () => {
    const noCost = makeOutcomes({ cost: { ...makeOutcomes().cost, available: false } });
    const w = mountIt(makeResults(noCost, [{ label: "v1", outcomes: noCost }]));
    expect(w.find("svg").exists()).toBe(false);
    expect(w.text()).toContain("Tradeoff chart needs cost + SLA metrics");
  });

  it("places lower-cost/higher-SLA points toward the upper-left", () => {
    const w = mountIt(makeResults(
      makeOutcomes({ cost: { ...makeOutcomes().cost, totalShippingCost: 2000 }, sla: { ...makeOutcomes().sla, complianceRate: 0.80 } }),
      [{ label: "frontier", outcomes: makeOutcomes({ cost: { ...makeOutcomes().cost, totalShippingCost: 1000 }, sla: { ...makeOutcomes().sla, complianceRate: 0.99 } }) }],
    ));
    const circles = w.findAll("circle.point");
    const byLabel = (i: number) => ({ cx: Number(circles[i].attributes("cx")), cy: Number(circles[i].attributes("cy")) });
    // index 0 = baseline (expensive, low SLA) -> right & low; index 1 = frontier -> left & high (small cy)
    expect(byLabel(1).cx).toBeLessThan(byLabel(0).cx);
    expect(byLabel(1).cy).toBeLessThan(byLabel(0).cy);
  });
});
