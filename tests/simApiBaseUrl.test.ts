import assert from "node:assert";
import { simApiBaseUrl } from "../src/utils/simConfig";

const enabled = {
  VITE_SIMULATION_ENABLED: "true",
  VITE_SIM_ALLOW_OMS_BEARER: "true",
};

it("builds a simulation REST URL only from an explicitly trusted origin", () => {
  assert.throws(() => simApiBaseUrl({}), /VITE_SIMULATION_ENABLED/);
  assert.throws(() => simApiBaseUrl({ ...enabled }), /VITE_SIM_URL/);
  assert.throws(
    () => simApiBaseUrl({ ...enabled, VITE_SIM_URL: "http://remote.example.test" }),
    /must use HTTPS/,
  );
  assert.throws(
    () => simApiBaseUrl({ ...enabled, VITE_SIM_URL: "https://user:pass@sim.example.test" }),
    /without credentials/,
  );
  assert.throws(
    () => simApiBaseUrl({ ...enabled, VITE_SIM_URL: "https://sim.example.test/rest/s1" }),
    /bare origin/,
  );
  assert.equal(
    simApiBaseUrl({ ...enabled, VITE_SIM_URL: " https://sim.example.test/ " }),
    "https://sim.example.test/rest/s1/",
  );
  assert.equal(
    simApiBaseUrl({ ...enabled, VITE_SIM_URL: "http://localhost:8075" }),
    "http://localhost:8075/rest/s1/",
    "loopback HTTP remains available for local development",
  );
});
