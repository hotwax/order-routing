// tests/simApi.test.ts — behavior of the authenticated sim-request wrapper.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.fn();
const api = vi.fn();
const warn = vi.fn();
vi.mock("@common", () => ({
  client: (...a: any[]) => client(...a),
  api: (...a: any[]) => api(...a),
  commonUtil: { hasError: (r: any) => r?._error === true },
  logger: { warn: (...a: any[]) => warn(...a), error: () => {} },
}));

import { simApi } from "../src/services/SimulationService";
import { clearSimSession } from "../src/services/SimAuthService";

const BASE = "http://localhost:8075/rest/s1/order-routing"; // a caller's own baseURL (jobs use this)
const FAR_FUTURE = 4_102_444_800_000; // year 2100 — never expires during the test
const loginResp = (key: string) => ({ data: { api_key: key, expirationTime: FAR_FUTURE } });

describe("simApi", () => {
  beforeEach(() => {
    client.mockReset();
    api.mockReset();
    clearSimSession();
    vi.stubEnv("VITE_SIM_URL", "http://localhost:8075/rest/s1/");
    vi.stubEnv("VITE_SIM_USERNAME", "hotwax.user");
    vi.stubEnv("VITE_SIM_PASSWORD", "pw");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("two-instance: logs in, sends the api_key via client(), and preserves the caller's baseURL", async () => {
    client.mockImplementation((cfg: any) =>
      cfg.url === "order-routing/login" ? Promise.resolve(loginResp("KEY1")) : Promise.resolve({ data: { ok: true } }));

    const resp = await simApi({ url: "facilities", method: "GET", baseURL: BASE, params: { pageSize: 500 } });
    expect(resp.data.ok).toBe(true);

    // Login goes to the sim Moqui root; never through the OMS Bearer interceptor (api()).
    const loginCall = client.mock.calls.find((c) => c[0].url === "order-routing/login");
    expect(loginCall?.[0].baseURL).toBe("http://localhost:8075/rest/s1/");
    expect(api).not.toHaveBeenCalled();

    // The data request carries the api_key header and keeps the caller's baseURL + url + params.
    const reqCall = client.mock.calls.find((c) => c[0].url === "facilities");
    expect(reqCall?.[0].headers.api_key).toBe("KEY1");
    expect(reqCall?.[0].baseURL).toBe(BASE);
    expect(reqCall?.[0].params).toEqual({ pageSize: 500 });
  });

  it("re-logs in and retries once on a 403 (stale key)", async () => {
    let logins = 0;
    let reqs = 0;
    client.mockImplementation((cfg: any) => {
      if (cfg.url === "order-routing/login") { logins++; return Promise.resolve(loginResp(`KEY${logins}`)); }
      reqs++;
      if (reqs === 1) return Promise.reject({ response: { status: 403 } });
      return Promise.resolve({ data: { ok: true, usedKey: cfg.headers.api_key } });
    });

    const resp = await simApi({ url: "facilities", method: "GET", baseURL: BASE });
    expect(resp.data.ok).toBe(true);
    expect(resp.data.usedKey).toBe("KEY2"); // retried with a freshly-issued key
    expect(logins).toBe(2);
  });

  it("single-instance (VITE_SIM_URL unset): falls back to the shared api() with no api_key", async () => {
    vi.stubEnv("VITE_SIM_URL", "");
    api.mockResolvedValue({ data: { viaApi: true } });

    const resp = await simApi({ url: "facilities", method: "GET", baseURL: BASE });
    expect(resp.data.viaApi).toBe(true);
    expect(api).toHaveBeenCalledTimes(1);
    expect(client).not.toHaveBeenCalled();
  });

  it("warns when the caller's baseURL is on a different host than VITE_SIM_URL (split-brain config)", async () => {
    warn.mockReset();
    client.mockImplementation((cfg: any) =>
      cfg.url === "order-routing/login" ? Promise.resolve(loginResp("KEY1")) : Promise.resolve({ data: { ok: true } }));

    // Same host (the demo setup: jobs under a different component prefix) -> no warning.
    await simApi({ url: "jobs", method: "POST", baseURL: "http://localhost:8075/rest/s1/sim-routing" });
    expect(warn).not.toHaveBeenCalled();

    // Different host (stale VITE_SIM_API_BASE_URL after switching VITE_SIM_URL) -> warn.
    await simApi({ url: "jobs", method: "POST", baseURL: "https://asb-sim-uat.hotwax.io/rest/s1/order-routing" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
