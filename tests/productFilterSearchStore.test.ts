import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@common";
import { useAtpProductStore } from "@/store/atpProductStore";

vi.mock("@common", () => ({
  api: vi.fn(),
  commonUtil: { hasError: (response: any) => Boolean(response?.error) },
  logger: { error: vi.fn() },
}));

vi.mock("@/store/userStore", () => ({
  useUserStore: vi.fn(() => ({})),
}));

const mockedApi = vi.mocked(api);

describe("product filter facet search", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedApi.mockReset();
  });

  it("returns one capped server-side search page without caching it as the complete facet list", async () => {
    const facets = Array.from({ length: 150 }, (_, index) => ({
      id: `tag-${index}`,
      label: `tag-${index}`,
      value: `tag-${index}`,
    }));
    mockedApi.mockResolvedValue({ data: { response: facets } } as any);

    const store = useAtpProductStore();
    const result = await store.fetchProductFilters({
      facetToSelect: "tagsFacet",
      searchfield: "tags",
      queryString: "vip",
      limit: 100,
      maxResults: 100,
    });

    expect(mockedApi).toHaveBeenCalledTimes(1);
    expect(mockedApi).toHaveBeenCalledWith(expect.objectContaining({
      url: "admin/solrFacets",
      method: "GET",
      params: expect.objectContaining({
        term: "vip",
        q: "vip",
        limit: 100,
        offset: 0,
      }),
    }));
    expect(result).toHaveLength(100);
    expect(store.getFacetOptions("tags")).toEqual([]);
  });
});
