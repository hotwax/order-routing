import assert from "node:assert";
import { simBaseURL } from "../src/utils/simConfig";

it("refuses to resolve a simulation origin without feature and bearer trust gates", () => {
  assert.throws(() => simBaseURL({}), /VITE_SIMULATION_ENABLED/);
  assert.throws(
    () => simBaseURL({ VITE_SIMULATION_ENABLED: "true", VITE_SIM_URL: "https://sim.example.test" }),
    /VITE_SIM_ALLOW_OMS_BEARER/,
  );
  assert.equal(simBaseURL({
    VITE_SIMULATION_ENABLED: "true",
    VITE_SIM_ALLOW_OMS_BEARER: "true",
    VITE_SIM_URL: "https://sim.example.test/",
  }), "https://sim.example.test");
});
