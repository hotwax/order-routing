import { beforeEach, describe, expect, it, vi } from "vitest";

const runSolrQuery = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());
const currentProductStore = vi.hoisted(() => ({ value: { productStoreId: "SANDBOX_STORE" } as any }));

vi.mock("@common", () => ({
  useSolrSearch: () => ({ runSolrQuery }),
  logger: { error: loggerError },
}));

vi.mock("@/store/atpProductStore", () => ({
  useAtpProductStore: () => ({ currentProductStore: currentProductStore.value }),
}));

import { useProductSearch } from "../src/composables/useProductSearch";

const solr = (docs: any[], numFound = docs.length) => ({ data: { response: { docs, numFound } } });

describe("useProductSearch.searchStyles", () => {
  beforeEach(() => {
    runSolrQuery.mockReset();
    loggerError.mockReset();
    currentProductStore.value = { productStoreId: "SANDBOX_STORE" };
  });

  // A retailer reaches for whatever is on the label — a SKU, a barcode, a bare productId. Restricting
  // the match to isVirtual documents made all of those return nothing, because they only exist on the
  // variant.
  it("matches any product document, not just styles", async () => {
    runSolrQuery.mockResolvedValueOnce(solr([{ productId: "M107432", groupId: "M107431" }]));
    runSolrQuery.mockResolvedValueOnce(solr([{ productId: "M107431", productName: "CARA T-SHIRT - LIPSTICK HEARTS" }]));

    await useProductSearch().searchStyles("203-321-244244:XS");

    const sent = runSolrQuery.mock.calls[0][0].json;
    expect(sent.filter).toEqual(["docType:PRODUCT", 'productStoreIds:"SANDBOX_STORE"']);
    expect(sent.filter).not.toContain("isVirtual:true");
    expect(sent.params.qf).toContain("sku");
    expect(sent.params.qf).toContain("upc");
    expect(sent.params.qf).toContain("goodIdentifications");
  });

  it("resolves a variant hit to the style that owns it", async () => {
    runSolrQuery.mockResolvedValueOnce(solr([{ productId: "M107432", groupId: "M107431" }]));
    runSolrQuery.mockResolvedValueOnce(solr([{ productId: "M107431", productName: "CARA T-SHIRT - LIPSTICK HEARTS" }]));

    const { styles } = await useProductSearch().searchStyles("M107432");

    expect(styles).toHaveLength(1);
    expect(styles[0]).toEqual(expect.objectContaining({ productId: "M107431", productName: "CARA T-SHIRT - LIPSTICK HEARTS" }));
  });

  it("collapses many variants of one style into a single row, keeping relevance order", async () => {
    runSolrQuery.mockResolvedValueOnce(solr([
      { productId: "V1", groupId: "STYLE_B" },
      { productId: "V2", groupId: "STYLE_B" },
      { productId: "V3", groupId: "STYLE_A" },
      { productId: "V4", groupId: "STYLE_B" },
    ]));
    runSolrQuery.mockResolvedValueOnce(solr([
      { productId: "STYLE_A", productName: "A" },
      { productId: "STYLE_B", productName: "B" },
    ]));

    const { styles, total } = await useProductSearch().searchStyles("shirt");

    expect(styles.map((s: any) => s.productId)).toEqual(["STYLE_B", "STYLE_A"]);
    expect(total).toBe(2);
  });

  // A style's groupId is its own productId, so a direct style hit needs no special case — but a doc
  // without one must still resolve to itself rather than being dropped.
  it("falls back to the productId when a hit carries no groupId", async () => {
    runSolrQuery.mockResolvedValueOnce(solr([{ productId: "STYLE_ONLY" }]));
    runSolrQuery.mockResolvedValueOnce(solr([{ productId: "STYLE_ONLY", productName: "Solo" }]));

    const { styles } = await useProductSearch().searchStyles("solo");

    expect(styles.map((s: any) => s.productId)).toEqual(["STYLE_ONLY"]);
  });

  it("lists styles directly when there is no keyword, so paging stays accurate", async () => {
    runSolrQuery.mockResolvedValueOnce(solr([{ productId: "S1" }, { productId: "S2" }], 500));

    const { styles, total } = await useProductSearch().searchStyles("");

    expect(runSolrQuery).toHaveBeenCalledTimes(1);
    expect(runSolrQuery.mock.calls[0][0].json.filter).toEqual(["docType:PRODUCT", "isVirtual:true", 'productStoreIds:"SANDBOX_STORE"']);
    expect(styles).toHaveLength(2);
    expect(total).toBe(500);
  });

  it("returns nothing rather than throwing when the search fails", async () => {
    runSolrQuery.mockRejectedValueOnce(new Error("solr down"));

    await expect(useProductSearch().searchStyles("cara")).resolves.toEqual({ styles: [], total: 0 });
    expect(loggerError).toHaveBeenCalled();
  });

  // Store membership comes from ProductStoreProduct, folded into the index as productStoreIds.
  // Without it the modal offered products belonging to another store entirely.
  describe("store scope", () => {
    it("restricts a keyword search to the selected store", async () => {
      runSolrQuery.mockResolvedValueOnce(solr([]));

      await useProductSearch().searchStyles("MH09");

      expect(runSolrQuery.mock.calls[0][0].json.filter).toEqual(["docType:PRODUCT", 'productStoreIds:"SANDBOX_STORE"']);
    });

    it("restricts the keyword-less style listing too", async () => {
      runSolrQuery.mockResolvedValueOnce(solr([]));

      await useProductSearch().searchStyles("");

      expect(runSolrQuery.mock.calls[0][0].json.filter).toEqual(["docType:PRODUCT", "isVirtual:true", 'productStoreIds:"SANDBOX_STORE"']);
    });

    it("restricts a style's variants, so a foreign variant cannot be selected", async () => {
      runSolrQuery.mockResolvedValueOnce(solr([]));

      await useProductSearch().fetchVariants("M107431");

      expect(runSolrQuery.mock.calls[0][0].json.filter).toContain('productStoreIds:"SANDBOX_STORE"');
    });

    // Before a store is chosen, scoping on an empty id would match nothing at all, which reads as a
    // broken search rather than an empty store.
    it("adds no clause when no store is selected yet", async () => {
      currentProductStore.value = null;
      runSolrQuery.mockResolvedValueOnce(solr([]));

      await useProductSearch().searchStyles("cara");

      expect(runSolrQuery.mock.calls[0][0].json.filter).toEqual(["docType:PRODUCT"]);
    });
  });
});
