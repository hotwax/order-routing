import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.fn();
let token = "oms-token";

vi.mock("@common", () => ({
  client: (...args: any[]) => client(...args),
  commonUtil: {
    getToken: () => token,
  },
}));

vi.mock("@/utils/simConfig", () => ({
  simApiBaseUrl: () => "https://sim.example/rest/s1/",
}));

import { simApi } from "../src/services/SimApiService";

describe("simulation API security boundary", () => {
  beforeEach(() => {
    client.mockReset();
    token = "oms-token";
  });

  it("rejects every absolute URL, including one on the trusted origin", async () => {
    await expect(simApi({
      url: "https://sim.example/rest/s1/sim-routing/variations",
      method: "GET",
    })).rejects.toThrow("relative to the configured simulation REST root");

    expect(client).not.toHaveBeenCalled();
  });

  it("fails before sending when the OMS session has no token", async () => {
    token = "";

    await expect(simApi({
      url: "sim-routing/variations",
      method: "GET",
    })).rejects.toThrow("authenticated OMS session");

    expect(client).not.toHaveBeenCalled();
  });

  it("does not let callers replace the trusted bearer or JSON content type", async () => {
    client.mockResolvedValue({ data: [] });

    await simApi({
      url: "sim-routing/variations",
      method: "GET",
      headers: {
        Authorization: "Bearer attacker-token",
        "Content-Type": "text/plain",
        "X-Request-Context": "simulation",
      },
    });

    expect(client).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "https://sim.example/rest/s1/",
      headers: {
        Authorization: "Bearer oms-token",
        "Content-Type": "application/json",
        "X-Request-Context": "simulation",
      },
    }));
  });
});
