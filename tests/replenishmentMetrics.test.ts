import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();
const loggerError = vi.fn();

vi.mock("@common", () => ({
  api: (...args: any[]) => api(...args),
  logger: { error: (...args: any[]) => loggerError(...args) }
}));

import { useReplenishmentMetrics } from "../src/composables/useReplenishmentMetrics";
import {
  buildTrendPoints,
  calculatePurchaseOrderIncomingUnits,
  calculateSalesVelocity,
  calculateTransferOrderIncomingUnits
} from "../src/utils/replenishmentMetrics";

describe("replenishment metrics", () => {
  beforeEach(() => {
    api.mockReset();
    loggerError.mockReset();
  });

  it("builds trend points from availableToPromiseTotal before fallback values", () => {
    const points = buildTrendPoints([
      {
        effectiveDate: "2026-06-30T00:00:00Z",
        availableToPromiseTotal: "12",
        lastAvailableToPromise: "99",
        availableToPromiseDiff: "-3"
      }
    ]);

    expect(points).toEqual([
      {
        timestamp: Date.parse("2026-06-30T00:00:00Z"),
        atp: 12
      }
    ]);
  });

  it("uses lastAvailableToPromise plus availableToPromiseDiff as the ATP trend fallback", () => {
    const points = buildTrendPoints([
      {
        effectiveDate: "2026-06-30T00:00:00Z",
        lastAvailableToPromise: "12",
        availableToPromiseDiff: "-5"
      }
    ]);

    expect(points[0]?.atp).toBe(7);
  });

  it("calculates sales velocity only from negative ATP rows joined to SALES_ORDER summaries", () => {
    const now = Date.parse("2026-07-01T00:00:00Z");
    const velocity = calculateSalesVelocity(
      [
        {
          effectiveDate: "2026-06-30T00:00:00Z",
          availableToPromiseDiff: "-9",
          orderId: "SO_1"
        },
        {
          effectiveDate: "2026-06-30T00:00:00Z",
          availableToPromiseDiff: "-5",
          orderId: "TO_1"
        },
        {
          effectiveDate: "2026-06-30T00:00:00Z",
          availableToPromiseDiff: "4",
          orderId: "SO_2"
        },
        {
          effectiveDate: "2026-05-01T00:00:00Z",
          availableToPromiseDiff: "-6",
          orderId: "SO_3"
        }
      ],
      {
        SO_1: { orderId: "SO_1", orderTypeId: "SALES_ORDER" },
        TO_1: { orderId: "TO_1", orderTypeId: "TRANSFER_ORDER" },
        SO_2: { orderId: "SO_2", orderTypeId: "SALES_ORDER" },
        SO_3: { orderId: "SO_3", orderTypeId: "SALES_ORDER" }
      },
      now,
      30
    );

    expect(velocity).toBe(0.3);
  });

  it("calculates incoming transfer remaining quantity from quantity minus totalReceivedQuantity", () => {
    const incomingUnits = calculateTransferOrderIncomingUnits(
      {
        orderItems: [
          {
            productId: "M101717",
            orderFacilityId: "CENTRAL_WAREHOUSE",
            quantity: "10",
            totalReceivedQuantity: "3",
            statusId: "ITEM_PENDING_RECEIPT"
          },
          {
            productId: "M101717",
            orderFacilityId: "CENTRAL_WAREHOUSE",
            quantity: "5",
            totalReceivedQuantity: "5",
            statusId: "ITEM_PENDING_RECEIPT"
          },
          {
            productId: "M101717",
            orderFacilityId: "REMOTE_WAREHOUSE",
            quantity: "4",
            totalReceivedQuantity: "0",
            statusId: "ITEM_PENDING_RECEIPT"
          }
        ]
      },
      "M101717",
      "CENTRAL_WAREHOUSE"
    );

    expect(incomingUnits).toBe(7);
  });

  it("uses the first populated transfer item and ship group collections to avoid double counting", () => {
    const incomingUnits = calculateTransferOrderIncomingUnits(
      {
        orderItems: [
          {
            productId: "M101717",
            shipGroupSeqId: "00001",
            quantity: "6",
            totalReceivedQuantity: "1",
            statusId: "ITEM_APPROVED"
          }
        ],
        order: {
          orderItems: [
            {
              productId: "M101717",
              shipGroupSeqId: "00001",
              quantity: "6",
              totalReceivedQuantity: "1",
              statusId: "ITEM_APPROVED"
            }
          ],
          shipGroups: [
            {
              shipGroupSeqId: "00001",
              orderFacilityId: "CENTRAL_WAREHOUSE"
            }
          ]
        },
        shipGroups: [
          {
            shipGroupSeqId: "00001",
            orderFacilityId: "CENTRAL_WAREHOUSE"
          }
        ]
      },
      "M101717",
      "CENTRAL_WAREHOUSE"
    );

    expect(incomingUnits).toBe(5);
  });

  it("calculates incoming purchase quantity from availableToPromise with quantity fallback", () => {
    const incomingUnits = calculatePurchaseOrderIncomingUnits(
      {
        order: { originFacilityId: "CENTRAL_WAREHOUSE" },
        orderItems: [
          {
            productId: "M101717",
            availableToPromise: "4",
            quantity: "10",
            statusId: "ITEM_APPROVED"
          },
          {
            productId: "M101717",
            quantity: "6",
            statusId: "ITEM_APPROVED"
          },
          {
            productId: "M101717",
            quantity: "2",
            statusId: "ITEM_CANCELLED"
          }
        ]
      },
      "M101717",
      "CENTRAL_WAREHOUSE"
    );

    expect(incomingUnits).toBe(10);
  });

  it("marks incoming units unavailable when candidate or detail lookup fails", async () => {
    api
      .mockResolvedValueOnce({
        data: {
          response: {
            docs: [
              {
                orderId: "PO100",
                orderTypeId: "PURCHASE_ORDER"
              }
            ]
          }
        }
      })
      .mockRejectedValueOnce(new Error("detail failed"));

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();

    await refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: []
    });

    expect(api).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: "admin/runSolrQuery",
      method: "POST"
    }));
    expect(api.mock.calls[0][0].data.json.filter).toContain('facilityId: "CENTRAL_WAREHOUSE"');
    expect(api).toHaveBeenNthCalledWith(2, {
      url: "oms/purchaseOrders/PO100",
      method: "GET"
    });
    expect(api.mock.calls.some(([request]) => request.url === "solr-query")).toBe(false);
    expect(metrics.incomingUnavailable).toBe(true);
    expect(metrics.incomingUnits).toBe(0);
    expect(metrics.loading).toBe(false);
  });

  it("deduplicates incoming candidates and fetches order details in parallel", async () => {
    api
      .mockResolvedValueOnce({
        data: {
          response: {
            docs: [
              {
                orderId: "PO100",
                orderTypeId: "PURCHASE_ORDER"
              },
              {
                orderId: "PO100",
                orderTypeId: "PURCHASE_ORDER"
              },
              {
                orderId: "TO200",
                orderTypeId: "TRANSFER_ORDER"
              }
            ]
          }
        }
      })
      .mockImplementation((request: any) => {
        if (request.url === "oms/purchaseOrders/PO100") {
          return Promise.resolve({
            data: {
              order: { originFacilityId: "CENTRAL_WAREHOUSE" },
              orderItems: [
                {
                  productId: "M101717",
                  availableToPromise: "4",
                  statusId: "ITEM_APPROVED"
                }
              ]
            }
          });
        }

        if (request.url === "oms/transferOrders/TO200") {
          return Promise.resolve({
            data: {
              orderItems: [
                {
                  productId: "M101717",
                  orderFacilityId: "CENTRAL_WAREHOUSE",
                  quantity: "8",
                  totalReceivedQuantity: "3",
                  statusId: "ITEM_PENDING_RECEIPT"
                }
              ]
            }
          });
        }

        return Promise.resolve({ data: { response: { docs: [] } } });
      });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();

    await refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: []
    });

    expect(api.mock.calls.filter(([request]) => request.url === "oms/purchaseOrders/PO100")).toHaveLength(1);
    expect(api.mock.calls.filter(([request]) => request.url === "oms/transferOrders/TO200")).toHaveLength(1);
    expect(metrics.incomingUnits).toBe(9);
  });

  it("coalesces in-flight order detail requests across concurrent refreshes", async () => {
    let resolveDetail: (value: any) => void;
    const detailPromise = new Promise((resolve) => {
      resolveDetail = resolve;
    });

    api.mockImplementation((request: any) => {
      if (request.url === "admin/runSolrQuery") {
        return Promise.resolve({
          data: {
            response: {
              docs: [
                {
                  orderId: "TO200",
                  orderTypeId: "TRANSFER_ORDER"
                }
              ]
            }
          }
        });
      }

      if (request.url === "oms/transferOrders/TO200") {
        return detailPromise;
      }

      return Promise.resolve({ data: {} });
    });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    const payload = {
      productId: "M101717",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: []
    };

    const firstRefresh = refreshReplenishmentMetrics(payload);
    const secondRefresh = refreshReplenishmentMetrics(payload);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.mock.calls.filter(([request]) => request.url === "oms/transferOrders/TO200")).toHaveLength(1);

    resolveDetail!({
      data: {
        orderItems: [
          {
            productId: "M101717",
            orderFacilityId: "CENTRAL_WAREHOUSE",
            quantity: "8",
            totalReceivedQuantity: "3",
            statusId: "ITEM_PENDING_RECEIPT"
          }
        ]
      }
    });

    await Promise.all([firstRefresh, secondRefresh]);

    expect(api.mock.calls.filter(([request]) => request.url === "oms/transferOrders/TO200")).toHaveLength(1);
    expect(metrics.incomingUnits).toBe(5);
  });
});
