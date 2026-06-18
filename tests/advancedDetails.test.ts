import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import AdvancedDetails from "../src/components/simulation/AdvancedDetails.vue";

vi.mock("@common", () => ({ translate: (s: string) => s }));

const ionicStubs = {
  IonAccordionGroup: { template: "<div><slot /></div>" },
  IonAccordion: { template: "<div><slot /></div>" },
  IonItem: { template: "<div><slot /></div>" },
  IonLabel: { template: "<span><slot /></span>" },
  IonList: { template: "<div><slot /></div>" },
};

function mountIt(results: any) {
  return mount(AdvancedDetails, { props: { results }, global: { stubs: ionicStubs } });
}

describe("AdvancedDetails", () => {
  it("renders finalReason transitions, per-routing and per-facility deltas", () => {
    const w = mountIt({
      baseline: {},
      variants: [
        { label: "v1", failed: false, diff: {
            finalReasonTransitions: { "O1-1": "QUEUED → BROKERED" },
            routingBrokeredDelta: { "Rule A": [10, 14] },
            facilityAllocationDelta: { "Store 42": [5, 7] },
          } },
      ],
    });
    const text = w.text();
    expect(text).toContain("O1-1: QUEUED → BROKERED");
    expect(text).toContain("Rule A: 10 → 14");
    expect(text).toContain("Store 42: 5 → 7");
  });

  it("shows the failure reason for a failed variant", () => {
    const w = mountIt({
      baseline: {},
      variants: [{ label: "bad", failed: true, failureReason: "timeout", diff: null }],
    });
    expect(w.text()).toContain("timeout");
  });

  it("degrades to 'No outcome changes.' when a variant has no transitions", () => {
    const w = mountIt({ baseline: {}, variants: [{ label: "v1", failed: false, diff: { finalReasonTransitions: {} } }] });
    expect(w.text()).toContain("No outcome changes.");
  });
});
