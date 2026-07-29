/** Return the only unexpired session identifier that authorizes a Test Drive mutation. */
export function verifiedTestDriveSessionId(session: unknown, now = Date.now()): string {
  if (!session || typeof session !== "object" || Array.isArray(session)) return "";
  const candidate = session as Record<string, unknown>;
  const thruDate = candidate.thruDate == null ? null : Number(candidate.thruDate);
  if (thruDate !== null && Number.isFinite(thruDate) && thruDate <= now) return "";
  const value = String(candidate.userSessionId ?? "").trim();
  return value;
}

export function hasVerifiedTestDriveSession(session: unknown, now = Date.now()): boolean {
  return Boolean(verifiedTestDriveSessionId(session, now));
}
