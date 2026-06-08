import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ExpeditedPanel from "../src/components/simulation/ExpeditedPanel.vue";
import { toRows } from "../src/util/outcomes";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";

vi.mock("@common", () => ({
  translate: (s: string) => s,
  commonUtil: { formatCurrency: (a: number, c: string) => `${c === "USD" ? "$" : ""}${Number(a).toFixed(2)}` },
}));

function mountIt(results: any) {
  return mount(ExpeditedPanel, { props: { rows: toRows(results) } });
}

describe("ExpeditedPanel", () => {
  it("renders ground/air items and cost", () => {
    const w = mountIt(makeResults(makeOutcomes(), []));
    const t = w.text();
    expect(t).toContain("410"); // ground items
    expect(t).toContain("60");  // air items
    expect(t).toContain("$440.50"); // air cost
  });

  it("degrades when cost is unavailable", () => {
    const noCost = makeOutcomes({ cost: { ...makeOutcomes().cost, available: false } });
    const w = mountIt(makeResults(noCost, []));
    expect(w.text()).toContain("—");
  });
});
