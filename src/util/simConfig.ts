// src/util/simConfig.ts
// Pure env-resolver functions for both Moqui instances and the Mastra AI server.
// No side effects — injectable env for headless testing.

/** Base URL for the Mastra AI server (circuit backend). */
export function mastraUrl(env: Record<string, any> = import.meta.env): string {
  const raw = (env && env.VITE_MASTRA_URL) || "http://localhost:4111";
  return raw.replace(/\/$/, "");
}

/** Product store id scoping simulation routing-group + reference-data queries. */
export function simProductStoreId(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_PRODUCT_STORE_ID) || "").trim();
}

/** REST root of the dedicated simulation Moqui, or "" when unset. */
export function simBaseURL(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_URL) || "").trim();
}

/** Base URL for the brokering simulation API (includes `/rest/s1/order-routing` prefix). */
export function simApiBaseUrl(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_API_BASE_URL) || "https://asb-sim-uat.hotwax.io/rest/s1/order-routing").trim();
}

/** Base URL for the sim-routing (variation / what-if) API. */
export function simRoutingApiBaseUrl(env: Record<string, any> = import.meta.env): string {
  const explicit = ((env && env.VITE_SIM_ROUTING_API_BASE_URL) || "").trim();
  if (explicit) return explicit;
  const moqui = simBaseURL(env);
  if (moqui) return moqui.replace(/\/+$/, "") + "/sim-routing";
  return simApiBaseUrl(env).replace(/\/[^/]+\/?$/, "/sim-routing");
}

/** REST root the simulation page uses for routing-group and reference-data calls. */
export function simMoquiUrl(env: Record<string, any> = import.meta.env): string {
  return simBaseURL(env);
}

/** Whether the brokering Simulation tab/feature is shown for this deployment.
 *  Default SHOWN (opt-out): only the literal "false" (case-insensitive, trimmed) hides it. */
export function isSimulationEnabled(env: Record<string, any> = import.meta.env): boolean {
  return String((env && env.VITE_SIMULATION_ENABLED) ?? "true").trim().toLowerCase() !== "false";
}

/** Map a route's `meta.featureFlag` name to its enablement. Unknown flag => visible (fail open). */
export function isFeatureEnabled(flag: string, env: Record<string, any> = import.meta.env): boolean {
  switch (flag) {
    case "simulation": return isSimulationEnabled(env);
    default: return true;
  }
}
