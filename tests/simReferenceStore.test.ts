// tests/simReferenceStore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const simApi = vi.fn();
vi.mock("@common", () => ({
  commonUtil: {
    hasError: (resp: any) => resp?._error === true,
  },
  logger: { error: () => {}, warn: () => {} },
}));
vi.mock("@/services/SimApiService", () => ({ simApi: (...a: any[]) => simApi(...a) }));

// Relative import for the SUT (matches the repo's existing vitest store-test pattern).
import { useSimReferenceStore } from "../src/store/simReferenceStore";

// Representative per-endpoint responses, dispatched by request url.
function wireApi() {
  simApi.mockImplementation((config: any) => {
    const url: string = config.url;
    if (url === "order-routing/facilities") {
      return Promise.resolve({ data: [
        { facilityId: "F1", parentTypeId: "VIRTUAL_FACILITY", facilityName: "Virtual" },
        { facilityId: "F2", parentTypeId: "WAREHOUSE", facilityName: "Warehouse" },
      ] });
    }
    if (url.endsWith("/shippingMethods")) {
      return Promise.resolve({ data: [{ shipmentMethodTypeId: "SM1", description: "Ground" }] });
    }
    if (url.endsWith("/facilityGroups")) {
      return Promise.resolve({ data: [{ facilityGroupId: "FG1", facilityGroupName: "Group One" }] });
    }
    if (url === "order-routing/omsenums") {
      return Promise.resolve({ data: [
        { enumId: "WEB", enumTypeId: "ORDER_SALES_CHANNEL", description: "Web" },
        { enumId: "POS", enumTypeId: "ORDER_SALES_CHANNEL", description: "POS" },
      ] });
    }
    return Promise.resolve({ data: [] });
  });
}

describe("simReferenceStore", () => {
  beforeEach(() => { setActivePinia(createPinia()); simApi.mockReset(); wireApi(); });

  it("fetches every reference slice from the sim Moqui, never the OMS default", async () => {
    const s = useSimReferenceStore();
    await s.fetchReferenceData({ productStoreId: "STORE" });

    expect(simApi).toHaveBeenCalledTimes(4);

    // Sales channels keyed by enumId (what the editor's <ion-select> iterates).
    expect(s.getSalesChannels).toEqual({
      WEB: { enumId: "WEB", enumTypeId: "ORDER_SALES_CHANNEL", description: "Web" },
      POS: { enumId: "POS", enumTypeId: "ORDER_SALES_CHANNEL", description: "POS" },
    });
    // Facilities keyed by id; virtual getter filters to VIRTUAL_FACILITY.
    expect(Object.keys(s.getVirtualFacilities)).toEqual(["F1"]);
    expect(s.getShippingMethods.SM1.description).toBe("Ground");
    expect(s.getFacilityGroups.FG1.facilityGroupName).toBe("Group One");
  });

  it("scopes the omsenums request to ORDER_SALES_CHANNEL + the product store", async () => {
    const s = useSimReferenceStore();
    await s.fetchReferenceData({ productStoreId: "STORE" });
    const enumsCall = simApi.mock.calls.find((c) => c[0].url === "order-routing/omsenums");
    expect(enumsCall?.[0].params).toMatchObject({ enumTypeId: "ORDER_SALES_CHANNEL", productStoreId: "STORE" });
  });

  it("caches by productStoreId: skips a redundant refetch, refetches on force or a changed store", async () => {
    const s = useSimReferenceStore();
    await s.fetchReferenceData({ productStoreId: "STORE" });
    expect(simApi).toHaveBeenCalledTimes(4);

    // Same store, already loaded -> no new requests.
    await s.fetchReferenceData({ productStoreId: "STORE" });
    expect(simApi).toHaveBeenCalledTimes(4);

    // force -> refetch.
    await s.fetchReferenceData({ productStoreId: "STORE", force: true });
    expect(simApi).toHaveBeenCalledTimes(8);

    // Different store -> refetch.
    await s.fetchReferenceData({ productStoreId: "OTHER" });
    expect(simApi).toHaveBeenCalledTimes(12);
  });

  it("does NOT cache a partial failure: a failed slice leaves the store eligible for refetch", async () => {
    const s = useSimReferenceStore();
    // Facilities succeed but shipping methods reject (transient outage).
    simApi.mockImplementation((config: any) => {
      if (config.url.endsWith("/shippingMethods")) return Promise.reject(new Error("503"));
      if (config.url === "order-routing/facilities") {
        return Promise.resolve({ data: [{ facilityId: "F1", parentTypeId: "VIRTUAL_FACILITY" }] });
      }
      return Promise.resolve({ data: [] });
    });
    await s.fetchReferenceData({ productStoreId: "STORE" });
    expect(s.facilities).toEqual({});
    expect(s.getShippingMethods).toEqual({});
    expect(s.loadState).toBe("error");

    // Next visit retries instead of serving the broken cache.
    simApi.mockClear();
    wireApi();
    await s.fetchReferenceData({ productStoreId: "STORE" });
    expect(simApi).toHaveBeenCalledTimes(4);
    expect(s.getShippingMethods.SM1.description).toBe("Ground");
  });

  it("fails closed without issuing any unscoped request when productStoreId is missing", async () => {
    const s = useSimReferenceStore();
    await expect(s.fetchReferenceData({ productStoreId: "" })).resolves.toBe(false);
    expect(simApi).not.toHaveBeenCalled();
    expect(s.loadState).toBe("error");
  });

  it("ignores an older store load that resolves after a newer one", async () => {
    const s = useSimReferenceStore();
    let resolveOld!: (value: any) => void;
    const oldFacilities = new Promise((resolve) => { resolveOld = resolve; });
    let facilityCall = 0;
    simApi.mockImplementation((config: any) => {
      if (config.url === "order-routing/facilities") {
        facilityCall += 1;
        if (facilityCall === 1) return oldFacilities;
        return Promise.resolve({ data: [{ facilityId: "NEW_F", parentTypeId: "VIRTUAL_FACILITY" }] });
      }
      return Promise.resolve({ data: [] });
    });

    const oldLoad = s.fetchReferenceData({ productStoreId: "OLD" });
    const newLoad = s.fetchReferenceData({ productStoreId: "NEW" });
    await newLoad;
    resolveOld({ data: [{ facilityId: "OLD_F", parentTypeId: "VIRTUAL_FACILITY" }] });
    await oldLoad;

    expect(s.productStoreId).toBe("NEW");
    expect(Object.keys(s.facilities)).toEqual(["NEW_F"]);
  });
});
