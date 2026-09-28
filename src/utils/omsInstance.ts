import { commonUtil } from "@common";

// Identity of the OMS instance the app is currently linked to, derived from the same
// cookie-backed source the api layer resolves its base URL from. The full URL (not just
// the instance name) is used so local instances differing only by port don't collide.
export function getOmsInstanceKey(): string {
  return (commonUtil.getOmsURL() || "").trim().toLowerCase();
}

// Persisted product-store caches are only trustworthy on the instance they were fetched
// from. A cache holding data without a recorded key predates instance stamping and cannot
// be attributed to the connected instance, so it is treated as stale too. With no connected
// instance (no oms cookie) there is nothing to compare against — the login flow revalidates.
export function isInstanceScopeStale(recordedKey: string | undefined, hasData: boolean): boolean {
  const currentKey = getOmsInstanceKey();
  if (!currentKey || !hasData) return false;
  return recordedKey !== currentKey;
}
