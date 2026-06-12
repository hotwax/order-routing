import assert from "assert";
import { simMoquiUrl } from "../src/services/SimulationService";

// Single-instance mode (VITE_SIM_URL unset/blank): returns "" so callers fall through to api()'s
// default OMS baseURL — the simulation reads from the same Moqui (and auth) as the rest of the app.
// It must NEVER silently substitute a different host: blank also means "OMS Bearer auth" in simApi(),
// and the two switches have to agree.
assert.strictEqual(simMoquiUrl({}), "", "unset -> blank (caller falls back to the OMS default)");
assert.strictEqual(simMoquiUrl({ VITE_SIM_URL: "" }), "", "empty -> blank");
assert.strictEqual(simMoquiUrl({ VITE_SIM_URL: "   " }), "", "whitespace -> blank");

// Two-instance mode: the bare sim Moqui root (no component prefix) used for reference data + groups.
assert.strictEqual(
  simMoquiUrl({ VITE_SIM_URL: "http://localhost:8075/rest/s1/" }),
  "http://localhost:8075/rest/s1/",
  "honors override (local :8075)",
);
assert.strictEqual(
  simMoquiUrl({ VITE_SIM_URL: "  http://localhost:8075/rest/s1/  " }),
  "http://localhost:8075/rest/s1/",
  "trims whitespace",
);

console.log("simMoquiUrl tests passed");
