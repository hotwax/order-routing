import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();

vi.mock("@common", () => ({
  api: (...args: any[]) => api(...args),
  commonUtil: { hasError: (response: any) => Boolean(response?._error) },
}));

vi.mock("@/utils/simConfig", () => ({
  simApiBaseUrl: () => "https://simulation.example/rest/s1/",
}));

import { fetchPastSimulations, submitBatch } from "@/services/SimulationService";

describe("SimulationService", () => {
  beforeEach(() => api.mockReset());

  it("submits a store-scoped variation batch to the simulation service", async () => {
    api.mockResolvedValue({ data: { jobId: "JOB_1" } });

    await expect(submitBatch({
      routingGroupId: "GROUP",
      variants: [{ label: "Tighter distance", parameterOverrides: { distance: 25 }, routingDeltas: [] }],
      sampleCap: 500,
    })).resolves.toBe("JOB_1");

    expect(api).toHaveBeenCalledWith({
      url: "sim-routing/routingGroups/GROUP/brokeringSimulation/jobs",
      method: "POST",
      baseURL: "https://simulation.example/rest/s1/",
      data: {
        variants: [{ label: "Tighter distance", parameterOverrides: { distance: 25 }, routingDeltas: [] }],
        sampleCap: 500,
      },
    });
  });

  it("rejects a successful-looking response that has no job id", async () => {
    api.mockResolvedValue({ data: {} });

    await expect(submitBatch({ routingGroupId: "GROUP", variants: [] }))
      .rejects.toThrow("Failed to submit simulation batch");
  });

  it("maps the persisted simulation list contract", async () => {
    api.mockResolvedValue({
      data: {
        simulationList: [{ simulationId: "SIM_1", statusId: "COMPLETE" }],
        totalCount: 7,
      },
    });

    await expect(fetchPastSimulations({
      productStoreId: "STORE",
      statusId: "COMPLETE",
      pageIndex: 0,
      pageSize: 25,
    })).resolves.toEqual({
      headers: [{ simulationId: "SIM_1", statusId: "COMPLETE" }],
      total: 7,
    });

    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      url: "sim-routing/brokeringSimulations",
      baseURL: "https://simulation.example/rest/s1/",
      params: expect.objectContaining({ productStoreId: "STORE", statusId: "COMPLETE", pageSize: 25 }),
    }));
  });
});
