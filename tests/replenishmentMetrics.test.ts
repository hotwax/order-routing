import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());
const runSolrQuery = vi.hoisted(() => vi.fn());

vi.mock("@common", () => ({
  api,
  logger: { error: loggerError },
  useSolrSearch: () => ({ runSolrQuery }),
}));

import { useReplenishmentMetrics } from "../src/composables/useReplenishmentMetrics";
import {
  buildTrendPoints,
  calculatePurchaseOrderIncomingUnits,
  calculateSalesVelocity,
  calculateTransferOrderIncomingUnits,
  formatUnitsPerDay,
} from "../src/utils/replenishmentMetrics";
import * as replenishmentMetricUtils from "../src/utils/replenishmentMetrics";

describe("replenishment metrics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    api.mockReset();
    loggerError.mockReset();
    runSolrQuery.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("orders trend points by the displayed history date and uses each movement's backend balance", () => {
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
      { timestamp: Date.parse("2026-09-02T00:00:00Z"), atp: 96 },
    ]);
  });

  it("keeps ATP history points inside the displayed 30-day window", () => {
    expect(buildTrendPoints([
      {
        createdStamp: "2026-08-18T00:00:00Z",
        lastAvailableToPromise: "100",
        availableToPromiseDiff: "-2",
      },
      {
        createdStamp: "2026-08-20T00:00:00Z",
        lastAvailableToPromise: "98",
        availableToPromiseDiff: "-3",
      },
      {
        createdStamp: "2026-09-18T00:00:00Z",
        lastAvailableToPromise: "95",
        availableToPromiseDiff: "4",
      },
    ], "2026-09-19T00:00:00Z", 30)).toEqual([
      { timestamp: Date.parse("2026-08-20T00:00:00Z"), atp: 95 },
      { timestamp: Date.parse("2026-09-18T00:00:00Z"), atp: 99 },
    ]);
  });

  it("counts only sales-order QOH decreases inside the rolling window", () => {
    const velocity = calculateSalesVelocity([
      { createdStamp: "2026-09-30T00:00:00Z", quantityOnHandDiff: "-9", orderId: "SO_1" },
      { createdStamp: "2026-09-30T00:00:00Z", quantityOnHandDiff: "-5", orderId: "TO_1" },
      { createdStamp: "2026-09-30T00:00:00Z", quantityOnHandDiff: "4", orderId: "SO_2" },
      { createdStamp: "2026-08-01T00:00:00Z", quantityOnHandDiff: "-6", orderId: "SO_3" },
    ], {
      SO_1: { orderId: "SO_1", orderTypeId: "SALES_ORDER" },
      TO_1: { orderId: "TO_1", orderTypeId: "TRANSFER_ORDER" },
      SO_2: { orderId: "SO_2", orderTypeId: "SALES_ORDER" },
      SO_3: { orderId: "SO_3", orderTypeId: "SALES_ORDER" },
    }, "2026-10-01T00:00:00Z", 30);

    expect(velocity).toBe(0.3);
  });

  it("uses completed or shipped units instead of inventory reservations for sales velocity", () => {
    const calculateSalesVelocityBreakdown = (replenishmentMetricUtils as any).calculateSalesVelocityBreakdown;

    expect(calculateSalesVelocityBreakdown([
      { createdStamp: "2026-09-30T00:00:00Z", quantityOnHandDiff: "-3", availableToPromiseDiff: "0", orderId: "POS_STORE" },
      { createdStamp: "2026-09-30T00:00:00Z", quantityOnHandDiff: "-2", availableToPromiseDiff: "0", orderId: "POS_SHIP" },
      { createdStamp: "2026-09-30T00:00:00Z", quantityOnHandDiff: "-5", availableToPromiseDiff: "-1", orderId: "ONLINE" },
      { createdStamp: "2026-09-30T00:00:00Z", quantityOnHandDiff: "0", availableToPromiseDiff: "-7", orderId: "RESERVED" },
    ], {
      POS_STORE: { orderId: "POS_STORE", orderTypeId: "SALES_ORDER", salesChannelEnumId: "POS", shipmentMethodTypeId: "STOREPICKUP" },
      POS_SHIP: { orderId: "POS_SHIP", orderTypeId: "SALES_ORDER", salesChannelEnumId: "POS", shipmentMethodTypeId: "STANDARD" },
      ONLINE: { orderId: "ONLINE", orderTypeId: "SALES_ORDER", salesChannelEnumId: "WEB" },
      RESERVED: { orderId: "RESERVED", orderTypeId: "SALES_ORDER", salesChannelEnumId: "WEB" },
    }, "2026-10-01T00:00:00Z", 30)).toEqual({
      inStoreUnits: 3,
      inStoreShipToHomeUnits: 2,
      onlineUnits: 5,
      totalUnits: 10,
      unitsPerDay: 10 / 30,
    });
  });

  it("formats sales velocity without unnecessary decimal noise", () => {
    expect(formatUnitsPerDay(0)).toBe("0");
    expect(formatUnitsPerDay(4)).toBe("4");
    expect(formatUnitsPerDay(1.55)).toBe("1.6");
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
    runSolrQuery.mockRejectedValueOnce(new Error("incoming search unavailable"));

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    await refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: [{ createdStamp: "2026-09-30T00:00:00Z", lastAvailableToPromise: "10", availableToPromiseDiff: "2" }],
    });

    expect(metrics.trendPoints).toEqual([{ timestamp: Date.parse("2026-09-30T00:00:00Z"), atp: 12 }]);
    expect(metrics.incomingUnavailable).toBe(true);
    expect(metrics.incomingUnits).toBe(0);
    expect(metrics.loading).toBe(false);
  });

  it("reads grouped sales-order summaries from the native search response", async () => {
    runSolrQuery
      .mockResolvedValueOnce({
        data: {
          grouped: {
            orderId: {
              groups: [{ doclist: { docs: [{ orderId: "SO100", orderTypeId: "SALES_ORDER" }] } }],
            },
          },
        }
      })
      .mockResolvedValueOnce({ data: { response: { docs: [] } } });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    await refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: [{ createdStamp: "2026-09-30T00:00:00Z", availableToPromiseDiff: "-9", quantityOnHandDiff: "-9", orderId: "SO100" }],
      now: "2026-10-01T00:00:00Z",
    });

    expect(metrics.salesVelocityUnitsPerDay).toBe(0.3);
    expect(runSolrQuery).toHaveBeenCalledWith(expect.objectContaining({
      json: expect.objectContaining({
        params: expect.objectContaining({ group: true, "group.field": "orderId" }),
        filter: expect.stringContaining('orderId: ("SO100")'),
      }),
    }));
  });

  it("treats a search response without the native result envelope as empty", async () => {
    runSolrQuery
      .mockResolvedValueOnce({ data: { docs: [{ orderId: "SO100", orderTypeId: "SALES_ORDER" }] } })
      .mockResolvedValueOnce({ data: { response: { docs: [] } } });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    await refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "CENTRAL_WAREHOUSE",
      inventoryRows: [{ createdStamp: "2026-09-30T00:00:00Z", availableToPromiseDiff: "-9", orderId: "SO100" }],
      now: "2026-10-01T00:00:00Z",
    });

    expect(metrics.salesVelocityUnitsPerDay).toBe(0);
  });

  it("reuses cached order details when later refreshes find the same incoming order", async () => {
    runSolrQuery.mockResolvedValue({ data: { response: { docs: [{ orderId: "PO100", orderTypeId: "PURCHASE_ORDER" }] } } });
    api.mockImplementation((request: { url: string }) => {
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
      return Promise.resolve({ data: {} });
    });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    const payload = { productId: "M101717", facilityId: "CENTRAL_WAREHOUSE", inventoryRows: [] };
    await refreshReplenishmentMetrics(payload);
    await refreshReplenishmentMetrics(payload);

    expect(metrics.incomingUnits).toBe(4);
    expect(runSolrQuery).toHaveBeenCalledTimes(2);
    expect(runSolrQuery.mock.calls[0][0].json).toMatchObject({
      query: "*:*",
      filter: expect.stringContaining("docType: ORDER"),
    });
    expect(api.mock.calls.filter(([request]) => request.url === "oms/purchaseOrders/PO100")).toHaveLength(1);
  });

  it("includes expected return shipments while exposing transfer rows for the inbound drill-down", async () => {
    runSolrQuery.mockResolvedValue({
      data: {
        response: {
          docs: [{ orderId: "TO100", orderName: "TO-100", orderTypeId: "TRANSFER_ORDER" }],
        },
      },
    });
    api.mockImplementation((request: { url: string }) => {
      if(request.url === "oms/transferOrders/TO100") {
        return Promise.resolve({
          data: {
            order: {
              facilityId: "SOURCE_STORE",
              items: [{ productId: "M101717", quantity: "7", totalReceivedQuantity: "2", statusId: "ITEM_PENDING_RECEIPT", orderFacilityId: "CENTRAL_WAREHOUSE" }],
            },
          },
        });
      }
      if(request.url === "oms/returnShipments") {
        return Promise.resolve({ data: { returnShipments: [{ shipmentId: "RETURN100" }] } });
      }
      if(request.url === "oms/returnShipments/RETURN100") {
        return Promise.resolve({
          data: {
            items: [{ productId: "M101717", returnQuantity: "4", quantityAccepted: "1" }],
          },
        });
      }
      if(request.url === "oms/inventoryTransfers") {
        return Promise.resolve({ data: [{
          inventoryTransferId: "IT100",
          productId: "M101717",
          facilityId: "SOURCE_STORE",
          facilityIdTo: "CENTRAL_WAREHOUSE",
          quantity: "3",
          statusId: "IXF_REQUESTED",
        }] });
      }
      if(request.url === "oms/facilities/SOURCE_STORE") {
        return Promise.resolve({ data: { facilityId: "SOURCE_STORE", facilityName: "Source Store" } });
      }
      return Promise.resolve({ data: {} });
    });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    await refreshReplenishmentMetrics({ productId: "M101717", facilityId: "CENTRAL_WAREHOUSE", inventoryRows: [] });

    expect(metrics.incomingUnits).toBe(11);
    expect((metrics as any).incomingTransfers).toEqual([{
      orderId: "TO100",
      orderName: "TO-100",
      sourceFacilityId: "SOURCE_STORE",
      sourceFacilityName: "Source Store",
      units: 5,
    }]);
    expect((metrics as any).requestedTransfers).toEqual([{
      inventoryTransferId: "IT100",
      sourceFacilityId: "SOURCE_STORE",
      sourceFacilityName: "Source Store",
      units: 3,
    }]);
  });

  it("keeps metrics for the newest facility refresh when an older incoming lookup finishes late", async () => {
    let resolveFirstCandidates: (value: unknown) => void = () => undefined;
    const firstCandidates = new Promise((resolve) => { resolveFirstCandidates = resolve; });
    let candidateRequests = 0;
    runSolrQuery.mockImplementation(() => {
      candidateRequests += 1;
      if(candidateRequests === 1) {return firstCandidates;}
      return Promise.resolve({ data: { response: { docs: [] } } });
    });
    api.mockImplementation((request: { url: string }) => {
      if(request.url === "oms/purchaseOrders/PO100") {
        return Promise.resolve({
          data: {
            order: {
              originFacilityId: "FIRST",
              items: [{ productId: "M101717", availableToPromise: "5", statusId: "ITEM_APPROVED" }],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    const { metrics, refreshReplenishmentMetrics } = useReplenishmentMetrics();
    const firstRefresh = refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "FIRST",
      inventoryRows: [{ createdStamp: "2026-09-30T00:00:00Z", lastAvailableToPromise: "5", availableToPromiseDiff: "0" }],
    });
    await Promise.resolve();
    await Promise.resolve();
    const secondRefresh = refreshReplenishmentMetrics({
      productId: "M101717",
      facilityId: "SECOND",
      inventoryRows: [{ createdStamp: "2026-10-01T00:00:00Z", lastAvailableToPromise: "9", availableToPromiseDiff: "0" }],
    });

    await secondRefresh;
    resolveFirstCandidates({
      data: { response: { docs: [{ orderId: "PO100", orderTypeId: "PURCHASE_ORDER" }] } },
    });
    await firstRefresh;

    expect(metrics.trendPoints).toEqual([{ timestamp: Date.parse("2026-10-01T00:00:00Z"), atp: 9 }]);
    expect(metrics.incomingUnits).toBe(0);
    expect(metrics.incomingUnavailable).toBe(false);
  });
});
