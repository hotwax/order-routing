// tests/pastSimulationsQuery.test.ts
import assert from "assert";
import { isFilteredQuery, pastSimulationsQuery } from "../src/utils/simulationCompute";

it("builds and classifies past-simulation queries", () => {
// default view: only productStoreId + paging. The service owns the endpoint; this pure helper owns params.
assert.deepStrictEqual(
  pastSimulationsQuery({ productStoreId: "STORE", pageIndex: 0, pageSize: 25 }),
  { productStoreId: "STORE", orderByField: "-createdDate", pageIndex: 0, pageSize: 25 },
  "default query",
);

// filters included only when present.
assert.deepStrictEqual(
  pastSimulationsQuery({ productStoreId: "STORE", routingGroupId: "GRP", statusId: "COMPLETE", runType: "VARIATION", pageIndex: 1, pageSize: 25 }),
  { productStoreId: "STORE", routingGroupId: "GRP", statusId: "COMPLETE", runType: "VARIATION", orderByField: "-createdDate", pageIndex: 1, pageSize: 25 },
  "filtered query",
);

// isFiltered helper: true when any non-store filter is set.
assert.strictEqual(isFilteredQuery({ productStoreId: "STORE", pageIndex: 0, pageSize: 25 }), false, "store-only is not filtered");
assert.strictEqual(isFilteredQuery({ productStoreId: "STORE", statusId: "FAILED", pageIndex: 0, pageSize: 25 }), true, "status is a filter");

console.log("pastSimulationsQuery tests passed");
});
