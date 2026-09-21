import { buildAppUrl } from "@common";

export function productCalendarHref(productStoreId: string | undefined) {
  return buildAppUrl("products", "/product-calendar", { productStoreId });
}
