// Pure deployment-config resolvers for the simulation and assistant backends.
// Every optional backend is fail closed: callers must opt in explicitly and provide a
// transport-safe URL before a request can be constructed.

type Env = Record<string, any>;

const isExplicitlyEnabled = (value: unknown): boolean =>
  String(value ?? "").trim().toLowerCase() === "true";

const isLoopbackHost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

function validatedServiceOrigin(raw: unknown, settingName: string): string {
  const configured = String(raw ?? "").trim().replace(/\/+$/, "");
  if (!configured) throw new Error(`${settingName} is not configured.`);

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(`${settingName} must be an absolute HTTP(S) origin.`);
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) {
    throw new Error(`${settingName} must be a bare origin without credentials, a path, query, or fragment.`);
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopbackHost(parsed.hostname))) {
    throw new Error(`${settingName} must use HTTPS (HTTP is allowed only for loopback development).`);
  }

  return parsed.origin;
}

/** The assistant is opt-in and must point at an explicitly configured HTTPS service. */
export function draftAssistantConfigError(env: Env = import.meta.env): string | null {
  if (!isExplicitlyEnabled(env?.VITE_DRAFT_ASSISTANT_ENABLED)) {
    return "VITE_DRAFT_ASSISTANT_ENABLED must be set to true.";
  }
  try {
    validatedServiceOrigin(env?.VITE_MASTRA_URL, "VITE_MASTRA_URL");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "VITE_MASTRA_URL is invalid.";
  }
}

export function isDraftAssistantEnabled(env: Env = import.meta.env): boolean {
  return draftAssistantConfigError(env) === null;
}

export function requireDraftAssistantUrl(env: Env = import.meta.env): string {
  const error = draftAssistantConfigError(env);
  if (error) throw new Error(`Draft assistant is unavailable: ${error}`);
  return validatedServiceOrigin(env?.VITE_MASTRA_URL, "VITE_MASTRA_URL");
}

/**
 * Test Drive performs live OMS allocation/reset mutations. Keep it unavailable until deployment
 * owners explicitly attest that the backend enforces authentication, permission, session type,
 * user/store ownership, and session expiry for both run and reset endpoints.
 */
export function testDriveConfigError(env: Env = import.meta.env): string | null {
  if (!isExplicitlyEnabled(env?.VITE_TEST_DRIVE_ENABLED)) {
    return "VITE_TEST_DRIVE_ENABLED must be set to true.";
  }
  if (!isExplicitlyEnabled(env?.VITE_TEST_DRIVE_BACKEND_AUTH_VERIFIED)) {
    return "VITE_TEST_DRIVE_BACKEND_AUTH_VERIFIED must be set to true after the backend mutation contract is secured and verified.";
  }
  return null;
}

export function isTestDriveEnabled(env: Env = import.meta.env): boolean {
  return testDriveConfigError(env) === null;
}

/** Product store id scoping simulation routing-group + reference-data queries. */
export function simProductStoreId(env: Env = import.meta.env): string {
  return ((env && env.VITE_SIM_PRODUCT_STORE_ID) || "").trim();
}

/** Explain why simulation cannot be enabled for this deployment. */
export function simulationConfigError(env: Env = import.meta.env): string | null {
  if (!isExplicitlyEnabled(env?.VITE_SIMULATION_ENABLED)) {
    return "VITE_SIMULATION_ENABLED must be set to true.";
  }
  if (!isExplicitlyEnabled(env?.VITE_SIM_ALLOW_OMS_BEARER)) {
    return "VITE_SIM_ALLOW_OMS_BEARER must be set to true after verifying that the configured simulation origin accepts the OMS JWT.";
  }
  try {
    validatedServiceOrigin(env?.VITE_SIM_URL, "VITE_SIM_URL");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "VITE_SIM_URL is invalid.";
  }
}

/** Bare origin of the explicitly trusted simulation Moqui. Throws before any request when disabled. */
export function simBaseURL(env: Env = import.meta.env): string {
  const error = simulationConfigError(env);
  if (error) throw new Error(`Simulation is unavailable: ${error}`);
  return validatedServiceOrigin(env?.VITE_SIM_URL, "VITE_SIM_URL");
}

/** Base URL shared by all simulation REST APIs: {VITE_SIM_URL}/rest/s1/ */
export function simApiBaseUrl(env: Env = import.meta.env): string {
  return `${simBaseURL(env)}/rest/s1/`;
}

/** Whether the brokering Simulation tab/feature is safe to expose for this deployment. */
export function isSimulationEnabled(env: Env = import.meta.env): boolean {
  return simulationConfigError(env) === null;
}

/** Map a route's `meta.featureFlag` name to its enablement. Unknown flags fail closed. */
export function isFeatureEnabled(flag: string, env: Env = import.meta.env): boolean {
  switch (flag) {
    case "simulation": return isSimulationEnabled(env);
    case "draftAssistant": return isDraftAssistantEnabled(env);
    case "testDrive": return isTestDriveEnabled(env);
    default: return false;
  }
}

/**
 * Circuit and Simulation are temporary developer-only surfaces. Developer mode is an additional
 * visibility gate; it never bypasses the complete backend configuration and auth checks above.
 */
export function isDeveloperFeatureEnabled(
  flag: string,
  devModeEnabled: boolean,
  env: Env = import.meta.env
): boolean {
  if (flag === "draftAssistant" || flag === "simulation") {
    return Boolean(devModeEnabled) && isFeatureEnabled(flag, env);
  }
  return isFeatureEnabled(flag, env);
}
