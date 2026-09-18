import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
const client = vi.fn();

vi.mock("@common", () => ({
  api: (...args: any[]) => api(...args),
  client: (...args: any[]) => client(...args),
  commonUtil: {
    getToken: () => "oms-token",
    hasError: (response: any) => response?._error === true,
  },
}));

import { submitBatch } from "../src/services/SimulationService";

describe("simulation network config gate", () => {
  beforeEach(() => {
    api.mockReset();
    client.mockReset();
    vi.stubEnv("VITE_SIM_URL", "https://sim.example.test");
    vi.stubEnv("VITE_SIMULATION_ENABLED", "false");
    vi.stubEnv("VITE_SIM_ALLOW_OMS_BEARER", "false");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("makes no request while the feature is disabled", async () => {
    await expect(submitBatch({ routingGroupId: "GROUP-1", variants: [] }))
      .rejects.toThrow("VITE_SIMULATION_ENABLED");
    expect(api).not.toHaveBeenCalled();
    expect(client).not.toHaveBeenCalled();
  });

  it("makes no request until the deployment attests that the sim origin accepts the OMS bearer", async () => {
    vi.stubEnv("VITE_SIMULATION_ENABLED", "true");

    await expect(submitBatch({ routingGroupId: "GROUP-1", variants: [] }))
      .rejects.toThrow("VITE_SIM_ALLOW_OMS_BEARER");
    expect(api).not.toHaveBeenCalled();
    expect(client).not.toHaveBeenCalled();
  });

  it("uses only the explicitly trusted origin when every gate is enabled", async () => {
    vi.stubEnv("VITE_SIMULATION_ENABLED", "true");
    vi.stubEnv("VITE_SIM_ALLOW_OMS_BEARER", "true");
    client.mockResolvedValue({ data: { jobId: "JOB-1" } });

    await expect(submitBatch({ routingGroupId: "GROUP-1", variants: [] })).resolves.toBe("JOB-1");
    expect(client).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "https://sim.example.test/rest/s1/",
      url: "sim-routing/routingGroups/GROUP-1/brokeringSimulation/jobs",
    }));
  });
});
