import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());

vi.mock("@common", () => ({
  api,
  logger: { error: loggerError },
}));

import { useReplenishmentMetrics } from "../src/composables/useReplenishmentMetrics";
import {
  buildTrendPoints,
  calculatePurchaseOrderIncomingUnits,
  calculateSalesVelocity,
  calculateTransferOrderIncomingUnits,
} from "../src/utils/replenishmentMetrics";

describe("replenishment metrics", () => {
  beforeEach(() => {
    api.mockReset();
    loggerError.mockReset();
  });

  it("orders trend points by the displayed history date and prefers post-movement ATP", () => {
    expect(buildTrendPoints([
      {
        createdStamp: "2026-09-02T00:00:00Z",
        availableToPromiseTotal: "12",
        lastAvailableToPromise: "99",
        availableToPromiseDiff: "-3",
      },
      {
        effectiveDate: "2026-09-01T00:00:00Z",
        lastAvailableToPromise: "12",
        availableToPromiseDiff: "-5",
      },
    ])).toEqual([
      { timestamp: Date.parse("2026-09-01T00:00:00Z"), atp: 7 },
      { timestamp: Date.parse("2026-09-02T00:00:00Z"), atp: 12 },
    ]);
  });

  it("counts only sales-order ATP decreases inside the rolling window", () => {
    const velocity = calculateSalesVelocity([
      { createdStamp: "2026-09-30T00:00:00Z", availableToPromiseDiff: "-9", orderId: "SO_1" },
      { createdStamp: "2026-09-30T00:00:00Z", availableToPromiseDiff: "-5", orderId: "TO_1" },
      { createdStamp: "2026-09-30T00:00:00Z", availableToPromiseDiff: "4", orderId: "SO_2" },
      { createdStamp: "2026-08-01T00:00:00Z", availableToPromiseDiff: "-6", orderId: "SO_3" },
    ], {
      SO_1: { orderId: "SO_1", orderTypeId: "SALES_ORDER" },
      TO_1: { orderId: "TO_1", orderTypeId: "TRANSFER_ORDER" },
      SO_2: { orderId: "SO_2", orderTypeId: "SALES_ORDER" },
      SO_3: { orderId: "SO_3", orderTypeId: "SALES_ORDER" },
    }, "2026-10-01T00:00:00Z", 30);

    expect(velocity).toBe(0.3);
  });

  it("counts eligible purchase-order availability at the receiving facility", () => {
    expect(calculatePurchaseOrderIncomingUnits({
      order: {
        originFacilityId: "CENTRAL_WAREHOUSE",
        items: [
          { productId: "M101717", availableToPromise: "4", quantity: "10", statusId: "ITEM_APPROVED" },
          { productId: "M101717", quantity: "6", statusId: "ITEM_APPROVED" },
          { productId: "M101717", quantity: "2", statusId: "ITEM_CANCELLED" },
        ],
      },
    }, "M101717", "CENTRAL_WAREHOUSE")).toBe(10);
  });

  it("counts transfer units remaining for the selected destination", () => {
    expect(calculateTransferOrderIncomingUnits({
      order: {
        items: [
          { productId: "M101717", orderFacilityId: "CENTRAL_WAREHOUSE", quantity: "10", totalReceivedQuantity: "3", statusId: "ITEM_PENDING_RECEIPT" },
          { productId: "M101717", orderFacilityId: "CENTRAL_WAREHOUSE", quantity: "5", totalReceivedQuantity: "5", statusId: "ITEM_PENDING_RECEIPT" },
          { productId: "M101717", shipGroupSeqId: "00001", quantity: "6", totalReceivedQuantity: "1", statusId: "ITEM_APPROVED" },
          { productId: "M101717", orderFacilityId: "REMOTE_WAREHOUSE", quantity: "4", totalReceivedQuantity: "0", statusId: "ITEM_PENDING_RECEIPT" },
        ],
        shipGroups: [{ shipGroupSeqId: "00001", orderFacilityId: "CENTRAL_WAREHOUSE" }],
      },
    }, "M101717", "CENTRAL_WAREHOUSE")).toBe(12);
  });

  it("leaves trend metrics available when incoming-order lookup fails", async () => {
    api.mockRejectedValueOnce(new Error("incoming search unavailable"));

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    await refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: [{ createdStamp: "2026-09-30T00:00:00Z", availableToPromiseTotal: "12" }],
    });

    expect(metrics.trendPoints).toEqual([{ timestamp: Date.parse("2026-09-30T00:00:00Z"), atp: 12 }]);
    expect(metrics.incomingUnavailable).toBe(true);
    expect(metrics.incomingUnits).toBe(0);
    expect(metrics.loading).toBe(false);
  });

  it("reads grouped sales-order summaries from the native search response", async () => {
    api
      .mockResolvedValueOnce({
        data: {
          response: {
            grouped: {
              orderId: {
                groups: [{ doclist: { docs: [{ orderId: "SO100", orderTypeId: "SALES_ORDER" }] } }],
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({ data: { response: { response: { docs: [] } } } });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    await refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: [{ createdStamp: "2026-09-30T00:00:00Z", availableToPromiseDiff: "-9", orderId: "SO100" }],
      now: "2026-10-01T00:00:00Z",
    });

    expect(metrics.salesVelocityUnitsPerDay).toBe(0.3);
    expect(api.mock.calls[0][0]).toMatchObject({
      url: "admin/search/query",
      data: {
        params: { group: true, "group.field": "orderId" },
        filter: expect.stringContaining('orderId: ("SO100")'),
      },
    });
    expect(api.mock.calls[0][0].data).not.toHaveProperty("json");
  });

  it("reuses cached order details when later refreshes find the same incoming order", async () => {
    api.mockImplementation((request: { url: string }) => {
      if(request.url === "admin/search/query") {
        return Promise.resolve({ data: { response: { response: { docs: [{ orderId: "PO100", orderTypeId: "PURCHASE_ORDER" }] } } } });
      }
      if(request.url === "oms/purchaseOrders/PO100") {
        return Promise.resolve({
          data: {
            order: {
              originFacilityId: "CENTRAL_WAREHOUSE",
              items: [{ productId: "M101717", availableToPromise: "4", statusId: "ITEM_APPROVED" }],
            },
          },
        });
      }
      return Promise.resolve({ data: { response: { docs: [] } } });
    });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    const payload = { productId: "M101717", facilityId: "CENTRAL_WAREHOUSE", inventoryRows: [] };
    await refreshReplenishmentMetrics(payload);
    await refreshReplenishmentMetrics(payload);

    expect(metrics.incomingUnits).toBe(4);
    const searchRequests = api.mock.calls.filter(([request]) => request.url === "admin/search/query");
    expect(searchRequests).toHaveLength(2);
    expect(searchRequests[0][0].data).toMatchObject({
      query: "*:*",
      filter: expect.stringContaining("docType: ORDER"),
    });
    expect(searchRequests[0][0].data).not.toHaveProperty("json");
    expect(api.mock.calls.filter(([request]) => request.url === "oms/purchaseOrders/PO100")).toHaveLength(1);
  });
});
