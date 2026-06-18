import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import FulfillmentMixPanel from "../src/components/simulation/FulfillmentMixPanel.vue";
import { toRows } from "../src/util/simulationResults";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";

vi.mock("@common", () => ({ translate: (s: string) => s }));

function withClassification() {
  return makeOutcomes({
    available: { cost: true, sla: true, inventory: true, classification: true },
    classification: {
      available: true,
      fulfillmentMix: {
        byFacilityType: { DC: 300, A_GRADE_STORE: 90, STORE: 80 },
        clearanceFromStore: 70,
        newSeasonFromDC: 250,
      },
    },
  });
}

function mountIt(results: any) {
  return mount(FulfillmentMixPanel, { props: { rows: toRows(results) } });
}

describe("FulfillmentMixPanel", () => {
  it("renders facility-type segments and policy figures when classification is available", () => {
    const w = mountIt(makeResults(withClassification(), []));
    const t = w.text();
    expect(t).toContain("DC");
    expect(t).toContain("300");
    expect(t).toContain("70");  // clearanceFromStore
    expect(t).toContain("250"); // newSeasonFromDC
    expect(w.findAll(".seg").length).toBeGreaterThanOrEqual(3);
  });

  it("renders nothing visible when no row has classification", () => {
    const w = mountIt(makeResults(makeOutcomes(), [])); // classification.available = false
    expect(w.find(".seg").exists()).toBe(false);
    expect(w.text().trim()).toBe("");
  });
});
