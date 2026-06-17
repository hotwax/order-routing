// src/util/simConfig.ts
// Pure env-resolver functions for both Moqui instances and the Mastra AI server.
// No side effects — injectable env for headless testing.

/** Base URL for the Mastra AI server (circuit backend). */
export function mastraUrl(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_MASTRA_URL) || "").trim().replace(/\/$/, "");
}

/** Product store id scoping simulation routing-group + reference-data queries. */
export function simProductStoreId(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_PRODUCT_STORE_ID) || "").trim();
}

/** REST root of the dedicated simulation Moqui, or "" when unset. */
export function simBaseURL(env: Record<string, any> = import.meta.env): string {
  return ((env && env.VITE_SIM_URL) || "").trim();
}

/** Base URL shared by all simulation REST APIs: {VITE_SIM_URL}/rest/s1/ */
export function simApiBaseUrl(env: Record<string, any> = import.meta.env): string {
  return simBaseURL(env).replace(/\/+$/, "") + "/rest/s1/";
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
