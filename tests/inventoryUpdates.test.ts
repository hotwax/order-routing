import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  formatRunDuration,
  inventoryUpdateName,
  isActiveJobRun,
  isInventoryRuleGroup,
  RULE_GROUP_TYPE_LABELS
} from "@/utils/inventoryUpdates";

describe("inventory update monitoring helpers", () => {
  it("treats only started, unfinished job runs as active", () => {
    expect(isActiveJobRun({ startTime: 1710000000000 })).toBe(true);
    expect(isActiveJobRun({ startTime: 1710000000000, endTime: 1710000005000 })).toBe(false);
    expect(isActiveJobRun({})).toBe(false);
  });

  it("formats Data Manager file sizes without hiding small files", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.00 MB");
    expect(formatFileSize(null)).toBe("-");
  });

  it("formats completed run duration", () => {
    expect(formatRunDuration(1710000000000, 1710000065000)).toBe("1m 5s");
    expect(formatRunDuration("2026-08-12T10:00:00Z", "2026-08-12T10:00:08Z")).toBe("8s");
    expect(formatRunDuration(1710000000000, 1709999999000)).toBe("-");
  });

  it("uses user-facing ATP rule group labels", () => {
    expect(RULE_GROUP_TYPE_LABELS.RG_THRESHOLD).toBe("Threshold");
    expect(RULE_GROUP_TYPE_LABELS.RG_PICKUP_FACILITY).toBe("Store pickup facility");
  });

  it("only accepts the ATP rule groups that can generate inventory files", () => {
    expect(isInventoryRuleGroup({ groupTypeEnumId: "RG_THRESHOLD" })).toBe(true);
    expect(isInventoryRuleGroup({ groupTypeEnumId: "RG_NS_ORDER_PUSH" })).toBe(false);
  });

  it("uses a functional update name when the backend only supplies a technical id", () => {
    expect(inventoryUpdateName({ ruleGroupId: "M100052", groupTypeEnumId: "RG_THRESHOLD" }))
      .toBe("Threshold inventory update");
    expect(inventoryUpdateName({ ruleGroupId: "M1", groupName: "US threshold", groupTypeEnumId: "RG_THRESHOLD" }))
      .toBe("US threshold");
  });
});
