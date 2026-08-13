import { describe, expect, it } from "vitest";
import { commonUtil } from "@common/utils/commonUtil";
import { isCronExpressionValid } from "@/utils/cronValidation";

// Deliberately unmocked: the defect this guards against was an assumption about how the real
// commonUtil helpers behave, so mocking them here would test nothing.
describe("commonUtil cron contract", () => {
  it("getCronString reports failure by returning empty, never by throwing", () => {
    expect(() => commonUtil.getCronString("this is not a cron")).not.toThrow();
    expect(commonUtil.getCronString("this is not a cron")).toBe("");
    expect(commonUtil.getCronString("99 99 99 ? * *")).toBe("");
  });

  it("parseCronExpression throws for an unparseable expression", () => {
    expect(() => commonUtil.parseCronExpression("this is not a cron", "UTC")).toThrow();
    expect(() => commonUtil.parseCronExpression("99 99 99 ? * *", "UTC")).toThrow();
    expect(() => commonUtil.parseCronExpression("0 0 * ? * *", "UTC")).not.toThrow();
  });
});

describe("isCronExpressionValid", () => {
  it("rejects expressions that cannot be parsed", () => {
    expect(isCronExpressionValid("this is not a cron", "UTC")).toBe(false);
    expect(isCronExpressionValid("99 99 99 ? * *", "UTC")).toBe(false);
  });

  it("rejects an expression that parses but has no description", () => {
    // cron-parser accepts the 5-field form, cronstrue cannot describe it, and a schedule the UI
    // cannot render back to the user must not be saveable.
    expect(commonUtil.getCronString("* * * *")).toBe("");
    expect(isCronExpressionValid("* * * *", "UTC")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isCronExpressionValid("", "UTC")).toBe(false);
    expect(isCronExpressionValid(undefined as any, "UTC")).toBe(false);
  });

  it("accepts the Quartz expressions the schedule options offer", () => {
    expect(isCronExpressionValid("0 0 * ? * *", "UTC")).toBe(true);
    expect(isCronExpressionValid("0 */15 * ? * *", "UTC")).toBe(true);
    expect(isCronExpressionValid("0 0 0 * * ?", "UTC")).toBe(true);
  });

  it("works without an explicit time zone", () => {
    expect(isCronExpressionValid("0 0 * ? * *")).toBe(true);
    expect(isCronExpressionValid("this is not a cron")).toBe(false);
  });
});
