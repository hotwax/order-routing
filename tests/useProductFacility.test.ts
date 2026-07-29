import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@common", () => ({
  api: mocks.api,
  logger: { error: mocks.loggerError },
}));

import { useProductFacility } from "../src/composables/useProductFacility";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });

  return { promise, resolve };
}

describe("useProductFacility request ordering", () => {
  beforeEach(() => {
    mocks.api.mockReset();
    mocks.loggerError.mockReset();
  });

  it("ignores an older response that arrives after the current scope", async () => {
    const older = deferred<any>();
    mocks.api
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce({ data: { products: [{ productId: "NEW" }], totalCount: 1 } });

    const productFacilityApi = useProductFacility();
    const olderRequest = productFacilityApi.fetchProductFacility({ facilityId: "OLD" });
    const currentTotal = await productFacilityApi.fetchProductFacility({ facilityId: "NEW" });

    older.resolve({ data: { products: [{ productId: "OLD" }], totalCount: 99 } });

    expect(await olderRequest).toBeUndefined();
    expect(currentTotal).toBe(1);
    expect(productFacilityApi.productFacility.value).toEqual([{ productId: "NEW" }]);
  });

  it("invalidates an in-flight response when the current scope is cleared", async () => {
    const pending = deferred<any>();
    mocks.api.mockReturnValueOnce(pending.promise);

    const productFacilityApi = useProductFacility();
    const request = productFacilityApi.fetchProductFacility({ facilityId: "OLD" });
    productFacilityApi.clearProductFacility();
    pending.resolve({ data: { products: [{ productId: "OLD" }], totalCount: 1 } });

    expect(await request).toBeUndefined();
    expect(productFacilityApi.productFacility.value).toEqual([]);
  });

  it("logs only the safe error message when a product facility request fails", async () => {
    const requestError = Object.assign(new Error("Request failed with status code 400"), {
      config: { headers: { Authorization: "sensitive transport metadata" } },
    });
    mocks.api.mockRejectedValueOnce(requestError);

    const productFacilityApi = useProductFacility();
    expect(await productFacilityApi.fetchProductFacility({ facilityId: "FACILITY" })).toBe(0);

    expect(mocks.loggerError).toHaveBeenCalledWith(
      "Failed to fetch product facility records",
      "Request failed with status code 400",
    );
  });
});
