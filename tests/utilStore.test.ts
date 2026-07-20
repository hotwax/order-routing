import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();

vi.mock("@common", () => ({
  api: (...args: any[]) => api(...args),
  commonUtil: { hasError: () => false },
  logger: { error: vi.fn() },
}));

vi.mock("../src/store/orderRoutingStore", () => ({
  orderRoutingStore: () => ({ currentGroup: {} }),
}));

vi.mock("../src/store/productStore", () => ({
  productStore: () => ({ getCurrentEComStore: null }),
}));

import { ROUTING_EDITOR_ENUM_TYPE_IDS, useUtilStore } from "../src/store/utilStore";
import {
  DEMO_CPCM_FILTER_ENUM,
  DEMO_CPCM_SORT_ENUM
} from "../src/utils/demoCarrierPostalCodeMapping";

describe("utilStore user testing sessions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("GETs the canonical sessions endpoint and returns the first active session", async () => {
    const now = Date.now();
    api.mockResolvedValue({
      data: [
        { userSessionId: "EXPIRED", thruDate: now - 1 },
        { userSessionId: "ACTIVE", thruDate: now + 60_000 },
        { userSessionId: "OPEN" },
      ],
    });

    const payload = { routingGroupId: "GROUP-1", userId: "demo" };
    await expect(useUtilStore().getUserSession(payload)).resolves.toEqual({
      userSessionId: "ACTIVE",
      thruDate: now + 60_000,
    });

    expect(api).toHaveBeenCalledWith({
      url: "admin/user/sessions",
      method: "GET",
      params: payload,
    });
  });

  it("filters expired rows while retaining future and open-ended sessions", async () => {
    const now = Date.now();
    api.mockResolvedValue({
      data: [
        { userSessionId: "EXPIRED", thruDate: now },
        { userSessionId: "FUTURE", thruDate: now + 1 },
        { userSessionId: "OPEN", thruDate: null },
      ],
    });

    await expect(useUtilStore().getTestSessions({ routingGroupId: "GROUP-1" }))
      .resolves.toEqual([
        { userSessionId: "FUTURE", thruDate: now + 1 },
        { userSessionId: "OPEN", thruDate: null },
      ]);
  });

  it("POSTs to the canonical endpoint and exposes the flat userSessionId", async () => {
    api.mockResolvedValue({ data: { userSessionId: "SESSION-1", ignored: "server metadata" } });
    const payload = { routingGroupId: "GROUP-1", userId: "demo" };

    await expect(useUtilStore().createUserSession(payload))
      .resolves.toEqual({ userSessionId: "SESSION-1" });

    expect(api).toHaveBeenCalledWith({
      url: "admin/user/sessions",
      method: "POST",
      data: payload,
    });
  });

  it("loads every routing editor enum family through the migrated admin contract", async () => {
    api.mockImplementation(async ({ params }: any) => ({
      data: [{
        enumId: `${params.enumTypeId}_VALUE`,
        enumTypeId: params.enumTypeId,
        enumCode: `${params.enumTypeId.toLowerCase()}_value`,
        description: params.enumTypeId,
      }],
    }));

    const util = useUtilStore();
    await util.fetchRoutingEditorEnums();

    expect(api).toHaveBeenCalledTimes(ROUTING_EDITOR_ENUM_TYPE_IDS.length);
    expect(api.mock.calls.map(([request]) => request.params.enumTypeId))
      .toEqual([...ROUTING_EDITOR_ENUM_TYPE_IDS]);
    for (const enumTypeId of ROUTING_EDITOR_ENUM_TYPE_IDS) {
      expect(util.enums[enumTypeId]).toBeTruthy();
    }
    expect(util.enums.INV_FILTER_PRM_TYPE[DEMO_CPCM_FILTER_ENUM.enumId]).toEqual(DEMO_CPCM_FILTER_ENUM);
    expect(util.enums.INV_SORT_PARAM_TYPE[DEMO_CPCM_SORT_ENUM.enumId]).toEqual(DEMO_CPCM_SORT_ENUM);
  });

  it("never exposes routing status system IDs as display labels", () => {
    const util = useUtilStore();

    expect(util.getStatusDesc("ROUTING_ACTIVE")).toBe("Active");
    expect(util.getStatusDesc("ROUTING_DRAFT")).toBe("Draft");
    expect(util.getStatusDesc("CUSTOM_REVIEW_STATUS")).toBe("Custom Review Status");

    util.statuses.ROUTING_ACTIVE = { description: "Enabled" };
    expect(util.getStatusDesc("ROUTING_ACTIVE")).toBe("Enabled");
  });
});
