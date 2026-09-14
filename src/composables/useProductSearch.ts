import { logger, useSolrSearch } from "@common";

/**
 * Solr-backed product lookups for the ProductFacility-first inventory list.
 *
 * The list is driven by the ProductFacility entity, which carries only productId — names, SKUs and
 * images come from Solr afterwards. Product *search* also lives here: users pick a style (a virtual
 * product) and then its variants, rather than the list itself being a product search.
 *
 * Routed through the shared useSolrSearch composable rather than the product store's searchProducts
 * call, because that one posts to the OFBiz-only `searchProducts` path and 404s against Moqui.
 */

export interface ProductSummary {
  productId: string;
  productName?: string;
  parentProductName?: string;
  sku?: string;
  mainImageUrl?: string;
  groupId?: string;
  productFeatures?: string[];
}

// Solr rejects very long boolean clauses; enrich in batches well under the default maxBooleanClauses.
const ENRICH_BATCH_SIZE = 200;

function toSummary(doc: any): ProductSummary {
  return {
    productId: doc.productId,
    productName: doc.productName,
    parentProductName: doc.parentProductName,
    sku: doc.sku,
    mainImageUrl: doc.mainImageUrl,
    groupId: doc.groupId,
    productFeatures: doc.productFeatures
  };
}

function docsOf(resp: any): any[] {
  return resp?.data?.response?.docs ?? [];
}

function numFoundOf(resp: any): number {
  return resp?.data?.response?.numFound ?? 0;
}

export function useProductSearch() {
  const { runSolrQuery } = useSolrSearch();

  function query(filter: string[], params: Record<string, any>) {
    return runSolrQuery({
      json: {
        query: "*:*",
        filter,
        params,
        collection: "enterpriseSearch"
      }
    });
  }

  /** Fetch display details for the productIds on the current page, keyed by productId. */
  async function fetchProductSummaries(productIds: string[]): Promise<Record<string, ProductSummary>> {
    const unique = [...new Set(productIds.filter(Boolean))];
    if(!unique.length) {return {};}

    const summaries: Record<string, ProductSummary> = {};
    for(let i = 0; i < unique.length; i += ENRICH_BATCH_SIZE) {
      const batch = unique.slice(i, i + ENRICH_BATCH_SIZE);
      try {
        const resp = await query(
          ["docType:PRODUCT", `productId:(${batch.join(" OR ")})`],
          { rows: batch.length }
        );
        docsOf(resp).forEach((doc: any) => {
          if(doc?.productId) {summaries[doc.productId] = toSummary(doc);}
        });
      } catch (err) {
        // A failed enrichment must not blank the list — rows still render from their entity data.
        logger.error("Failed to enrich products from Solr", err);
      }
    }

    return summaries;
  }

  // Fields a retailer might actually type: a style name, a variant SKU or barcode, an internal name,
  // or a bare productId off a label.
  const KEYWORD_FIELDS = "productId productName internalName sku upc goodIdentifications parentProductName groupName keywordSearchText";
  // A keyword search matches variants, and many variants collapse to one style, so read well past the
  // page size to fill a page with distinct styles.
  const STYLE_MATCH_FANOUT = 10;

  /**
   * Search styles for the product-search modal.
   *
   * The results are always styles, but the *match* is not restricted to them: searching only
   * isVirtual documents means a variant SKU, barcode or productId finds nothing, which is exactly
   * what a retailer reaches for first. So the query runs across every product document and each hit
   * is collapsed to its style — groupId, which on a style is its own productId — then deduped so the
   * modal still lists one row per style.
   */
  async function searchStyles(keyword: string, { pageIndex = 0, pageSize = 25 } = {}) {
    const trimmed = keyword?.trim();

    // Without a keyword there is nothing to collapse, so list styles directly and page accurately.
    if(!trimmed) {
      try {
        const resp = await query(
          ["docType:PRODUCT", "isVirtual:true"],
          { rows: pageSize, start: pageIndex * pageSize }
        );

        return { styles: docsOf(resp).map(toSummary), total: numFoundOf(resp) };
      } catch (err) {
        logger.error("Failed to list product styles", err);

        return { styles: [], total: 0 };
      }
    }

    try {
      const resp = await runSolrQuery({
        json: {
          query: `${trimmed}*`,
          filter: ["docType:PRODUCT"],
          params: {
            rows: pageSize * STYLE_MATCH_FANOUT,
            start: 0,
            defType: "edismax",
            qf: KEYWORD_FIELDS,
            fl: "productId,groupId"
          },
          collection: "enterpriseSearch"
        }
      });

      // Relevance order is preserved: the first hit decides where its style ranks.
      const styleIds: string[] = [];
      docsOf(resp).forEach((doc: any) => {
        const styleId = doc?.groupId || doc?.productId;
        if(styleId && !styleIds.includes(styleId)) {styleIds.push(styleId);}
      });

      const pageIds = styleIds.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
      if(!pageIds.length) {return { styles: [], total: styleIds.length };}

      const summaries = await fetchProductSummaries(pageIds);

      return {
        styles: pageIds.map((id) => summaries[id]).filter(Boolean),
        total: styleIds.length
      };
    } catch (err) {
      logger.error("Failed to search product styles", err);

      return { styles: [], total: 0 };
    }
  }

  /** List the variants of a style. Variants carry the parent's productId in groupId. */
  async function fetchVariants(groupId: string, { pageSize = 200 } = {}) {
    if(!groupId) {return { variants: [], total: 0 };}

    try {
      const resp = await query(
        ["docType:PRODUCT", "isVariant:true", `groupId:${groupId}`],
        { rows: pageSize, sort: "productId asc" }
      );

      return { variants: docsOf(resp).map(toSummary), total: numFoundOf(resp) };
    } catch (err) {
      logger.error("Failed to fetch product variants", err);

      return { variants: [], total: 0 };
    }
  }

  return { fetchProductSummaries, fetchVariants, searchStyles };
}
