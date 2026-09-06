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

  /** Search parent styles (virtual products) for the product-search modal. */
  async function searchStyles(keyword: string, { pageIndex = 0, pageSize = 25 } = {}) {
    const filter = ["docType:PRODUCT", "isVirtual:true"];
    const params: Record<string, any> = { rows: pageSize, start: pageIndex * pageSize };
    const trimmed = keyword?.trim();

    if(trimmed) {
      params.defType = "edismax";
      params.qf = "productId productName internalName sku keywordSearchText";
    }

    try {
      const resp = await runSolrQuery({
        json: {
          query: trimmed ? `${trimmed}*` : "*:*",
          filter,
          params,
          collection: "enterpriseSearch"
        }
      });

      return { styles: docsOf(resp).map(toSummary), total: numFoundOf(resp) };
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
