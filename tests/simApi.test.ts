// tests/simApi.test.ts — simRequest() uses client() + OMS Bearer token so sim 401s never fire the
// global logout interceptor.
import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.fn();
const api = vi.fn();
vi.mock("@common", () => ({
  client: (...a: any[]) => client(...a),
  api: (...a: any[]) => api(...a),
  commonUtil: { getToken: () => "oms-token-xyz", hasError: (r: any) => r?._error === true },
  logger: { warn: () => {}, error: () => {} },
}));

import { simRequest } from "../src/services/SimulationService";

const BASE = "https://asb-sim-uat.hotwax.io/rest/s1/order-routing";

describe("simRequest", () => {
  afterEach(() => { client.mockReset(); api.mockReset(); vi.unstubAllEnvs(); });

  it("uses client() (not api()) so sim 401s don't fire the global logout interceptor", async () => {
    client.mockResolvedValue({ data: { ok: true } });

    await simRequest({ url: "facilities", method: "GET", baseURL: BASE });

    expect(client).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalled();
  });

  it("attaches OMS Bearer token from commonUtil.getToken()", async () => {
    client.mockResolvedValue({ data: {} });

    await simRequest({ url: "facilities", method: "GET", baseURL: BASE });

    const cfg = client.mock.calls[0][0];
    expect(cfg.headers?.Authorization).toBe("Bearer oms-token-xyz");
  });

  it("passes through url, method, baseURL, and params unchanged", async () => {
    client.mockResolvedValue({ data: {} });
    const cfg = { url: "brokeringSimulations", method: "GET", baseURL: BASE, params: { pageSize: 10 } };
    await simRequest(cfg);

    const called = client.mock.calls[0][0];
    expect(called.url).toBe(cfg.url);
    expect(called.method).toBe(cfg.method);
    expect(called.baseURL).toBe(cfg.baseURL);
    expect(called.params).toEqual(cfg.params);
  });

  it("merges caller headers with the Bearer token", async () => {
    client.mockResolvedValue({ data: {} });
    await simRequest({ url: "x", method: "POST", baseURL: BASE, headers: { "X-Custom": "val" } });

    const cfg = client.mock.calls[0][0];
    expect(cfg.headers?.["X-Custom"]).toBe("val");
    expect(cfg.headers?.Authorization).toBe("Bearer oms-token-xyz");
  });
});
