import { describe, expect, it } from "vitest";
import { DEFAULT_ACTION_ENUMS, parseRoutingEditorEnvJson } from "../src/utils/routingEditorEnv";

describe("routing editor env helpers", () => {
  it("uses fallback enum config when an env value is missing", () => {
    expect(parseRoutingEditorEnvJson(undefined, DEFAULT_ACTION_ENUMS).NEXT_RULE.id).toBe("ORA_NEXT_RULE");
  });

  it("uses fallback enum config when an env value is malformed", () => {
    expect(parseRoutingEditorEnvJson("{", DEFAULT_ACTION_ENUMS).MOVE_TO_QUEUE.id).toBe("ORA_MV_TO_QUEUE");
  });

  it("uses provided enum config when the env value is valid JSON", () => {
    const parsed = parseRoutingEditorEnvJson('{"NEXT_RULE":{"id":"CUSTOM_NEXT","code":"NEXT_RULE"}}', DEFAULT_ACTION_ENUMS);

    expect(parsed.NEXT_RULE.id).toBe("CUSTOM_NEXT");
  });
});
