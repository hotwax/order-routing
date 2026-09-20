import { describe, expect, it, vi } from "vitest";

const { buildAppUrl } = vi.hoisted(() => ({
  buildAppUrl: vi.fn(() => "https://products.example/product-calendar?productStoreId=RAILS")
}));

vi.mock("@common", () => ({ buildAppUrl }));

import { productCalendarHref } from "../src/utils/productCalendarNavigation";

describe("product calendar navigation", () => {
  it("opens the ProductStore calendar in the Products app", () => {
    expect(productCalendarHref("RAILS")).toBe("https://products.example/product-calendar?productStoreId=RAILS");
    expect(buildAppUrl).toHaveBeenCalledWith("products", "/product-calendar", { productStoreId: "RAILS" });
  });
});
