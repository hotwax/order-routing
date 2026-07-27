import { describe, expect, it } from "vitest";
import {
  hasVerifiedTestDriveSession,
  verifiedTestDriveSessionId
} from "../src/utils/testDriveSession";

describe("Test Drive session gate", () => {
  it.each([undefined, null, {}, [], { userSessionId: "" }, { userSessionId: "   " }])(
    "rejects an unverified session (%j)",
    (session) => {
      expect(verifiedTestDriveSessionId(session)).toBe("");
      expect(hasVerifiedTestDriveSession(session)).toBe(false);
    }
  );

  it("accepts and normalizes a concrete backend session id", () => {
    expect(verifiedTestDriveSessionId({ userSessionId: " SESSION-1 " })).toBe("SESSION-1");
    expect(hasVerifiedTestDriveSession({ userSessionId: "SESSION-1" })).toBe(true);
  });

  it("rejects an expired backend session while retaining a future one", () => {
    expect(verifiedTestDriveSessionId({ userSessionId: "OLD", thruDate: 999 }, 1_000)).toBe("");
    expect(verifiedTestDriveSessionId({ userSessionId: "LIVE", thruDate: 1_001 }, 1_000)).toBe("LIVE");
  });
});
