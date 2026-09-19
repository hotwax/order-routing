import { beforeEach, describe, expect, it, vi } from "vitest";

describe("product search summaries", () => {
  let runSolrQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    runSolrQuery = vi.fn(() => Promise.resolve({
      data: {
        response: {
          docs: [{
            productId: "10002",
            productName: "XS / Green",
            parentProductName: "Abominable Hoodie",
            title: "XS / Green",
            internalName: "xs-green",
            sku: "MH09-XS-Green",
            goodIdentifications: [{ type: "SKU", value: "MH09-XS-Green" }],
            mainImageUrl: "image.jpg",
            groupId: "10000"
          }]
        }
      }
    }));

    vi.doMock("@common", () => ({
      logger: { error: vi.fn() },
      useSolrSearch: () => ({ runSolrQuery }),
    }));
    vi.doMock("@/store/atpProductStore", () => ({
      useAtpProductStore: () => ({ currentProductStore: { productStoreId: "STORE" } }),
    }));
  });

  it("retains product-store identifier fields while enriching inventory rows", async () => {
    const { useProductSearch } = await import("../src/composables/useProductSearch");
    const summaries = await useProductSearch().fetchProductSummaries(["10002"]);

    expect(summaries["10002"]).toMatchObject({
      productId: "10002",
      internalName: "xs-green",
      title: "XS / Green",
      goodIdentifications: [{ type: "SKU", value: "MH09-XS-Green" }],
    });
  });
});
