import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The entity-list endpoint returns the row array as the body and the total only as the X-Total-Count
 * header. A browser can read that header cross-origin only when the server exposes it, so the
 * composable has to cope with it being absent — silently reporting the page size as the total would
 * cap pagination at one page with no visible error.
 */
describe("useProductFacility entity-first rows", () => {
  const apiMock = vi.fn();

  const ROWS = [{ productId: "10001" }, { productId: "10002" }];

  async function loadComposable() {
    vi.resetModules();
    vi.doMock("@common", () => ({ api: apiMock, logger: { error: vi.fn() } }));
    const { useProductFacility } = await import("../src/composables/useProductFacility");

    return useProductFacility();
  }

  beforeEach(() => {
    apiMock.mockReset();
  });

  it("reads the total from the X-Total-Count header", async () => {
    apiMock.mockResolvedValue({ data: ROWS, headers: { "x-total-count": "1738" } });
    const { fetchProductFacilityRows } = await loadComposable();

    const result = await fetchProductFacilityRows({ facilityId: "BROOKLYN" });

    expect(result).toEqual({ rows: ROWS, total: 1738 });
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(apiMock.mock.calls[0][0]).toMatchObject({ url: "oms/productFacilities/inventory", method: "GET" });
  });

  it("falls back to the count resource when the header is not exposed", async () => {
    apiMock
      .mockResolvedValueOnce({ data: ROWS, headers: {} })
      .mockResolvedValueOnce({ data: { count: 1738 } });
    const { fetchProductFacilityRows } = await loadComposable();

    const result = await fetchProductFacilityRows({ facilityId: "BROOKLYN" });

    expect(result).toEqual({ rows: ROWS, total: 1738 });
    expect(apiMock.mock.calls[1][0]).toMatchObject({ url: "oms/productFacilities/inventory/count" });
    // The fallback must carry the same filters, or the total would describe a different result set.
    expect(apiMock.mock.calls[1][0].params).toEqual({ facilityId: "BROOKLYN" });
  });

  it("uses the plain entity when inventory is not wanted", async () => {
    apiMock.mockResolvedValue({ data: ROWS, headers: { "x-total-count": "12" } });
    const { fetchProductFacilityRows } = await loadComposable();

    await fetchProductFacilityRows({ facilityId: "CONFIG_FAC" }, { withInventory: false });

    expect(apiMock.mock.calls[0][0]).toMatchObject({ url: "oms/productFacilities" });
  });

  it("reports an empty result rather than throwing when the request fails", async () => {
    apiMock.mockRejectedValue(new Error("boom"));
    const { fetchProductFacilityRows, productFacility } = await loadComposable();

    const result = await fetchProductFacilityRows({ facilityId: "BROOKLYN" });

    expect(result).toEqual({ rows: [], total: 0 });
    expect(productFacility.value).toEqual([]);
  });

  it("discards a superseded response so a slow request cannot overwrite a newer one", async () => {
    let resolveFirst: any;
    apiMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: [{ productId: "NEW" }], headers: { "x-total-count": "1" } });
    const { fetchProductFacilityRows, productFacility } = await loadComposable();

    const first = fetchProductFacilityRows({ facilityId: "OLD" });
    const second = await fetchProductFacilityRows({ facilityId: "NEW" });
    resolveFirst({ data: ROWS, headers: { "x-total-count": "999" } });

    expect(await first).toBeUndefined();
    expect(second).toEqual({ rows: [{ productId: "NEW" }], total: 1 });
    expect(productFacility.value).toEqual([{ productId: "NEW" }]);
  });
});
