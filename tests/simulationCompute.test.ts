import { describe, expect, it } from "vitest";
import {
  applyProductStoreId,
  buildVariant,
  chunkVariants,
  diffParameters,
  diffRoutings,
  interpretJobStatus,
  isFilteredQuery,
  isNoOp,
  mergeEvents,
  mergeVariationResults,
  pastSimulationsQuery,
} from "@/utils/simulationCompute";

const routing = () => ({
  orderRoutingId: "R1",
  routingName: "Primary",
  sequenceNum: 1,
  orderFilters: [{ fieldName: "salesChannelEnumId", fieldValue: "WEB" }],
  rules: [{
    routingRuleId: "RULE1",
    orderRoutingId: "R1",
    sequenceNum: 1,
    inventoryFilters: [{ fieldName: "atp", fieldValue: 0 }],
    actions: [{ actionTypeEnumId: "ORA_MV_TO_QUEUE", actionValue: "QUEUE_A" }],
  }],
});

describe("simulation configuration changes", () => {
  it("emits only meaningful scalar and ordering changes", () => {
    expect(diffParameters(
      { distance: 50, inventorySortByList: ["A", "B"] },
      { distance: 100, inventorySortByList: ["B", "A"] },
    )).toEqual({ distance: 100, inventorySortByList: ["B", "A"] });
  });

  it("captures edits, removals, and additions without changing the source routing", () => {
    const baseline = { routings: [routing()] };
    const snapshot = structuredClone(baseline);
    snapshot.routings[0].orderFilters = [];
    snapshot.routings[0].rules[0].actions[0] = {
      actionTypeEnumId: "ORA_BROKER",
      actionValue: "FAC_A",
    };
    snapshot.routings[0].rules.push({
      orderRoutingId: "R1",
      sequenceNum: 2,
      inventoryFilters: [],
      actions: [{ actionTypeEnumId: "ORA_BROKER", actionValue: "FAC_B" }],
    } as any);

    expect(diffRoutings(baseline, snapshot)).toEqual([
      { op: "SET_ROUTING_FILTER", orderRoutingId: "R1", fieldName: "salesChannelEnumId", fieldValue: null },
      { op: "SET_RULE_ACTION", routingRuleId: "RULE1", actionTypeEnumId: "ORA_BROKER", actionValue: "FAC_A" },
      expect.objectContaining({ op: "ADD_RULE", orderRoutingId: "R1" }),
    ]);
    expect(baseline.routings[0].orderFilters).toHaveLength(1);
  });

  it("filters no-op proposals and scopes submitted variants without mutation", () => {
    const baseline = { distance: 50, routings: [routing()] };
    const unchanged = buildVariant("No change", baseline, structuredClone(baseline));
    const changed = buildVariant("Tighter distance", baseline, { ...baseline, distance: 25 });

    expect(isNoOp(unchanged)).toBe(true);
    expect(isNoOp(changed)).toBe(false);

    const scoped = applyProductStoreId([changed], "STORE");
    expect(scoped[0].parameterOverrides).toEqual({ distance: 25, productStoreId: "STORE" });
    expect(changed.parameterOverrides).toEqual({ distance: 25 });
  });
});

describe("simulation job orchestration helpers", () => {
  it("batches variants and merges the backend's nested baseline shape", () => {
    expect(chunkVariants([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);

    const merged = mergeVariationResults([
      {
        variation: {
          baseline: { groupRun: { attemptedItemCount: 100, brokeredItemCount: 80 } },
          variants: [{ label: "A" }],
          simulationRan: true,
        },
      },
      null,
      { variation: { variants: [{ label: "B" }] } },
    ]);

    expect(merged.baseline).toEqual({ attemptedItemCount: 100, brokeredItemCount: 80 });
    expect(merged.variants.map((variant) => variant.label)).toEqual(["A", "B"]);
    expect(merged.partial).toBe(true);
  });

  it("keeps only the newest progress events", () => {
    const event = (seq: number) => ({ seq, orderId: `O${seq}`, facilityId: null, finalReason: "QUEUED" } as any);
    expect(mergeEvents([event(1), event(2)], [event(3), event(4)], 3).map(({ seq }) => seq))
      .toEqual([2, 3, 4]);
  });

  it("turns terminal job states into actionable results or errors", () => {
    expect(interpretJobStatus({ jobId: "j", status: "running" })).toEqual({ done: false });
    expect(interpretJobStatus({ jobId: "j", status: "complete", groupRun: { brokeredItemCount: 3 } }))
      .toEqual({ done: true, result: { groupRun: { brokeredItemCount: 3 } } });
    expect(interpretJobStatus({ jobId: "j", status: "not_found" }))
      .toEqual({ done: true, error: "Simulation job expired before it completed. Please re-run." });
  });

  it("builds a store-scoped history query and detects optional filters", () => {
    const filters = {
      productStoreId: "STORE",
      statusId: "FAILED",
      pageIndex: 1,
      pageSize: 25,
    };

    expect(pastSimulationsQuery(filters)).toEqual({
      productStoreId: "STORE",
      statusId: "FAILED",
      orderByField: "-createdDate",
      pageIndex: 1,
      pageSize: 25,
    });
    expect(isFilteredQuery(filters)).toBe(true);
    expect(isFilteredQuery({ productStoreId: "STORE", pageIndex: 0, pageSize: 25 })).toBe(false);
  });
});
