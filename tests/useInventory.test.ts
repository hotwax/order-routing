import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@common", () => ({
  api: mocks.api,
  logger: { error: mocks.loggerError },
}));

import { formatUserName, useInventory } from "../src/composables/useInventory";

describe("user identity formatting", () => {
  it("prefers a person's full name over a group name", () => {
    expect(formatUserName({ firstName: "Ada", lastName: "Lovelace", groupName: "Administrators" })).toBe("Ada Lovelace");
    expect(formatUserName({ groupName: "Administrators" })).toBe("Administrators");
  });

  it("shows the login ID together with the resolved full name", async () => {
    mocks.api.mockResolvedValueOnce({
      data: [{ userLoginId: "ada.lovelace", firstName: "Ada", lastName: "Lovelace" }],
    });

    const inventoryApi = useInventory();
    await inventoryApi.resolveNames(["ada.lovelace"]);

    expect(inventoryApi.displayIdentity("ada.lovelace")).toBe("ada.lovelace (Ada Lovelace)");
    expect(inventoryApi.displayIdentity("unknown.user")).toBe("unknown.user");
  });
});

describe("useInventory fetchVarianceAudit", () => {
  beforeEach(() => {
    mocks.api.mockReset();
    mocks.loggerError.mockReset();
  });

  it("requests the nested inventoryItem variances endpoint with physicalInventoryId and pageSize", async () => {
    mocks.api.mockResolvedValueOnce({
      data: [
        {
          inventoryItemId: "INV1001",
          physicalInventoryId: "PI500",
          changeByUserLoginId: "test.user",
          varianceReasonId: "VAR_FOUND",
          comments: "Found stock",
          quantityOnHandVar: 5,
          availableToPromiseVar: 5,
        },
      ],
    });

    const inventoryApi = useInventory();
    const result = await inventoryApi.fetchVarianceAudit("INV1001", "PI500");

    expect(mocks.api).toHaveBeenCalledWith({
      url: "/oms/inventoryItem/INV1001/variances",
      method: "GET",
      params: { physicalInventoryId: "PI500", pageSize: 1 },
    });

    expect(result).toEqual({
      changeByUserLoginId: "test.user",
      varianceReasonId: "VAR_FOUND",
      comments: "Found stock",
      quantityOnHandVar: 5,
      availableToPromiseVar: 5,
    });
  });

  it("encodes inventoryItemId when it contains special characters", async () => {
    mocks.api.mockResolvedValueOnce({
      data: {
        list: [
          {
            changeByUserLoginId: "admin",
            comments: "Adjusted",
          },
        ],
      },
    });

    const inventoryApi = useInventory();
    await inventoryApi.fetchVarianceAudit("INV/100#1", "PI501");

    expect(mocks.api).toHaveBeenCalledWith({
      url: "/oms/inventoryItem/INV%2F100%231/variances",
      method: "GET",
      params: { physicalInventoryId: "PI501", pageSize: 1 },
    });
  });

  it("returns null without calling the API if inventoryItemId or physicalInventoryId is missing", async () => {
    const inventoryApi = useInventory();
    expect(await inventoryApi.fetchVarianceAudit("", "PI500")).toBeNull();
    expect(await inventoryApi.fetchVarianceAudit("INV1001", "")).toBeNull();
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it("caches the result by inventoryItemId and physicalInventoryId", async () => {
    mocks.api.mockResolvedValueOnce({
      data: [
        {
          changeByUserLoginId: "cached.user",
          comments: "Cached variance",
        },
      ],
    });

    const inventoryApi = useInventory();
    const first = await inventoryApi.fetchVarianceAudit("INV1001", "PI500");
    const second = await inventoryApi.fetchVarianceAudit("INV1001", "PI500");

    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });
});
