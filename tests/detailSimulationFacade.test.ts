import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("@common", () => ({
  api: (...args: any[]) => mocks.api(...args),
  commonUtil: { hasError: (response: any) => response?._error === true },
}));

import { fetchRoutingGroupDetail, getSimulation, listSimulationItems, listSimulationRuleResults, listSimulations, submitSimulation, waitForSimulation } from "../src/services/SimulationService";
import { createVariation, deleteVariation, getVariation, listVariations, replaceVariationConfig } from "../src/services/VariationService";

describe("routing-detail simulation reads", () => {
  beforeEach(() => {
    mocks.api.mockReset();
  });

  it("loads the copied routing group through Main OMS and unwraps its group map", async () => {
    mocks.api.mockResolvedValue({ data: { group: { routingGroupId: "PRE_ORDER_GROUP", routings: [] } } });

    await expect(fetchRoutingGroupDetail("PRE_ORDER_GROUP")).resolves.toEqual({
      routingGroupId: "PRE_ORDER_GROUP", routings: [],
    });
    expect(mocks.api).toHaveBeenCalledWith({
      url: "order-routing/simulation/groups/PRE_ORDER_GROUP", method: "GET",
    });
  });

  it("lists saved variations through Main OMS rather than the browser-to-Sim connection", async () => {
    const variation = { variationGroupId: "M100200", parentRoutingGroupId: "PRE_ORDER_GROUP", variationName: "Faster route" };
    mocks.api.mockResolvedValue({ data: { variationList: [variation], totalCount: 1 } });

    await expect(listVariations("PRE_ORDER_GROUP")).resolves.toEqual([variation]);
    expect(mocks.api).toHaveBeenCalledWith({
      url: "order-routing/simulation/variations", method: "GET",
      params: { parentRoutingGroupId: "PRE_ORDER_GROUP", pageIndex: 0, pageSize: 200 },
    });
  });

  it("loads saved variations beyond the first page instead of hiding older ones", async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({ variationGroupId: `V${index}` }));
    mocks.api.mockResolvedValueOnce({ data: { variationList: firstPage, totalCount: 201, pageIndex: 0, pageSize: 200 } });
    mocks.api.mockResolvedValueOnce({ data: { variationList: [{ variationGroupId: "V200" }], totalCount: 201, pageIndex: 1, pageSize: 200 } });

    const variations = await listVariations("PRE_ORDER_GROUP");

    expect(variations).toHaveLength(201);
    expect(variations[200].variationGroupId).toBe("V200");
    expect(mocks.api).toHaveBeenLastCalledWith({
      url: "order-routing/simulation/variations", method: "GET",
      params: { parentRoutingGroupId: "PRE_ORDER_GROUP", pageIndex: 1, pageSize: 200 },
    });
  });

  it("creates, reads, updates and deletes a variation through explicit Main OMS routes", async () => {
    const tree = { variationGroupId: "M100200", parentRoutingGroupId: "PRE_ORDER_GROUP", routings: [] };
    mocks.api.mockResolvedValueOnce({ data: { variationGroupId: "M100200" } });
    mocks.api.mockResolvedValueOnce({ data: { variation: tree } });
    mocks.api.mockResolvedValueOnce({ data: { variation: tree } });
    mocks.api.mockResolvedValueOnce({ data: {} });

    await expect(createVariation("PRE_ORDER_GROUP", "Faster route")).resolves.toBe("M100200");
    await expect(getVariation("M100200")).resolves.toEqual(tree);
    await expect(replaceVariationConfig("M100200", [])).resolves.toEqual(tree);
    await expect(deleteVariation("M100200")).resolves.toBeUndefined();
    expect(mocks.api.mock.calls.map(([request]) => request)).toEqual([
      { url: "order-routing/simulation/groups/PRE_ORDER_GROUP/variations", method: "POST", data: { variationName: "Faster route" } },
      { url: "order-routing/simulation/variations/M100200", method: "GET" },
      { url: "order-routing/simulation/variations/M100200/config", method: "PUT", data: { routings: [] } },
      { url: "order-routing/simulation/variations/M100200", method: "DELETE" },
    ]);
  });

  it("submits baseline and variation together, then reads the persisted async result", async () => {
    const run = { simulation: { simulationId: "M105", statusId: "BRSIM_COMPLETE" }, variants: [
      { variantSeqId: 1, isBaseline: "Y", brokeredItemCount: 4 },
      { variantSeqId: 2, isBaseline: "N", brokeredItemCount: 5 },
    ] };
    mocks.api.mockResolvedValueOnce({ data: { simulationId: "M105", statusId: "BRSIM_QUEUED", jobRunId: "M106" } });
    mocks.api.mockResolvedValueOnce({ data: run });
    await expect(submitSimulation(["PRE_ORDER_GROUP", "M100200"])).resolves.toEqual({
      simulationId: "M105", statusId: "BRSIM_QUEUED", jobRunId: "M106",
    });
    await expect(waitForSimulation("M105")).resolves.toEqual(run);
    expect(mocks.api.mock.calls.map(([request]) => request)).toEqual([
      { url: "order-routing/simulation/simulations", method: "POST", data: { routingGroupIds: ["PRE_ORDER_GROUP", "M100200"] } },
      { url: "order-routing/simulation/simulations/M105", method: "GET" },
    ]);
  });

  it("lists history through Main OMS with persisted BRSIM statuses", async () => {
    mocks.api.mockResolvedValue({ data: { simulationList: [{ simulationId: "M105", statusId: "BRSIM_COMPLETE" }], totalCount: 1 } });
    await expect(listSimulations({ productStoreId: "STORE", statusId: "BRSIM_COMPLETE" })).resolves.toEqual({
      simulationList: [{ simulationId: "M105", statusId: "BRSIM_COMPLETE" }], totalCount: 1,
    });
    expect(mocks.api).toHaveBeenCalledWith({
      url: "order-routing/simulation/simulations", method: "GET",
      params: { productStoreId: "STORE", statusId: "BRSIM_COMPLETE", pageIndex: 0, pageSize: 25 },
    });
  });

  it("pages real per-item outcomes through Main OMS", async () => {
    mocks.api.mockResolvedValue({ data: { itemList: [{ orderId: "O1", finalReason: "BROKERED" }], totalCount: 1 } });
    await expect(listSimulationItems("M105", 2, 0, 25)).resolves.toEqual({
      itemList: [{ orderId: "O1", finalReason: "BROKERED" }], totalCount: 1,
    });
    expect(mocks.api).toHaveBeenCalledWith({
      url: "order-routing/simulation/simulations/M105/variants/2/items", method: "GET",
      params: { pageIndex: 0, pageSize: 25 },
    });
  });

  it("pages per-routing outcomes through Main OMS", async () => {
    mocks.api.mockResolvedValue({ data: { ruleResultList: [{ ruleResultSeqId: 1, orderRoutingId: "R1" }], totalCount: 1 } });
    await expect(listSimulationRuleResults("M105", 2, 0, 25)).resolves.toEqual({
      ruleResultList: [{ ruleResultSeqId: 1, orderRoutingId: "R1" }], totalCount: 1,
    });
    expect(mocks.api).toHaveBeenCalledWith({
      url: "order-routing/simulation/simulations/M105/variants/2/rules", method: "GET",
      params: { pageIndex: 0, pageSize: 25 },
    });
  });
});
