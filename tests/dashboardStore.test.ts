import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAtpProductStore } from "@/store/atpProductStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { api } from "@common";

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn((response: any) => Boolean(response?.error || response?.data?._ERROR_MESSAGE_))
  },
  logger: {
    error: vi.fn()
  }
}));

vi.mock("@/store/userStore", () => ({
  useUserStore: vi.fn(() => ({}))
}));

const mockedApi = vi.mocked(api);

describe("dashboardStore.loadFoundations", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
  });

  it("loads facility groups using the same selected-store brokering scope as the Facility groups page", async () => {
    useAtpProductStore().$patch({ currentProductStore: { productStoreId: "STORE" } });
    mockedApi.mockImplementation(async (request: any) => {
      if (request.url === "admin/productStores/STORE/facilityGroups" && request.params?.facilityGroupTypeId === "BROKERING_GROUP") {
        return {
          data: [
            { facilityGroupId: "BROKERING_1", facilityGroupTypeId: "BROKERING_GROUP" },
            { facilityGroupId: "BROKERING_2", facilityGroupTypeId: "BROKERING_GROUP" }
          ]
        };
      }
      if (request.url === "admin/productStores/STORE/facilityGroups" && request.params?.facilityGroupTypeId === "CHANNEL_FAC_GROUP") {
        return { data: [{ facilityGroupId: "CHANNEL_1" }] };
      }
      if (request.url === "/oms/groupFacilities") {
        return { data: [] };
      }
      return { data: [] };
    });

    await useDashboardStore().loadFoundations();

    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "admin/productStores/STORE/facilityGroups",
      method: "GET",
      params: expect.objectContaining({
        productStoreId: "STORE",
        facilityGroupTypeId: "BROKERING_GROUP",
        pageSize: 200
      })
    }));
    expect(mockedApi).not.toHaveBeenCalledWith(expect.objectContaining({ url: "/oms/facilityGroups" }));
    expect(useDashboardStore().getFoundations).toEqual({
      facilityGroups: 2,
      facilityGroupsByType: { BROKERING_GROUP: 2 },
      channels: 1
    });
  });

  it("leaves foundation metrics empty until a product store is selected", async () => {
    await useDashboardStore().loadFoundations();

    expect(mockedApi).not.toHaveBeenCalled();
    expect(useDashboardStore().getFoundations).toEqual({
      facilityGroups: 0,
      facilityGroupsByType: {},
      channels: 0
    });
  });
});
