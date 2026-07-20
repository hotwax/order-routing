import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
const hasError = vi.fn(() => false);
const loggerError = vi.fn();

vi.mock("@common", () => ({
  api,
  commonUtil: { hasError, getOmsURL: () => "" },
  logger: { error: loggerError },
}));

describe("useChannelInventory", () => {
  beforeEach(() => {
    api.mockReset();
    hasError.mockReset();
    hasError.mockReturnValue(false);
    loggerError.mockReset();
  });

  it("loads authoritative Online ATP and composes NA Shopify mappings", async () => {
    api.mockImplementation(({ url }: any) => {
      if(url === "oms/getProductOnlineAtp") {
        return Promise.resolve({ data: { productOnlineAtp: [{ productId: "SKU_1", atp: 42 }] } });
      }
      if(url === "oms/ShopFacilityMappings") {
        return Promise.resolve({
          data: [
            { shopId: "SHOP_1", name: "Primary shop", myshopifyDomain: "primary.myshopify.com", facilityId: "_NA_", shopifyLocationId: "100" },
            { shopId: "SHOP_1", facilityId: "BROADWAY", shopifyLocationId: "200" },
          ],
        });
      }
      if(url === "shopify/graphql") {
        return Promise.resolve({
          data: {
            response: {
              location: { name: "Online Store" },
              inventoryItem: {
                inventoryLevel: { quantities: [{ name: "available", quantity: 37 }] },
              },
            },
          },
        });
      }
      if(url === "oms/systemMessageRemotes") {
        return Promise.resolve({
          data: { systemMessageRemoteList: [{ internalId: "SHOP_1", systemMessageRemoteId: "SHOP_REMOTE_1" }] },
        });
      }

      return Promise.resolve({
        data: [{ shopId: "SHOP_1", productId: "SKU_1", shopifyProductId: "300", shopifyInventoryItemId: "400" }],
      });
    });

    const { useChannelInventory } = await import("../src/composables/useChannelInventory");
    const channelInventory = useChannelInventory();
    await channelInventory.load({ productStoreId: "STORE", facilityGroupId: "FAC_GRP", productId: "SKU_1" });

    expect(api).toHaveBeenCalledWith({
      url: "oms/getProductOnlineAtp",
      method: "GET",
      params: { productStoreId: "STORE", facilityGroupId: "FAC_GRP", productId: "SKU_1" },
    });
    expect(api).toHaveBeenCalledWith({
      url: "oms/ShopFacilityMappings",
      method: "GET",
      params: { productStoreId: "STORE", pageNoLimit: true },
    });
    expect(api).toHaveBeenCalledWith({
      url: "oms/products/SKU_1/shopifyShopProducts",
      method: "GET",
      params: { productStoreId: "STORE", pageNoLimit: true },
    });
    expect(channelInventory.onlineAtp.value).toBe(42);
    expect(channelInventory.onlineAtpState.value).toBe("loaded");
    expect(channelInventory.reconciliationRows.value).toEqual([{
      shopId: "SHOP_1",
      systemMessageRemoteId: "SHOP_REMOTE_1",
      shopName: "Primary shop",
      shopDomain: "primary.myshopify.com",
      shopifyLocationId: "100",
      shopifyLocationName: "Online Store",
      shopifyProductId: "300",
      shopifyInventoryItemId: "400",
      isProductMapped: true,
      shopifyAtp: 37,
      shopifyAtpState: "loaded",
    }]);
    expect(api).toHaveBeenCalledWith({
      url: "oms/systemMessageRemotes",
      method: "GET",
    });
    expect(api).toHaveBeenCalledWith({
      url: "shopify/graphql",
      method: "POST",
      data: {
        systemMessageRemoteId: "SHOP_REMOTE_1",
        queryText: expect.stringContaining("inventoryLevel(locationId: $locationId)"),
        variables: {
          inventoryItemId: "gid://shopify/InventoryItem/400",
          locationId: "gid://shopify/Location/100",
        },
      },
    });
  });

  it("summarizes channel safety stock, disabled brokering, and inventory outside the group", async () => {
    api.mockImplementation(({ url, params }: any) => {
      if(url === "oms/productFacilities/search") {
        const inventoryByFacility: Record<string, any> = {
          FAC_1: { atp: 10, qoh: 12, minimumStock: 3, allowBrokering: "N" },
          FAC_2: { atp: 8, qoh: 9, minimumStock: 2, allowBrokering: "Y" },
          FAC_3: { atp: 5, qoh: 5, minimumStock: 1, allowBrokering: "Y" },
        };

        return Promise.resolve({
          data: {
            products: [{ inventoryConfig: { productId: "SKU_1", facilityId: params.facilityId, ...inventoryByFacility[params.facilityId] } }],
          },
        });
      }
      if(url === "oms/getProductOnlineAtp") {return Promise.resolve({ data: { productOnlineAtp: [] } });}

      return Promise.resolve({ data: [] });
    });

    const { useChannelInventory } = await import("../src/composables/useChannelInventory");
    const channelInventory = useChannelInventory();
    await channelInventory.load({
      productStoreId: "STORE",
      facilityGroupId: "GROUP",
      productId: "SKU_1",
      allFacilities: [
        { facilityId: "FAC_1", facilityName: "Broadway" },
        { facilityId: "FAC_2", facilityName: "Brooklyn" },
        { facilityId: "FAC_3", facilityName: "Queens" },
        { facilityId: "CONFIG", facilityName: "Threshold", facilityTypeId: "CONFIGURATION" },
      ],
      channelFacilities: [
        { facilityId: "FAC_1", facilityName: "Broadway" },
        { facilityId: "FAC_2", facilityName: "Brooklyn" },
        { facilityId: "CONFIG", facilityName: "Threshold", facilityTypeId: "CONFIGURATION" },
      ],
    });

    // Waterfall steps: FAC_1 (in channel, brokering N, atp 10, ss 3), FAC_2 (in channel, Y,
    // atp 8, ss 2), FAC_3 (outside, atp 5). CONFIG is excluded from physical rows entirely.
    expect(channelInventory.physicalAtp.value).toBe(23);
    expect(channelInventory.channelAtp.value).toBe(18);
    expect(channelInventory.brokeringDisabledAtp.value).toBe(10);
    expect(channelInventory.contributingSafetyStock.value).toBe(2);
    expect(channelInventory.channelFacilityCount.value).toBe(2);
    expect(channelInventory.brokeringDisabledFacilities.value.map((row) => row.facilityId)).toEqual(["FAC_1"]);
    expect(channelInventory.channelFacilityInventory.value.map((row) => row.facilityId)).toEqual(["FAC_1", "FAC_2"]);
    expect(channelInventory.outsideChannelInventory.value.map((row) => row.facilityId)).toEqual(["FAC_3"]);
    expect(api).not.toHaveBeenCalledWith(expect.objectContaining({
      url: "oms/productFacilities/search",
      params: expect.objectContaining({ facilityId: "CONFIG" }),
    }));
  });

  it("sums promised order items at virtual queue facilities like get#ProductOnlineAtp", async () => {
    api.mockImplementation(({ url }: any) => {
      if(url === "oms/facilities") {
        return Promise.resolve({
          data: [
            { facilityId: "_NA_", parentTypeId: "VIRTUAL_FACILITY" },
            { facilityId: "BACKORDER_PARKING", parentTypeId: "VIRTUAL_FACILITY" },
            { facilityId: "BROADWAY", parentTypeId: "PHYSICAL_FACILITY" },
          ],
        });
      }
      if(url === "solr-query") {
        return Promise.resolve({ data: { response: { numFound: 3 }, facets: { count: 3, queueDemand: 4 } } });
      }
      if(url === "oms/getProductOnlineAtp") {return Promise.resolve({ data: { productOnlineAtp: [] } });}

      return Promise.resolve({ data: [] });
    });

    const { useChannelInventory } = await import("../src/composables/useChannelInventory");
    const channelInventory = useChannelInventory();
    await channelInventory.load({ productStoreId: "STORE", facilityGroupId: "GROUP", productId: "SKU_1" });

    expect(channelInventory.virtualQueueDemand.value).toBe(4);
    expect(channelInventory.virtualQueueDemandState.value).toBe("loaded");
    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      url: "solr-query",
      data: {
        json: expect.objectContaining({
          filter: expect.stringContaining("facilityId: (_NA_ OR BACKORDER_PARKING) AND -orderItemStatusId: (ITEM_CANCELLED OR ITEM_COMPLETED OR ITEM_REJECTED)"),
        }),
      },
    }));
  });

  it("loads channel-scoped inventory upload service-job runs with linked evidence", async () => {
    api.mockImplementation(({ url }: any) => {
      if(url === "oms/getProductOnlineAtp") {return Promise.resolve({ data: { productOnlineAtp: [] } });}
      if(url === "oms/ShopFacilityMappings") {
        return Promise.resolve({
          data: [{ shopId: "SHOP_1", name: "Primary shop", facilityId: "_NA_", shopifyLocationId: "100" }],
        });
      }
      if(url === "oms/products/SKU_1/shopifyShopProducts") {return Promise.resolve({ data: [] });}
      if(url === "oms/systemMessageRemotes") {
        return Promise.resolve({
          data: { systemMessageRemoteList: [{ internalId: "SHOP_1", systemMessageRemoteId: "REMOTE_1" }] },
        });
      }
      if(url === "admin/serviceJobs") {
        return Promise.resolve({
          data: {
            serviceJobList: [
              {
                jobName: "uploadInventoryPrimary",
                description: "Upload inventory to Primary shop",
                serviceName: "co.hotwax.UploadInventory",
                serviceJobParameters: [
                  { parameterName: "productStoreId", parameterValue: "STORE" },
                  { parameterName: "systemMessageRemoteId", parameterValue: "REMOTE_1" },
                ],
              },
              {
                jobName: "uploadInventoryOther",
                serviceJobParameters: [{ parameterName: "systemMessageRemoteId", parameterValue: "REMOTE_2" }],
              },
            ],
          },
        });
      }
      if(url === "admin/serviceJobs/uploadInventoryPrimary/runs") {
        return Promise.resolve({
          data: [
            {
              jobRunId: "101",
              startTime: "2026-07-18T09:00:00Z",
              endTime: "2026-07-18T09:00:12Z",
              userId: "system",
              parameters: JSON.stringify({ productIds: ["SKU_1"] }),
              logs: [{ logId: "LOG_1", fileName: "inventory.csv", totalRecordCount: 12 }],
            },
            {
              jobRunId: "100",
              startTime: "2026-07-17T09:00:00Z",
              endTime: "2026-07-17T09:00:05Z",
              hasError: "Y",
              errors: "Shopify rejected the upload",
            },
          ],
        });
      }
      if(url === "shopify/graphql") {return Promise.resolve({ data: { response: {} } });}

      return Promise.resolve({ data: [] });
    });

    const { useChannelInventory } = await import("../src/composables/useChannelInventory");
    const channelInventory = useChannelInventory();
    await channelInventory.load({ productStoreId: "STORE", facilityGroupId: "FAC_GRP", productId: "SKU_1" });

    expect(api).toHaveBeenCalledWith({
      url: "admin/serviceJobs",
      method: "GET",
      params: {
        pageIndex: 0,
        pageSize: 250,
        serviceName: "co.hotwax.ofbiz.InventoryServices.generate#ShopifyInventoryFeed",
      },
    });
    expect(api).toHaveBeenCalledWith({
      url: "admin/serviceJobs",
      method: "GET",
      params: {
        pageIndex: 0,
        pageSize: 250,
        serviceName: "co.hotwax.ofbiz.InventoryServices.generate#InventoryDeltaFeed",
      },
    });
    expect(api).toHaveBeenCalledWith({
      url: "admin/serviceJobs/uploadInventoryPrimary/runs",
      method: "GET",
      params: { dependentLevels: 1, orderByField: "-startTime", pageIndex: 0, pageSize: 25 },
    });
    expect(api).not.toHaveBeenCalledWith(expect.objectContaining({
      url: "admin/serviceJobs/uploadInventoryOther/runs",
    }));
    expect(channelInventory.channelHistoryState.value).toBe("loaded");
    expect(channelInventory.channelJobRuns.value).toEqual([
      expect.objectContaining({
        jobRunId: "101",
        shopName: "Primary shop",
        status: "SUCCESSFUL",
        referencesProduct: true,
        logs: [expect.objectContaining({ logId: "LOG_1" })],
      }),
      expect.objectContaining({
        jobRunId: "100",
        status: "FAILED",
        referencesProduct: false,
      }),
    ]);
  });

  it("keeps Online ATP usable when Shopify mapping reads fail", async () => {
    api.mockImplementation(({ url }: any) => {
      if(url === "oms/getProductOnlineAtp") {return Promise.resolve({ data: { productOnlineAtp: [{ productId: "SKU_1", atp: 0 }] } });}
      if(url === "oms/ShopFacilityMappings") {return Promise.reject(new Error("location unavailable"));}
      if(url === "oms/products/SKU_1/shopifyShopProducts") {return Promise.reject(new Error("product unavailable"));}
      if(url === "oms/systemMessageRemotes") {return Promise.reject(new Error("config unavailable"));}

      return Promise.resolve({ data: [] });
    });

    const { useChannelInventory } = await import("../src/composables/useChannelInventory");
    const channelInventory = useChannelInventory();
    await channelInventory.load({ productStoreId: "STORE", facilityGroupId: "FAC_GRP", productId: "SKU_1" });

    expect(channelInventory.onlineAtp.value).toBe(0);
    expect(channelInventory.onlineAtpState.value).toBe("loaded");
    expect(channelInventory.reconciliationState.value).toBe("unavailable");
    expect(channelInventory.reconciliationRows.value).toEqual([]);
  });

  it("ignores a stale response after the scope changes", async () => {
    let resolveFirstOnlineAtp: (value: any) => void = () => undefined;
    const firstOnlineAtp = new Promise((resolve) => { resolveFirstOnlineAtp = resolve; });
    api.mockImplementation(({ url, params }: any) => {
      if(url === "oms/getProductOnlineAtp" && params.productId === "SKU_1") {return firstOnlineAtp;}
      if(url === "oms/getProductOnlineAtp") {return Promise.resolve({ data: { productOnlineAtp: [{ productId: "SKU_2", atp: 9 }] } });}

      return Promise.resolve({ data: [] });
    });

    const { useChannelInventory } = await import("../src/composables/useChannelInventory");
    const channelInventory = useChannelInventory();
    const firstLoad = channelInventory.load({ productStoreId: "STORE", facilityGroupId: "FAC_1", productId: "SKU_1" });
    await channelInventory.load({ productStoreId: "STORE", facilityGroupId: "FAC_2", productId: "SKU_2" });
    resolveFirstOnlineAtp({ data: { productOnlineAtp: [{ productId: "SKU_1", atp: 99 }] } });
    await firstLoad;

    expect(channelInventory.onlineAtp.value).toBe(9);
  });
});
