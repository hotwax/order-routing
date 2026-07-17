import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/utils/simConfig", () => ({
  simApiBaseUrl: () => "https://sim.example/rest/s1/",
}));

import { submitBatch } from "../src/services/SimulationService";
import { runVariation } from "../src/services/VariationService";
import { simApi } from "../src/services/SimApiService";

describe("SimulationService API contract", () => {
  afterEach(() => {
    api.mockReset();
    client.mockReset();
  });

  it("submits through the isolated simulation client at the trusted base URL", async () => {
    client.mockResolvedValue({ data: { jobId: "JOB-1" } });

    await expect(submitBatch({
      routingGroupId: "GROUP-1",
      variants: [{ label: "Closer stores", parameterOverrides: {}, routingDeltas: [] }],
      sampleCap: 500,
    })).resolves.toBe("JOB-1");

    expect(client).toHaveBeenCalledWith({
      url: "sim-routing/routingGroups/GROUP-1/brokeringSimulation/jobs",
      method: "POST",
      baseURL: "https://sim.example/rest/s1/",
      headers: {
        Authorization: "Bearer oms-token",
        "Content-Type": "application/json",
      },
      data: {
        variants: [{ label: "Closer stores", parameterOverrides: {}, routingDeltas: [] }],
        sampleCap: 500,
      },
    });
    expect(api).not.toHaveBeenCalled();
  });

  it("omits an unset sample cap and rejects malformed success responses", async () => {
    client.mockResolvedValue({ data: {} });

    await expect(submitBatch({ routingGroupId: "GROUP-1", variants: [] }))
      .rejects.toThrow("Failed to submit simulation batch");

    expect(client.mock.calls[0][0].data).toEqual({ variants: [] });
  });

  it("rejects backend error responses", async () => {
    client.mockResolvedValue({ _error: true, data: { error: "unavailable" } });

    await expect(submitBatch({ routingGroupId: "GROUP-1", variants: [] }))
      .rejects.toThrow("Failed to submit simulation batch");
  });

  it("keeps a simulation-host 401 isolated from the shared OMS API client", async () => {
    client.mockRejectedValue(Object.assign(new Error("denied"), { response: { status: 401 } }));

    await expect(submitBatch({ routingGroupId: "GROUP-1", variants: [] }))
      .rejects.toThrow("denied");

    expect(api).not.toHaveBeenCalled();
  });

  it("forwards the variation timeout and AbortSignal to the isolated client", async () => {
    const controller = new AbortController();
    client.mockResolvedValue({ data: { groupRunResult: { routingGroupId: "V1", routingResults: [] } } });

    await runVariation("V1", 500, controller.signal);

    expect(client).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 10 * 60_000,
      signal: controller.signal,
      url: "sim-routing/variations/V1/simulation",
    }));
  });

  it("refuses an absolute or root-escaping URL before attaching the OMS token", async () => {
    await expect(simApi({ url: "https://untrusted.example/collect", method: "POST" }))
      .rejects.toThrow("relative to the configured simulation REST root");
    await expect(simApi({ url: "../admin/users", method: "GET" }))
      .rejects.toThrow("relative to the configured simulation REST root");
    expect(client).not.toHaveBeenCalled();
  });
});
