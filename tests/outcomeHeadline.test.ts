import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import OutcomeHeadline from "../src/components/simulation/OutcomeHeadline.vue";
import { toRows } from "../src/util/outcomes";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";

vi.mock("@common", () => ({
  translate: (s: string) => s,
  commonUtil: { formatCurrency: (a: number, c: string) => `${c === "USD" ? "$" : ""}${Number(a).toFixed(2)}` },
}));

const stubs = {
  IonCard: { template: "<div><slot /></div>" },
  IonCardHeader: { template: "<div><slot /></div>" },
  IonCardTitle: { template: "<div><slot /></div>" },
  IonCardContent: { template: "<div><slot /></div>" },
};

function mountIt(results: any, winnerLabel?: string) {
  return mount(OutcomeHeadline, { props: { rows: toRows(results), winnerLabel }, global: { stubs } });
}

describe("OutcomeHeadline", () => {
  it("renders fill rate, unfillable, SLA % and cost for baseline + variant", () => {
    const w = mountIt(makeResults(makeOutcomes(), [{ label: "v1", outcomes: makeOutcomes({ fillRate: 0.97 }) }]));
    const t = w.text();
    expect(t).toContain("94.0%");   // baseline fill rate
    expect(t).toContain("97.0%");   // variant fill rate
    expect(t).toContain("30");      // unfillable item count
    expect(t).toContain("89.0%");   // SLA compliance
    expect(t).toContain("$1840.50"); // total cost
  });

  it("shows money saved vs baseline for a cheaper variant", () => {
    const w = mountIt(makeResults(makeOutcomes(), [
      { label: "cheap", outcomes: makeOutcomes({ cost: { ...makeOutcomes().cost, totalShippingCost: 1500 } }) },
    ]));
    expect(w.text()).toContain("$340.50"); // 1840.50 - 1500
  });

  it("degrades SLA and cost to em dash when unavailable", () => {
    const noSlaCost = makeOutcomes({
      sla: { ...makeOutcomes().sla, available: false },
      cost: { ...makeOutcomes().cost, available: false },
    });
    const w = mountIt(makeResults(noSlaCost, []));
    expect(w.text()).toContain("—");
  });

  it("marks the winner column", () => {
    const w = mountIt(makeResults(makeOutcomes(), [{ label: "v1", outcomes: makeOutcomes() }]), "v1");
    expect(w.find(".winner").exists()).toBe(true);
  });
});
