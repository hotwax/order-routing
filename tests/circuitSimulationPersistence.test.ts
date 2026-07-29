import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@common", () => ({
  api: vi.fn(),
  client: vi.fn(),
  commonUtil: {
    getToken: () => "token",
    hasError: (response: any) => response?._error === true,
    showToast: vi.fn(),
  },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  translate: (value: string) => value,
}));

import { orderRoutingStore } from "../src/store/orderRoutingStore";
import { registerWorkingFlushHook, simulationStore } from "../src/store/simulationStore";
import { VariationService } from "../src/services/VariationService";

const savedGroup = () => ({
  routingGroupId: "G1",
  variationGroupId: "V1",
  routings: [{
    orderRoutingId: "V1_R1",
    routingName: "Standard",
    statusId: "ROUTING_ACTIVE",
    sequenceNum: 1,
    orderFilters: [],
    rules: [],
  }],
});

function prepareVariationEdit() {
  const sim = simulationStore();
  const saved = savedGroup();
  sim.routingGroupId = "G1";
  sim.groupLoadState = "ready";
  sim.baseline = structuredClone(saved);
  sim.activeVariationId = "V1";
  sim.variations = [{ id: "V1", label: "Circuit draft", serverVid: "V1", group: structuredClone(saved) }] as any;
  sim.working = structuredClone(saved);
  sim.working.routings[0].routingName = "Circuit-edited routing";
  return sim;
}

describe("Circuit variation persistence boundary", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    registerWorkingFlushHook(null);
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps an accepted variation proposal dirty when Update fails and never mutates the live OMS store", async () => {
    const sim = prepareVariationEdit();
    const live = orderRoutingStore();
    live.currentGroup = { routingGroupId: "LIVE", groupName: "Untouched live group", routings: [] };
    const liveBefore = JSON.parse(JSON.stringify(live.currentGroup));
    const setCurrentGroup = vi.spyOn(live, "setCurrentGroup");
    const updateRouting = vi.spyOn(live, "updateRouting");
    vi.spyOn(VariationService, "replaceVariationConfig").mockRejectedValue(new Error("simulation save failed"));

    expect(sim.isDirty).toBe(true);
    await expect(sim.updateVariation("V1")).resolves.toBe(false);

    expect(sim.isDirty).toBe(true);
    expect(sim.working.routings[0].routingName).toBe("Circuit-edited routing");
    expect(sim.variations[0].group.routings[0].routingName).toBe("Standard");
    expect(sim.loadError).toBe("simulation save failed");
    expect(live.currentGroup).toEqual(liveBefore);
    expect(setCurrentGroup).not.toHaveBeenCalled();
    expect(updateRouting).not.toHaveBeenCalled();
  });

  it("adopts the canonical simulation response only after a successful Update", async () => {
    const sim = prepareVariationEdit();
    const live = orderRoutingStore();
    live.currentGroup = { routingGroupId: "LIVE", groupName: "Untouched live group", routings: [] };
    const liveBefore = JSON.parse(JSON.stringify(live.currentGroup));
    vi.spyOn(VariationService, "replaceVariationConfig").mockResolvedValue({
      variationGroupId: "V1",
      parentRoutingGroupId: "G1",
      productStoreId: "STORE",
      variationName: "Circuit draft",
      statusId: "VAR_DRAFT",
      routings: [{
        orderRoutingId: "V1_CANONICAL_R1",
        routingName: "Circuit-edited routing",
        statusId: "ROUTING_ACTIVE",
        sequenceNum: 1,
        filters: [],
        rules: [],
      }],
    } as any);

    await expect(sim.updateVariation("V1")).resolves.toBe(true);

    expect(VariationService.replaceVariationConfig).toHaveBeenCalledWith("V1", expect.any(Array));
    expect(sim.working.routings[0].orderRoutingId).toBe("V1_CANONICAL_R1");
    expect(sim.variations[0].group).toEqual(sim.working);
    expect(sim.isDirty).toBe(false);
    expect(live.currentGroup).toEqual(liveBefore);
  });
});
