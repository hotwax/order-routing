import assert from "assert";
import { simApiBaseUrl } from "../src/services/SimulationService";

const UAT = "https://asb-sim-uat.hotwax.io/rest/s1/order-routing";

// Defaults to the UAT base when unset, so a missing env still resolves to the dedicated instance.
assert.strictEqual(simApiBaseUrl({}), UAT, "defaults to UAT base");
assert.strictEqual(simApiBaseUrl({ VITE_SIM_API_BASE_URL: "" }), UAT, "empty -> default");

// Single config switch: any environment (prod, local) is a config change, not a code change.
assert.strictEqual(
  simApiBaseUrl({ VITE_SIM_API_BASE_URL: "https://asb-sim-prod.hotwax.io/rest/s1/order-routing" }),
  "https://asb-sim-prod.hotwax.io/rest/s1/order-routing",
  "honors override (prod)",
);
assert.strictEqual(simApiBaseUrl({ VITE_SIM_API_BASE_URL: "  " + UAT + "  " }), UAT, "trims whitespace");

console.log("simApiBaseUrl tests passed");
