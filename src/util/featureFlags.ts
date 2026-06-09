// src/util/featureFlags.ts
// Deploy-time feature flags read from VITE_* env. Pure + env-injectable so it runs under `npx tsx`
// (mirrors simApiBaseUrl() in SimulationService.ts).

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
