import assert from "assert";
import { simProductStoreId } from "../src/services/SimulationService";

// Blank when unset, so the caller falls back to the OMS currentEComStore (single-instance behaviour).
assert.strictEqual(simProductStoreId({}), "", "defaults to empty (fall back to currentEComStore)");
assert.strictEqual(simProductStoreId({ VITE_SIM_PRODUCT_STORE_ID: "" }), "", "empty -> empty");

// Honors the override — the sim instance's product store id differs from the OMS demo placeholder.
assert.strictEqual(simProductStoreId({ VITE_SIM_PRODUCT_STORE_ID: "SM_STORE" }), "SM_STORE", "honors override");
assert.strictEqual(simProductStoreId({ VITE_SIM_PRODUCT_STORE_ID: "  SM_STORE  " }), "SM_STORE", "trims whitespace");

console.log("simProductStoreId tests passed");
