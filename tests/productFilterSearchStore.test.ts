import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, commonUtil } from "@common";
import { useAtpProductStore } from "@/store/atpProductStore";

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: { hasError: (response: any) => Boolean(response?.error), isMoqui: vi.fn(() => true) },
  logger: { error: vi.fn() },
}));
vi.mock("@/store/userStore", () => ({ useUserStore: vi.fn(() => ({})) }));
vi.mock("@/store/productStore", () => ({
  productStore: () => ({ currentEComStore: { productStoreId: "STORE" } }),
}));

const mockedApi = vi.mocked(api);
describe("product filter facet search", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
    vi.mocked(commonUtil.isMoqui).mockReturnValue(true);
  });

  it("finds a feature by its value using the real native facet response shape", async () => {
    // Captured read-only from Demo: COLOR/Blue is indexed on 404 products.
    mockedApi.mockResolvedValue({ data: { response: { facet_counts: {
      facet_fields: { productFeatures: ["COLOR/Blue", 404] },
    } } } } as any);
    const store = useAtpProductStore();
    const result = await store.fetchProductFilters({ searchfield: "productFeatures", queryString: "blue", limit: 100, maxResults: 100 });
    expect(result).toEqual([{ id: "COLOR/Blue", label: "COLOR/Blue", value: "COLOR/Blue", count: 404 }]);
    expect(mockedApi).toHaveBeenCalledWith({
      url: "admin/search/query", method: "POST", data: {
        query: "*:*", filter: ["docType:PRODUCT", 'productStoreIds_s:"STORE"'],
        params: { rows: 0, facet: true, "facet.field": "productFeatures", "facet.contains": "blue", "facet.contains.ignoreCase": true, "facet.limit": 100, "facet.offset": 0, "facet.mincount": 1, "facet.sort": "index" },
      },
    });
    expect(store.getFacetOptions("productFeatures")).toEqual([]);
  });

  it("uses the Maarg query endpoint even when the login OMS is legacy", async () => {
    vi.mocked(commonUtil.isMoqui).mockReturnValue(false);
    mockedApi.mockResolvedValue({ data: { response: { facet_counts: { facet_fields: { tags: ["Top", 1468] } } } } } as any);
    const result = await useAtpProductStore().fetchProductFilters({ searchfield: "tags", queryString: "top", limit: 100, maxResults: 100 });
    expect(result).toEqual([{ id: "Top", label: "Top", value: "Top", count: 1468 }]);
    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({ url: "admin/search/query", method: "POST", data: expect.objectContaining({ params: expect.objectContaining({ "facet.contains": "top", "facet.contains.ignoreCase": true, "facet.limit": 100, rows: 0 }) }) }));
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it("loads a bounded initial list without a document prefix filter", async () => {
    mockedApi.mockResolvedValue({ data: { response: { facet_counts: { facet_fields: { tags: ["Top", 1468, "Women", 865] } } } } } as any);
    const result = await useAtpProductStore().fetchProductFilters({ searchfield: "tags", queryString: "", limit: 100, maxResults: 100 });
    expect(result.map((option: any) => option.id)).toEqual(["Top", "Women"]);
    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ params: expect.objectContaining({ "facet.contains": "", "facet.limit": 100 }) }) }));
    expect(mockedApi).toHaveBeenCalledTimes(1);
  });

  it("reports a failed lookup instead of presenting it as an empty catalog", async () => {
    mockedApi.mockRejectedValue(new Error("search unavailable"));
    await expect(useAtpProductStore().fetchProductFilters({ searchfield: "tags", queryString: "top" })).rejects.toThrow("search unavailable");
  });
});
