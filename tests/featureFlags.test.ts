import assert from "assert";
import { isSimulationEnabled, isFeatureEnabled } from "../src/util/featureFlags";

// Default shown (opt-out): unset / empty / anything but "false" => enabled.
assert.strictEqual(isSimulationEnabled({}), true, "unset -> shown");
assert.strictEqual(isSimulationEnabled({ VITE_SIMULATION_ENABLED: "" }), true, "empty -> shown");
assert.strictEqual(isSimulationEnabled({ VITE_SIMULATION_ENABLED: "true" }), true, "'true' -> shown");
assert.strictEqual(isSimulationEnabled({ VITE_SIMULATION_ENABLED: "anything" }), true, "non-false -> shown");

// Only the literal "false" (case-insensitive, trimmed) hides it.
assert.strictEqual(isSimulationEnabled({ VITE_SIMULATION_ENABLED: "false" }), false, "'false' -> hidden");
assert.strictEqual(isSimulationEnabled({ VITE_SIMULATION_ENABLED: "FALSE" }), false, "'FALSE' -> hidden");
assert.strictEqual(isSimulationEnabled({ VITE_SIMULATION_ENABLED: "  false  " }), false, "padded 'false' -> hidden");

// isFeatureEnabled: "simulation" delegates to isSimulationEnabled; unknown flags fail open (visible).
assert.strictEqual(isFeatureEnabled("simulation", { VITE_SIMULATION_ENABLED: "false" }), false, "simulation flag delegates");
assert.strictEqual(isFeatureEnabled("simulation", {}), true, "simulation flag default shown");
assert.strictEqual(isFeatureEnabled("somethingElse", {}), true, "unknown flag -> visible (fail open)");

console.log("featureFlags tests passed");
