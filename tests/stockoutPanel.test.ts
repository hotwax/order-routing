import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import StockoutPanel from "../src/components/simulation/StockoutPanel.vue";
import { toRows } from "../src/util/outcomes";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";

vi.mock("@common", () => ({ translate: (s: string) => s }));

const stubs = {
  IonAccordionGroup: { template: "<div><slot /></div>" },
  IonAccordion: { template: "<div><slot /></div>" },
  IonItem: { template: "<div><slot /></div>" },
  IonLabel: { template: "<span><slot /></span>" },
};

function mountIt(results: any) {
  return mount(StockoutPanel, { props: { rows: toRows(results) }, global: { stubs } });
}

describe("StockoutPanel", () => {
  it("renders the stores-at-zero count and store list", () => {
    const w = mountIt(makeResults(makeOutcomes(), []));
    const t = w.text();
    expect(t).toContain("3");        // count
    expect(t).toContain("Store 42"); // list entry
    expect(t).toContain("P1");       // product
  });

  it("degrades when inventory is unavailable", () => {
    const noInv = makeOutcomes({ inventory: { available: false, newSeasonStoresAtZero: 0, newSeasonStoresAtZeroList: [] } });
    const w = mountIt(makeResults(noInv, []));
    expect(w.text()).toContain("Inventory modeling off");
  });
});
