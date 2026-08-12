import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@common";
import { useAtpProductStore } from "@/store/atpProductStore";
import { useInventoryUpdatesStore } from "@/store/inventoryUpdates";

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn((response: any) => Boolean(response?.error || response?.data?._ERROR_MESSAGE_)),
    getCronString: vi.fn((expression: string) => expression ? "Every hour" : "")
  },
  logger: { error: vi.fn() }
}));

vi.mock("@/store/userStore", () => ({
  useUserStore: vi.fn(() => ({}))
}));

const mockedApi = vi.mocked(api);

describe("inventory update monitoring store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
    useAtpProductStore().$patch({ currentProductStore: { productStoreId: "STORE" } });
  });

  it("derives jobs only from current-store ATP inventory rule groups", async () => {
    mockedApi.mockImplementation(async (request: any) => {
      if (request.url === "available-to-promise/ruleGroups") {
        return {
          data: [
            { ruleGroupId: "M100052", groupTypeEnumId: "RG_THRESHOLD", jobName: "ATP_Rule_Group_M100052" },
            { ruleGroupId: "M100102", groupTypeEnumId: "RG_NS_ORDER_PUSH", jobName: "NOT_AN_ATP_UPDATE" }
          ]
        };
      }
      if (request.url === "available-to-promise/ruleGroups/M100052/schedule") {
        return { data: { schedule: { paused: "N", cronExpression: "0 0 * ? * *" } } };
      }
      if (request.url === "admin/serviceJobs/ATP_Rule_Group_M100052/runs") {
        return { data: [{ jobRunId: "RUN", startTime: 10 }] };
      }
      return { data: [] };
    });

    const store = useInventoryUpdatesStore();
    await store.fetchSchedules();

    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "available-to-promise/ruleGroups",
      params: expect.objectContaining({ productStoreId: "STORE", statusId: "ATP_RG_ACTIVE" })
    }));
    expect(mockedApi).not.toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("NOT_AN_ATP_UPDATE") }));
    expect(store.schedules).toEqual([expect.objectContaining({
      ruleGroupId: "M100052",
      groupName: "Threshold inventory update",
      jobName: "ATP_Rule_Group_M100052",
      cronDescription: "Every hour"
    })]);
    expect(store.stats.activeRuns).toBe(1);
  });

  it("uses the existing rule-group schedule and run-now APIs for management", async () => {
    mockedApi.mockResolvedValue({ data: { schedule: { paused: "N" }, jobRunId: "RUN" } });
    const store = useInventoryUpdatesStore();

    await store.updateSchedule({ ruleGroupId: "M100052", paused: "N", cronExpression: "0 0 * ? * *" });
    await store.runNow("M100052");

    expect(mockedApi).toHaveBeenNthCalledWith(1, {
      url: "available-to-promise/ruleGroups/M100052/schedule",
      method: "POST",
      data: { ruleGroupId: "M100052", paused: "N", cronExpression: "0 0 * ? * *" }
    });
    expect(mockedApi).toHaveBeenNthCalledWith(2, {
      url: "available-to-promise/ruleGroups/M100052/runNow",
      method: "POST"
    });
  });
});
