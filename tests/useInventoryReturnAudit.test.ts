import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@common", () => ({
  api: mocks.api,
  logger: { error: mocks.loggerError },
}));

import { useInventory } from "../src/composables/useInventory";

// Shape returned by sob/returns/{returnId} on rails-oms for return 106068.
const payload = {
  returnDetail: {
    returnId: "106068",
    orderId: "123877",
    orderName: "#996835",
    externalOrderId: "#996835",
    statusId: "RETURN_COMPLETED",
  },
  items: [
    { returnItemSeqId: "01", productId: "142834", orderId: "123877", returnReasonId: "OTHER",
      reasonDescription: "The item is being returned for a different reason.",
      reason: "RAILS POS item refund (#996835)", returnTypeId: "RTN_REFUND", receivedQuantity: 1, returnQuantity: 1 },
    { returnItemSeqId: "02", productId: "141131", orderId: "123877", returnReasonId: "DEFECTIVE",
      reasonDescription: "The item is being returned because of damage or a defect.", receivedQuantity: 2 },
  ],
};

describe("useInventory fetchReturnAudit", () => {
  beforeEach(() => {
    mocks.api.mockReset();
    mocks.loggerError.mockReset();
  });

  it("resolves the order the return was raised against and the customer's reason", async () => {
    mocks.api.mockResolvedValue({ data: payload });

    const audit = await useInventory().fetchReturnAudit("106068", "01");

    expect(mocks.api).toHaveBeenCalledWith(expect.objectContaining({ url: "sob/returns/106068", method: "GET" }));
    expect(audit).toEqual(expect.objectContaining({
      orderName: "#996835",
      orderId: "123877",
      returnReasonId: "OTHER",
      reasonDescription: "The item is being returned for a different reason.",
      receivedQuantity: 1,
    }));
  });

  it("picks the line the movement received, not just the first item", async () => {
    mocks.api.mockResolvedValue({ data: payload });

    const audit = await useInventory().fetchReturnAudit("106068", "02");

    expect(audit?.returnReasonId).toBe("DEFECTIVE");
    expect(audit?.receivedQuantity).toBe(2);
  });

  it("falls back to the only item when the row carries no sequence", async () => {
    mocks.api.mockResolvedValue({ data: { ...payload, items: [payload.items[0]] } });

    const audit = await useInventory().fetchReturnAudit("106068");

    expect(audit?.returnReasonId).toBe("OTHER");
  });

  it("fetches once per return, so sibling rows reuse the payload", async () => {
    mocks.api.mockResolvedValue({ data: payload });
    const inventory = useInventory();

    await inventory.fetchReturnAudit("106068", "01");
    await inventory.fetchReturnAudit("106068", "02");

    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  // sob/returns is served by the Shopify bridge, which is not deployed everywhere — order-manager
  // surfaces the same gap as RETURN_DETAIL_UNAVAILABLE. A miss must degrade quietly, not throw.
  it("returns null when the Shopify bridge is not deployed", async () => {
    mocks.api.mockRejectedValue({ response: { status: 404 } });

    await expect(useInventory().fetchReturnAudit("106068", "01")).resolves.toBeNull();
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("ignores a call with no returnId", async () => {
    await expect(useInventory().fetchReturnAudit("")).resolves.toBeNull();
    expect(mocks.api).not.toHaveBeenCalled();
  });
});
