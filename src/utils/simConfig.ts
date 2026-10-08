// Pure deployment-config resolvers. Simulation uses the authenticated Main OMS facade;
// only the optional assistant needs a browser-visible service URL.

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

/** Simulation is exposed only when this app deployment opts in. Main OMS owns remote auth. */
export function simulationConfigError(env: Env = import.meta.env): string | null {
  if (!isExplicitlyEnabled(env?.VITE_SIMULATION_ENABLED)) {
    return "VITE_SIMULATION_ENABLED must be set to true.";
  }
  return null;
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
