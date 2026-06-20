import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAtpProductStore } from "@/store/atpProductStore";
import { useFacilityGroupStore } from "@/store/facilityGroupStore";
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

describe("facilityGroupStore.archiveGroup", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
    vi.spyOn(Date, "now").mockReturnValue(1781896000000);
  });

  it("expires the selected product store association for the loaded facility group", async () => {
    useAtpProductStore().$patch({ currentProductStore: { productStoreId: "STORE" } });
    const facilityGroupStore = useFacilityGroupStore();
    facilityGroupStore.$patch({
      groups: [
        {
          productStoreId: "STORE",
          facilityGroupId: "FG1",
          fromDate: 1781895000000,
          facilityGroupTypeId: "BROKERING_GROUP"
        }
      ],
      facilitiesByGroup: {
        FG1: [{ facilityId: "FACILITY" }]
      }
    });
    mockedApi.mockResolvedValue({ data: {} });

    await facilityGroupStore.archiveGroup("FG1");

    expect(mockedApi).toHaveBeenCalledWith({
      url: "admin/productStores/STORE/facilityGroups/FG1/association",
      method: "POST",
      data: {
        productStoreId: "STORE",
        facilityGroupId: "FG1",
        fromDate: 1781895000000,
        thruDate: 1781896000000
      }
    });
    expect(mockedApi).not.toHaveBeenCalledWith(expect.objectContaining({ url: "admin/facilityGroups/FG1" }));
    expect(facilityGroupStore.getGroups).toEqual([]);
    expect(facilityGroupStore.getGroupFacilities("FG1")).toEqual([]);
  });

  it("does not remove the group locally when the product store association cannot be identified", async () => {
    useAtpProductStore().$patch({ currentProductStore: { productStoreId: "STORE" } });
    const facilityGroupStore = useFacilityGroupStore();
    facilityGroupStore.$patch({
      groups: [{ facilityGroupId: "FG1", facilityGroupTypeId: "BROKERING_GROUP" }]
    });

    await expect(facilityGroupStore.archiveGroup("FG1")).rejects.toThrow("No active product store association found for facility group.");

    expect(mockedApi).not.toHaveBeenCalled();
    expect(facilityGroupStore.getGroups).toHaveLength(1);
  });

  it("reports when the group is not loaded in local product store state", async () => {
    useAtpProductStore().$patch({ currentProductStore: { productStoreId: "STORE" } });
    const facilityGroupStore = useFacilityGroupStore();

    await expect(facilityGroupStore.archiveGroup("FG1")).rejects.toThrow("Facility group not found in current product store.");

    expect(mockedApi).not.toHaveBeenCalled();
  });
});
