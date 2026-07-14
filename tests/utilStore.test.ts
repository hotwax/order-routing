import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, commonUtil } from "@common";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { useUtilStore } from "@/store/utilStore";

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: {
    getMaargURL: vi.fn(() => "https://demo-maarg.hotwax.io/rest/s1/"),
    getOmsURL: vi.fn(() => "https://demo-oms.hotwax.io/rest/s1/"),
    hasError: vi.fn((response: any) => Boolean(response?.error || response?.data?._ERROR_MESSAGE_)),
    sortSequence: vi.fn((items: any[] = []) => [...items].sort((a, b) => Number(a?.sequenceNum ?? 0) - Number(b?.sequenceNum ?? 0))),
    showToast: vi.fn()
  },
  logger: {
    error: vi.fn(),
    warn: vi.fn()
  },
  translate: (value: string) => value
}));

vi.mock("@/store/productStore", () => ({
  productStore: vi.fn(() => ({
    currentEComStore: { productStoreId: "STORE" },
    getCurrentEComStore: { productStoreId: "STORE" }
  }))
}));

vi.mock("@/store/product", () => ({
  productStore: vi.fn(() => ({
    fetchProducts: vi.fn()
  }))
}));

vi.mock("@/utils/simConfig", () => ({
  simApiBaseUrl: () => "https://sim.example/rest/s1/"
}));

const mockedApi = vi.mocked(api);
const mockedCommonUtil = vi.mocked(commonUtil);

describe("utilStore.fetchCategories", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
    mockedCommonUtil.getMaargURL.mockReturnValue("https://demo-maarg.hotwax.io/rest/s1/");
  });

  it("loads routing categories from the Maarg API host", async () => {
    orderRoutingStore().$patch({
      currentGroup: {
        routingGroupId: "G1",
        productStoreId: "STORE"
      }
    });
    mockedApi.mockResolvedValue({
      data: [{
        productCategoryId: "CAT_1",
        prodCatalogCategoryTypeId: "PCCT_ORD_ROUTING"
      }]
    });

    await useUtilStore().fetchCategories();

    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "categories/STORE",
      method: "GET",
      baseURL: "https://demo-maarg.hotwax.io/rest/s1/",
      params: expect.objectContaining({
        productStoreId: "STORE",
        pageSize: 500,
        pageIndex: 0
      })
    }));
  });
});

describe("utilStore user session lookups", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
    mockedCommonUtil.getMaargURL.mockReturnValue("https://demo-maarg.hotwax.io/rest/s1/");
    vi.spyOn(Date, "now").mockReturnValue(1782780000000);
  });

  it("loads active test sessions from the user sessions endpoint", async () => {
    mockedApi.mockResolvedValue({
      data: [
        {
          userSessionId: "ACTIVE_SESSION",
          sessionTypeEnumId: "ROUTING_TEST_DRIVE",
          productStoreId: "STORE",
          fromDate: 1782770000000
        },
        {
          userSessionId: "EXPIRED_SESSION",
          sessionTypeEnumId: "ROUTING_TEST_DRIVE",
          productStoreId: "STORE",
          fromDate: 1782760000000,
          thruDate: 1782770000000
        }
      ]
    });

    const sessions = await useUtilStore().getTestSessions({
      customParametersMap: {
        sessionTypeEnumId: "ROUTING_TEST_DRIVE",
        productStoreId: "STORE"
      },
      pageLimit: 100,
      filterByDate: true
    });

    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "admin/user/sessions",
      method: "GET",
      baseURL: "https://demo-maarg.hotwax.io/rest/s1/",
      params: {
        sessionTypeEnumId: "ROUTING_TEST_DRIVE",
        productStoreId: "STORE",
        pageSize: 100
      }
    }));
    expect(sessions).toEqual([expect.objectContaining({ userSessionId: "ACTIVE_SESSION" })]);
  });

  it("returns the first active user test session", async () => {
    mockedApi.mockResolvedValue({
      data: [
        {
          userSessionId: "EXPIRED_SESSION",
          userId: "USER_1",
          fromDate: 1782760000000,
          thruDate: 1782770000000
        },
        {
          userSessionId: "ACTIVE_SESSION",
          userId: "USER_1",
          fromDate: 1782770000000
        }
      ]
    });

    const session = await useUtilStore().getUserSession({
      customParametersMap: {
        sessionTypeEnumId: "ROUTING_TEST_DRIVE",
        userId: "USER_1",
        productStoreId: "STORE"
      },
      pageLimit: 100,
      filterByDate: true
    });

    expect(session).toEqual(expect.objectContaining({ userSessionId: "ACTIVE_SESSION" }));
  });
});
