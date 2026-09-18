import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACTION_ENUMS,
  parseRoutingEditorEnvJson,
  parseRoutingStringRecordEnvJson
} from "../src/utils/routingEditorEnv";

describe("routing editor enum environment parsing", () => {
  it.each([undefined, "", "{", "null", "[]", '"value"'])(
    "returns complete defaults for an unusable value (%s)",
    (value) => {
      const parsed = parseRoutingEditorEnvJson(value, DEFAULT_ACTION_ENUMS);
      expect(parsed).toEqual(DEFAULT_ACTION_ENUMS);
      expect(parsed).not.toBe(DEFAULT_ACTION_ENUMS);
    }
  );

  it("merges a partial valid override without dropping required defaults", () => {
    const parsed = parseRoutingEditorEnvJson(
      '{"NEXT_RULE":{"id":"CUSTOM_NEXT"}}',
      DEFAULT_ACTION_ENUMS
    );

    expect(parsed.NEXT_RULE).toEqual({ id: "CUSTOM_NEXT", code: "NEXT_RULE" });
    expect(parsed.MOVE_TO_QUEUE).toEqual(DEFAULT_ACTION_ENUMS.MOVE_TO_QUEUE);
  });

  it("ignores malformed entries while accepting complete custom entries", () => {
    const parsed = parseRoutingEditorEnvJson(
      '{"NEXT_RULE":null,"BROKEN":{"id":""},"CUSTOM":{"id":"CUSTOM_ID","code":"CUSTOM_CODE"}}',
      DEFAULT_ACTION_ENUMS
    );

    expect(parsed.NEXT_RULE).toEqual(DEFAULT_ACTION_ENUMS.NEXT_RULE);
    expect(parsed).not.toHaveProperty("BROKEN");
    expect(parsed.CUSTOM).toEqual({ id: "CUSTOM_ID", code: "CUSTOM_CODE" });
  });

  it("fails malformed cron-expression maps closed without crashing setup", () => {
    expect(parseRoutingStringRecordEnvJson("{")).toEqual({});
    expect(parseRoutingStringRecordEnvJson('["not-a-map"]')).toEqual({});
    expect(parseRoutingStringRecordEnvJson('{"Hourly":"0 0 * ? * *","Broken":42}')).toEqual({
      Hourly: "0 0 * ? * *"
    });
  });
});
