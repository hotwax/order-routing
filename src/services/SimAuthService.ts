import { simApiName, simBaseURL } from "./SimulationService";

/** The simulation Moqui (:8075) has its OWN auth, separate from the OMS Moqui (:8085): you log in
 *  with username/password and authenticate subsequent calls with an `api_key` header (the OMS Bearer
 *  token is NOT accepted there). The OMS login flow is shared across apps and never hands the password
 *  to this app, so the sim credentials come from env. Local two-instance dev only — when VITE_SIM_URL
 *  is blank the app is single-instance and this module is never used. */
export function simCreds(env: Record<string, any> = import.meta.env): { username: string; password: string } {
  return {
    username: ((env && env.VITE_SIM_USERNAME) || "").trim(),
    password: (env && env.VITE_SIM_PASSWORD) || "",
  };
}

/** Login path on the sim instance, component-relative (joined to simBaseURL() by the api client).
 *  Tracks VITE_SIM_API_NAME so order-routing/ai-routing stay in sync. `admin/login` is the newer alias. */
export function simLoginUrl(): string {
  return `${simApiName()}/login`;
}

interface SimSession {
  apiKey: string;
  /** epoch ms when the api_key expires (from the login response); undefined => no known expiry. */
  expirationTime?: number;
}

let session: SimSession | null = null;
let inFlight: Promise<string> | null = null;

/** Refresh slightly early so a call doesn't race the key's expiry on the wire. */
const EXPIRY_SKEW_MS = 60_000;

/** Pure: is this session at/over its refresh threshold? Exposed for testing. */
export function isSessionExpired(s: SimSession | null, now: number): boolean {
  if (!s) return true;
  if (!s.expirationTime) return false;
  return now > s.expirationTime - EXPIRY_SKEW_MS;
}

/** Log into the simulation Moqui and cache the api_key. Uses the interceptor-free client() so the
 *  shared axios request interceptor (which force-attaches the OMS Bearer token and gates on OMS
 *  auth) never touches this separate-auth instance. Throws if not configured or on bad credentials. */
export async function simLogin(): Promise<string> {
  const { client, commonUtil, logger } = await import("@common");
  const base = simBaseURL();
  const { username, password } = simCreds();
  if (!base) throw new Error("VITE_SIM_URL is not set — cannot log into the simulation instance.");
  if (!username || !password) {
    throw new Error("VITE_SIM_USERNAME / VITE_SIM_PASSWORD are not set — cannot log into the simulation instance.");
  }
  if (import.meta.env.PROD) {
    // VITE_* vars are compiled into the shipped JS bundle: anyone with the app URL can read these
    // credentials from source. Acceptable for local/demo builds only.
    logger.warn("Sim credentials (VITE_SIM_USERNAME/PASSWORD) are baked into this production bundle and readable by any visitor. Use a server-side auth scheme before a real deployment.");
  }
  const resp: any = await client({
    url: simLoginUrl(),
    method: "POST",
    baseURL: base,
    headers: { "Content-Type": "application/json" },
    data: { username, password },
  });
  if (commonUtil.hasError(resp) || !resp.data?.api_key) {
    throw new Error(`Simulation login failed: ${JSON.stringify(resp?.data ?? resp)?.slice(0, 300)}`);
  }
  // Only trust expirationTime when it is a plausible future epoch-ms timestamp. A TTL/seconds value
  // would make isSessionExpired() permanently true and force a re-login on EVERY poll iteration;
  // treating it as "no known expiry" is safe because the 401 -> clearSimSession -> retry path in
  // simApi() still recovers from real expiry.
  const exp = Number(resp.data.expirationTime);
  session = {
    apiKey: resp.data.api_key,
    expirationTime: Number.isFinite(exp) && exp > Date.now() ? exp : undefined,
  };
  return session.apiKey;
}

/** Return a valid api_key, logging in (once, de-duped across concurrent callers) when missing/expired. */
export async function getSimApiKey(): Promise<string> {
  if (session && !isSessionExpired(session, Date.now())) return session.apiKey;
  if (!inFlight) {
    inFlight = simLogin().finally(() => { inFlight = null; });
  }
  return inFlight;
}

/** Drop the cached session (e.g. after a 401/403 from a sim call) so the next call re-logs in. */
export function clearSimSession(): void {
  session = null;
}
