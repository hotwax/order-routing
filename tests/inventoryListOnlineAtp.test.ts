import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
const hasError = vi.fn(() => false);
const loggerError = vi.fn();

vi.mock("@common", () => ({
  api,
  commonUtil: { hasError },
  logger: { error: loggerError },
}));

describe("fetchProductOnlineAtpMap", () => {
  beforeEach(() => {
    api.mockReset();
    hasError.mockReset();
    hasError.mockReturnValue(false);
    loggerError.mockReset();
  });

  it("batches the page's product ids into a single getProductOnlineAtp call and maps rows by productId", async () => {
    api.mockResolvedValue({
      data: {
        productOnlineAtp: [
          { productId: "SKU_1", sku: "sku-1", atp: 42 },
          { productId: "SKU_2", sku: "sku-2", atp: 0 },
        ],
      },
    });

    const { fetchProductOnlineAtpMap } = await import("../src/composables/useChannelInventory");
    const onlineAtpByProduct = await fetchProductOnlineAtpMap({
      productStoreId: "STORE",
      facilityGroupId: "FAC_GRP",
      productIds: ["SKU_1", "SKU_2", "SKU_UNLISTED"],
    });

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith({
      url: "oms/getProductOnlineAtp",
      method: "GET",
      params: { productStoreId: "STORE", facilityGroupId: "FAC_GRP", productId: ["SKU_1", "SKU_2", "SKU_UNLISTED"] },
    });
    expect(onlineAtpByProduct).toEqual({ SKU_1: 42, SKU_2: 0 });
    expect(onlineAtpByProduct.SKU_UNLISTED).toBeUndefined();
  });

  it("skips the request entirely for an empty page", async () => {
    const { fetchProductOnlineAtpMap } = await import("../src/composables/useChannelInventory");
    const onlineAtpByProduct = await fetchProductOnlineAtpMap({
      productStoreId: "STORE",
      facilityGroupId: "FAC_GRP",
      productIds: [],
    });

    expect(api).not.toHaveBeenCalled();
    expect(onlineAtpByProduct).toEqual({});
  });

  it("normalizes missing or non-numeric atp values to null", async () => {
    api.mockResolvedValue({
      data: {
        productOnlineAtp: [
          { productId: "SKU_1", atp: "not-a-number" },
          { productId: "SKU_2" },
        ],
      },
    });

    const { fetchProductOnlineAtpMap } = await import("../src/composables/useChannelInventory");
    const onlineAtpByProduct = await fetchProductOnlineAtpMap({
      productStoreId: "STORE",
      facilityGroupId: "FAC_GRP",
      productIds: ["SKU_1", "SKU_2"],
    });

    expect(onlineAtpByProduct).toEqual({ SKU_1: null, SKU_2: null });
  });

  it("returns an empty map and logs when the request fails", async () => {
    api.mockRejectedValue(new Error("network down"));

    const { fetchProductOnlineAtpMap } = await import("../src/composables/useChannelInventory");
    const onlineAtpByProduct = await fetchProductOnlineAtpMap({
      productStoreId: "STORE",
      facilityGroupId: "FAC_GRP",
      productIds: ["SKU_1"],
    });

    expect(onlineAtpByProduct).toEqual({});
    expect(loggerError).toHaveBeenCalled();
  });

  it("returns an empty map when the backend reports an error response", async () => {
    api.mockResolvedValue({ data: { errors: "Either productId or sku are required." } });
    hasError.mockReturnValue(true);

    const { fetchProductOnlineAtpMap } = await import("../src/composables/useChannelInventory");
    const onlineAtpByProduct = await fetchProductOnlineAtpMap({
      productStoreId: "STORE",
      facilityGroupId: "FAC_GRP",
      productIds: ["SKU_1"],
    });

    expect(onlineAtpByProduct).toEqual({});
    expect(loggerError).toHaveBeenCalled();
  });
});

describe("mergeOnlineAtpIntoRows", () => {
  it("attaches fetched values, keeping zero, and nulls rows without a value", async () => {
    const { mergeOnlineAtpIntoRows } = await import("../src/composables/useChannelInventory");
    const rows = [
      { productId: "SKU_1", inventoryConfig: { minimumStock: 3 } },
      { productId: "SKU_2", inventoryConfig: { minimumStock: 1 } },
      { productId: "SKU_3", inventoryConfig: { minimumStock: 0 } },
    ];

    const merged = mergeOnlineAtpIntoRows(rows, { SKU_1: 42, SKU_2: 0 });

    expect(merged).toEqual([
      { productId: "SKU_1", inventoryConfig: { minimumStock: 3 }, onlineAtp: 42 },
      { productId: "SKU_2", inventoryConfig: { minimumStock: 1 }, onlineAtp: 0 },
      { productId: "SKU_3", inventoryConfig: { minimumStock: 0 }, onlineAtp: null },
    ]);
    // Rows are replaced, not mutated, so a stale-guarded caller can drop the result safely.
    expect(rows[0]).not.toHaveProperty("onlineAtp");
  });
});
