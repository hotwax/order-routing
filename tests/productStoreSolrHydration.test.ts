import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
const runSolrQuery = vi.hoisted(() => vi.fn());
const hasError = vi.hoisted(() => vi.fn(() => false));
const loggerError = vi.hoisted(() => vi.fn());

vi.mock("@common", () => ({
  api,
  commonUtil: { hasError, getOmsURL: () => "https://oms.example/" },
  logger: { error: loggerError },
  useSolrSearch: () => ({ runSolrQuery }),
}));

describe("productStore.fetchProducts", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.mockReset();
    runSolrQuery.mockReset();
    hasError.mockReset();
    hasError.mockReturnValue(false);
    loggerError.mockReset();
  });

  // Regression: this hydrate POSTed to a bare "searchProducts" resource, which is not defined in
  // the OMS REST API and answered 404 ("Service REST API Root resource not found with name
  // searchProducts"). Product names and images never resolved, so Inventory Detail rendered a
  // placeholder image, no product title, and an empty variant selector.
  it("hydrates products through the shared Solr adapter instead of the missing searchProducts resource", async () => {
    runSolrQuery.mockResolvedValue({
      data: { response: { numFound: 2, docs: [
        { productId: "142834", productName: "JUNE DRESS - WASHED INDIGO STRIPE" },
        { productId: "142835", productName: "JUNE DRESS - WASHED INDIGO STRIPE" },
      ] } }
    });

    const { productStore } = await import("../src/store/product");
    const store = productStore();
    await store.fetchProducts(["142834", "142835"]);

    expect(runSolrQuery).toHaveBeenCalledTimes(1);
    expect(runSolrQuery).toHaveBeenCalledWith({
      json: expect.objectContaining({
        query: "*:*",
        filter: "docType: PRODUCT AND productId: (142834 OR 142835)",
        params: expect.objectContaining({ rows: 2 }),
      }),
    });
    expect(api).not.toHaveBeenCalledWith(expect.objectContaining({ url: "searchProducts" }));
    expect(store.getProductById("142834")).toEqual(expect.objectContaining({ productName: "JUNE DRESS - WASHED INDIGO STRIPE" }));
  });

  it("skips the query entirely when every requested product is already cached", async () => {
    const { productStore } = await import("../src/store/product");
    const store = productStore();
    store.products = { "142834": { productId: "142834" } };

    await store.fetchProducts(["142834"]);

    expect(runSolrQuery).not.toHaveBeenCalled();
  });
});
