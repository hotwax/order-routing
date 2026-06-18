// tests/pastSimulationsQuery.test.ts
import assert from "assert";
import { pastSimulationsQuery } from "../src/services/SimulationService";

// default view: only productStoreId + paging.
assert.deepStrictEqual(
  pastSimulationsQuery({ productStoreId: "STORE", pageIndex: 0, pageSize: 25 }),
  { url: "brokeringSimulations", params: { productStoreId: "STORE", orderByField: "-createdDate", pageIndex: 0, pageSize: 25 } },
  "default query",
);

// filters included only when present.
assert.deepStrictEqual(
  pastSimulationsQuery({ productStoreId: "STORE", routingGroupId: "GRP", statusId: "COMPLETE", runType: "VARIATION", pageIndex: 1, pageSize: 25 }),
  { url: "brokeringSimulations", params: { productStoreId: "STORE", routingGroupId: "GRP", statusId: "COMPLETE", runType: "VARIATION", orderByField: "-createdDate", pageIndex: 1, pageSize: 25 } },
  "filtered query",
);

// isFiltered helper: true when any non-store filter is set.
import { isFilteredQuery } from "../src/services/SimulationService";
assert.strictEqual(isFilteredQuery({ productStoreId: "STORE", pageIndex: 0, pageSize: 25 }), false, "store-only is not filtered");
assert.strictEqual(isFilteredQuery({ productStoreId: "STORE", statusId: "FAILED", pageIndex: 0, pageSize: 25 }), true, "status is a filter");

console.log("pastSimulationsQuery tests passed");
