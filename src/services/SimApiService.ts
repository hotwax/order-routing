import { client, commonUtil } from "@common";
import { simApiBaseUrl } from "@/utils/simConfig";

export type SimRequestConfig = {
  url: string;
  method: string;
  data?: any;
  params?: any;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
};

/**
 * Issue a request to the explicitly trusted simulation origin without attaching the request to
 * AccxUI's global axios interceptors. A 401/403 from the optional simulation backend must stay a
 * simulation error; it must never trigger the OMS-wide logout handler.
 *
 * The base URL is resolved here instead of accepted from callers so the OMS Bearer token cannot be
 * redirected to a different host by a service-level configuration mistake. The interceptor-free
 * client also preserves request options such as timeout and AbortSignal that the shared `api()`
 * wrapper does not currently forward.
 */
export async function simApi(config: SimRequestConfig): Promise<any> {
  const baseURL = simApiBaseUrl();
  const relativeUrl = String(config.url || "");
  const resolvedUrl = new URL(relativeUrl, baseURL);
  const expectedBase = new URL(baseURL);
  const isAbsoluteUrl = /^[a-z][a-z\d+.-]*:/i.test(relativeUrl);
  if (!relativeUrl || isAbsoluteUrl || relativeUrl.startsWith("/") || resolvedUrl.origin !== expectedBase.origin || !resolvedUrl.pathname.startsWith(expectedBase.pathname)) {
    throw new Error("Simulation requests must use a path relative to the configured simulation REST root.");
  }
  const simApiKey = localStorage.getItem("sim_api_key");
  const reqHeaders: Record<string, string> = {
    ...(config.headers || {}),
    "Content-Type": "application/json",
  };
  if (simApiKey && !config.url?.includes("tenant-auth")) {
    reqHeaders["api_key"] = simApiKey;
  }

  return client({
    ...config,
    baseURL,
    headers: reqHeaders,
  });
}

export const SimApiService = { request: simApi };
