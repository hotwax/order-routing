import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAtpProductStore } from "@/store/atpProductStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { api, useSolrSearch } from "@common";

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: {
    hasError: vi.fn((response: any) => Boolean(response?.error || response?.data?._ERROR_MESSAGE_))
  },
  logger: {
    error: vi.fn()
  },
  useSolrSearch: vi.fn()
}));

vi.mock("@/store/userStore", () => ({
  useUserStore: vi.fn(() => ({}))
}));

vi.mock("@/store/orderRoutingStore", () => ({
  orderRoutingStore: vi.fn(() => ({
    fetchOrderRoutingGroups: vi.fn().mockResolvedValue(true),
    getRoutingGroups: []
  }))
}));

const mockedApi = vi.mocked(api);
const mockedUseSolrSearch = vi.mocked(useSolrSearch);
const mockedRunSolrQuery = vi.fn();

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

describe("dashboardStore.loadRouting", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
    mockedRunSolrQuery.mockReset();
    mockedUseSolrSearch.mockReset();
    mockedUseSolrSearch.mockReturnValue({ runSolrQuery: mockedRunSolrQuery } as ReturnType<typeof useSolrSearch>);
  });

  it("loads the queue summary through the backend-aware Solr adapter", async () => {
    useAtpProductStore().$patch({ currentProductStore: { productStoreId: "STORE" } });
    mockedRunSolrQuery.mockResolvedValue({
      data: {
        response: {
          numFound: 1874,
          docs: [{
            orderId: "M100001",
            orderName: "100001",
            customerPartyName: "Test Customer",
            facilityName: "Brokering Queue",
            orderDate: "2026-08-12T10:00:00Z",
            orderStatusDesc: "Approved",
            salesChannelDesc: "Web Channel"
          }]
        }
      }
    });

    await useDashboardStore().loadRouting();

    expect(mockedRunSolrQuery).toHaveBeenCalledWith({
      json: {
        params: expect.objectContaining({ rows: "1", sort: "orderDate asc" }),
        query: "*:*",
        filter: "docType: ORDER AND orderTypeId: SALES_ORDER AND facilityId: (_NA_ OR UNFILLABLE_PARKING OR REJECTED_ITM_PARKING OR RELEASED_ORD_PARKING OR UNF_HOLD_PARKING) AND productStoreId: STORE"
      }
    });
    expect(mockedApi).not.toHaveBeenCalledWith(expect.objectContaining({ url: "solr-query" }));
    expect(useDashboardStore().getRouting.queueDepth).toBe(1874);
    expect(useDashboardStore().getRouting.oldestQueued).toEqual(expect.objectContaining({
      orderId: "M100001",
      orderName: "100001"
    }));
  });

  it("keeps the queue count unavailable when the Solr request fails", async () => {
    useAtpProductStore().$patch({ currentProductStore: { productStoreId: "STORE" } });
    mockedRunSolrQuery.mockRejectedValue(new Error("Request failed"));

    await useDashboardStore().loadRouting();

    expect(mockedRunSolrQuery).toHaveBeenCalledTimes(1);
    expect(useDashboardStore().getRouting.queueDepth).toBeNull();
    expect(useDashboardStore().getRouting.oldestQueued).toBeNull();
  });

  it("keeps the queue count unavailable when the Solr response is malformed", async () => {
    useAtpProductStore().$patch({ currentProductStore: { productStoreId: "STORE" } });
    mockedRunSolrQuery.mockResolvedValue({ data: {} });

    await useDashboardStore().loadRouting();

    expect(mockedRunSolrQuery).toHaveBeenCalledTimes(1);
    expect(useDashboardStore().getRouting.queueDepth).toBeNull();
    expect(useDashboardStore().getRouting.oldestQueued).toBeNull();
  });
});
