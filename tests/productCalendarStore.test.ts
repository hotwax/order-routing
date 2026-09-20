import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const api = vi.hoisted(() => vi.fn());
const hasError = vi.hoisted(() => vi.fn(() => false));

vi.mock("@common", () => ({
  api,
  commonUtil: { hasError },
  logger: { error: vi.fn() },
}));

import { useProductCalendarStore } from "../src/store/productCalendarStore";

describe("productCalendarStore ProductStore scope", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.mockReset();
    hasError.mockReset();
    hasError.mockReturnValue(false);
  });

  it("does not fetch shops without a ProductStore scope", async () => {
    const store = useProductCalendarStore();
    store.shops = [{ shopId: "STALE" }];

    await expect(store.fetchShops("")).resolves.toEqual([]);

    expect(api).not.toHaveBeenCalled();
    expect(store.shops).toEqual([]);
  });

  it("rejects a Shopify mapping that targets a non-calendar field", async () => {
    const store = useProductCalendarStore();

    await expect(store.saveMapping({
      shopId: "SHOP_1",
      mappedKey: "productCategoryId",
      mappedValue: "launch:date",
    })).rejects.toThrow("Unsupported product calendar field");

    expect(api).not.toHaveBeenCalled();
  });

  it("retains all four lifecycle dates returned for the selected ProductStore", async () => {
    const row = {
      productStoreId: "STORE_1",
      productId: "PRODUCT_1",
      introductionDate: "2026-09-01T00:00:00Z",
      releaseDate: "2026-09-15T00:00:00Z",
      supportDiscontinuationDate: "2027-03-01T00:00:00Z",
      salesDiscontinuationDate: "2027-06-01T00:00:00Z",
    };
    api.mockResolvedValueOnce({ data: { docs: [row] } });
    const store = useProductCalendarStore();

    await expect(store.fetchCalendar("STORE_1")).resolves.toEqual([row]);

    expect(api).toHaveBeenCalledWith({
      url: "/oms/productStoreProductCalendar",
      method: "GET",
      params: { productStoreId: "STORE_1", pageSize: 500, orderByField: "productId" },
    });
  });

  it("writes a valid Shopify selector as a Product Calendar date mapping", async () => {
    api
      .mockResolvedValueOnce({ data: { shopId: "SHOP_1", mappedKey: "releaseDate" } })
      .mockResolvedValueOnce({ data: [] });
    const store = useProductCalendarStore();

    await store.saveMapping({
      shopId: "SHOP_1",
      mappedKey: "releaseDate",
      mappedValue: "launch:date",
    });

    expect(api).toHaveBeenNthCalledWith(1, {
      url: "/sob/shopify/typeMappings",
      method: "POST",
      data: {
        shopId: "SHOP_1",
        mappedTypeId: "SHOPIFY_PRODUCT_CALENDAR_DATE",
        mappedKey: "releaseDate",
        mappedValue: "launch:date",
      },
    });
  });
});
