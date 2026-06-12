// tests/simReferenceStore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// The sim instance's REST root the store must pin every fetch to.
const SIM_URL = "http://sim.test/rest/s1/";

const api = vi.fn();
vi.mock("@common", () => ({
  api: (...a: any[]) => api(...a),
  commonUtil: { hasError: (resp: any) => resp?._error === true },
  logger: { error: () => {}, warn: () => {} },
}));
// simApi is the authenticated sim-request wrapper (its auth behavior is covered in simApi.test.ts).
// Here we delegate it to the same `api` mock so these tests assert the store's request shape (url /
// baseURL / params) — confirming reference data is pulled from the sim instance.
vi.mock("@/services/SimulationService", () => ({
  simMoquiUrl: () => SIM_URL,
  simApiName: () => "order-routing",
  simApi: (...a: any[]) => api(...a),
}));

// Relative import for the SUT (matches the repo's existing vitest store-test pattern).
import { useSimReferenceStore } from "../src/store/simReferenceStore";

// Representative per-endpoint responses, dispatched by request url.
function wireApi() {
  api.mockImplementation((config: any) => {
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
  beforeEach(() => { setActivePinia(createPinia()); api.mockReset(); wireApi(); });

  it("fetches every reference slice from the sim Moqui, never the OMS default", async () => {
    const s = useSimReferenceStore();
    await s.fetchReferenceData({ productStoreId: "STORE" });

    // Isolation guarantee: every outbound call is pinned to the sim REST root.
    expect(api).toHaveBeenCalledTimes(4);
    for (const call of api.mock.calls) {
      expect(call[0].baseURL).toBe(SIM_URL);
    }

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
    const enumsCall = api.mock.calls.find((c) => c[0].url === "order-routing/omsenums");
    expect(enumsCall?.[0].params).toMatchObject({ enumTypeId: "ORDER_SALES_CHANNEL", productStoreId: "STORE" });
  });

  it("caches by productStoreId: skips a redundant refetch, refetches on force or a changed store", async () => {
    const s = useSimReferenceStore();
    await s.fetchReferenceData({ productStoreId: "STORE" });
    expect(api).toHaveBeenCalledTimes(4);

    // Same store, already loaded -> no new requests.
    await s.fetchReferenceData({ productStoreId: "STORE" });
    expect(api).toHaveBeenCalledTimes(4);

    // force -> refetch.
    await s.fetchReferenceData({ productStoreId: "STORE", force: true });
    expect(api).toHaveBeenCalledTimes(8);

    // Different store -> refetch.
    await s.fetchReferenceData({ productStoreId: "OTHER" });
    expect(api).toHaveBeenCalledTimes(12);
  });

  it("does NOT cache a partial failure: a failed slice leaves the store eligible for refetch", async () => {
    const s = useSimReferenceStore();
    // Facilities succeed but shipping methods reject (transient outage).
    api.mockImplementation((config: any) => {
      if (config.url.endsWith("/shippingMethods")) return Promise.reject(new Error("503"));
      if (config.url === "order-routing/facilities") {
        return Promise.resolve({ data: [{ facilityId: "F1", parentTypeId: "VIRTUAL_FACILITY" }] });
      }
      return Promise.resolve({ data: [] });
    });
    await s.fetchReferenceData({ productStoreId: "STORE" });
    expect(Object.keys(s.facilities)).toEqual(["F1"]); // what loaded is still usable
    expect(s.getShippingMethods).toEqual({});

    // Next visit retries instead of serving the broken cache.
    api.mockClear();
    wireApi();
    await s.fetchReferenceData({ productStoreId: "STORE" });
    expect(api).toHaveBeenCalledTimes(4);
    expect(s.getShippingMethods.SM1.description).toBe("Ground");
  });

  it("skips the store-scoped slices (and warns) when productStoreId is missing", async () => {
    const s = useSimReferenceStore();
    await s.fetchReferenceData({ productStoreId: "" });
    const urls = api.mock.calls.map((c) => c[0].url);
    expect(urls).toContain("order-routing/facilities");
    expect(urls).toContain("order-routing/omsenums");
    expect(urls.some((u: string) => u.includes("/productStores/"))).toBe(false);
  });
});
