import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const api = vi.fn();
vi.mock("@common", () => ({
  api: (...args: any[]) => api(...args),
  commonUtil: { hasError: (resp: any) => resp?._error === true },
  logger: { error: () => {}, warn: () => {} },
}));

import { useSimReferenceStore } from "../src/store/simReferenceStore";

function references(facilityId = "F1") {
  return { data: {
    facilities: [
      { facilityId, parentTypeId: "VIRTUAL_FACILITY", facilityName: "Virtual" },
      { facilityId: "F2", parentTypeId: "WAREHOUSE", facilityName: "Warehouse" },
    ],
    shippingMethods: [{ shipmentMethodTypeId: "SM1", description: "Ground" }],
    facilityGroups: [{ facilityGroupId: "FG1", facilityGroupName: "Group One" }],
    salesChannels: [
      { enumId: "WEB", enumTypeId: "ORDER_SALES_CHANNEL", description: "Web" },
      { enumId: "POS", enumTypeId: "ORDER_SALES_CHANNEL", description: "POS" },
    ],
  } };
}

describe("simReferenceStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.mockReset();
    api.mockResolvedValue(references());
  });

  it("loads every reference slice through one scoped Main OMS facade request", async () => {
    const store = useSimReferenceStore();
    expect(await store.fetchReferenceData({ productStoreId: "STORE" })).toBe(true);

    expect(api).toHaveBeenCalledOnce();
    expect(api).toHaveBeenCalledWith({
      url: "order-routing/simulation/references/STORE", method: "GET", signal: expect.any(AbortSignal),
    });
    expect(store.getSalesChannels.WEB.description).toBe("Web");
    expect(Object.keys(store.getVirtualFacilities)).toEqual(["F1"]);
    expect(store.getShippingMethods.SM1.description).toBe("Ground");
    expect(store.getFacilityGroups.FG1.facilityGroupName).toBe("Group One");
  });

  it("caches complete data by store and refetches when forced or the store changes", async () => {
    const store = useSimReferenceStore();
    await store.fetchReferenceData({ productStoreId: "STORE" });
    await store.fetchReferenceData({ productStoreId: "STORE" });
    expect(api).toHaveBeenCalledOnce();

    await store.fetchReferenceData({ productStoreId: "STORE", force: true });
    await store.fetchReferenceData({ productStoreId: "OTHER" });
    expect(api).toHaveBeenCalledTimes(3);
    expect(api.mock.calls[2][0].url).toBe("order-routing/simulation/references/OTHER");
  });

  it("caches a complete response even when the store has no facilities", async () => {
    const store = useSimReferenceStore();
    api.mockResolvedValue({ data: { ...references().data, facilities: [] } });
    await store.fetchReferenceData({ productStoreId: "EMPTY" });
    await store.fetchReferenceData({ productStoreId: "EMPTY" });
    expect(store.loadState).toBe("ready");
    expect(api).toHaveBeenCalledOnce();
  });

  it("does not cache an incomplete response and retries on the next visit", async () => {
    const store = useSimReferenceStore();
    api.mockResolvedValueOnce({ data: { facilities: [] } });
    expect(await store.fetchReferenceData({ productStoreId: "STORE" })).toBe(false);
    expect(store.facilities).toEqual({});
    expect(store.loadState).toBe("error");

    expect(await store.fetchReferenceData({ productStoreId: "STORE" })).toBe(true);
    expect(api).toHaveBeenCalledTimes(2);
    expect(store.getShippingMethods.SM1.description).toBe("Ground");
  });

  it("rejects a missing store without issuing an unscoped request", async () => {
    const store = useSimReferenceStore();
    expect(await store.fetchReferenceData({ productStoreId: "" })).toBe(false);
    expect(api).not.toHaveBeenCalled();
    expect(store.loadState).toBe("error");
  });

  it("ignores an older store load that resolves after a newer one", async () => {
    const store = useSimReferenceStore();
    let resolveOld!: (value: any) => void;
    const oldRequest = new Promise((resolve) => { resolveOld = resolve; });
    api.mockImplementationOnce(() => oldRequest);
    api.mockResolvedValueOnce(references("NEW_F"));

    const oldLoad = store.fetchReferenceData({ productStoreId: "OLD" });
    const newLoad = store.fetchReferenceData({ productStoreId: "NEW" });
    expect(await newLoad).toBe(true);
    resolveOld(references("OLD_F"));
    expect(await oldLoad).toBe(false);

    expect(store.productStoreId).toBe("NEW");
    expect(Object.keys(store.facilities)).toContain("NEW_F");
    expect(Object.keys(store.facilities)).not.toContain("OLD_F");
  });
});
