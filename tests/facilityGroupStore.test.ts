import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const api = vi.fn();

vi.mock("@common", () => ({
  api: (...args: any[]) => api(...args),
  commonUtil: {
    hasError: (resp: any) => resp?._error === true,
  },
  logger: { error: () => {} },
}));

vi.mock("@/store/atpProductStore", () => ({
  useAtpProductStore: () => ({
    currentProductStore: { productStoreId: "STORE" },
    getProductStores: [],
    fetchUserProductStores: vi.fn(),
  }),
}));

import { useFacilityGroupStore } from "../src/store/facilityGroupStore";

describe("facilityGroupStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.setSystemTime(new Date("2026-06-24T08:00:00Z"));
    api.mockReset();
    api.mockResolvedValue({ data: [] });
  });

  it("sends the active membership fromDate when removing a facility from a group", async () => {
    const store = useFacilityGroupStore();

    await store.removeFacility("DivFacilityGroup", {
      facilityId: "CODEX219_STORE",
      fromDate: 1782281232454,
    });

    expect(api).toHaveBeenNthCalledWith(1, {
      url: "admin/facilityGroups/DivFacilityGroup/facilities/CODEX219_STORE/association",
      method: "POST",
      data: {
        facilityGroupId: "DivFacilityGroup",
        facilityId: "CODEX219_STORE",
        fromDate: 1782281232454,
        thruDate: Date.now(),
      },
    });
  });

  it("passes through an omitted membership fromDate per the current association contract", async () => {
    const store = useFacilityGroupStore();

    await store.removeFacility("DivFacilityGroup", { facilityId: "CODEX219_STORE" });

    // Main intentionally removed the local key guard in 4f47607; the backend owns validation.
    expect(api).toHaveBeenNthCalledWith(1, {
      url: "admin/facilityGroups/DivFacilityGroup/facilities/CODEX219_STORE/association",
      method: "POST",
      data: {
        facilityGroupId: "DivFacilityGroup",
        facilityId: "CODEX219_STORE",
        fromDate: undefined,
        thruDate: Date.now(),
      },
    });
  });
});
