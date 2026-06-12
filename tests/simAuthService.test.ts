// tests/simAuthService.test.ts — pure-helper contract for the two-instance sim auth (tsx-runnable).
import assert from "assert";
import { simApiName, simBaseURL } from "../src/services/SimulationService";
import { simCreds, simLoginUrl, isSessionExpired } from "../src/services/SimAuthService";

// simApiName: the sim component name; defaults to order-routing, honors override.
assert.strictEqual(simApiName({}), "order-routing", "simApiName defaults to order-routing");
assert.strictEqual(simApiName({ VITE_SIM_API_NAME: "ai-routing" }), "ai-routing", "simApiName honors override");
assert.strictEqual(simApiName({ VITE_SIM_API_NAME: "" }), "order-routing", "simApiName empty -> default");

// simBaseURL: blank when unset (two-instance toggle off -> caller uses shared api()), honors override, trims.
assert.strictEqual(simBaseURL({}), "", "simBaseURL defaults to empty (single-instance)");
assert.strictEqual(
  simBaseURL({ VITE_SIM_URL: "http://localhost:8075/rest/s1/" }),
  "http://localhost:8075/rest/s1/",
  "simBaseURL honors override",
);
assert.strictEqual(simBaseURL({ VITE_SIM_URL: "  " }), "", "simBaseURL whitespace -> empty");

// simCreds: from env, username trimmed, blank when unset.
assert.deepStrictEqual(simCreds({}), { username: "", password: "" }, "creds default empty");
assert.deepStrictEqual(
  simCreds({ VITE_SIM_USERNAME: " sim.user ", VITE_SIM_PASSWORD: "s3cret!" }),
  { username: "sim.user", password: "s3cret!" },
  "creds from env (username trimmed)",
);

// simLoginUrl: component-relative, tracks the sim component name.
assert.strictEqual(simLoginUrl(), "order-routing/login", "login url defaults to order-routing");

// isSessionExpired: null => expired; no expiry => never; refresh 60s early.
assert.strictEqual(isSessionExpired(null, 1000), true, "null session is expired");
assert.strictEqual(isSessionExpired({ apiKey: "k" }, 1e15), false, "no expiry => never expired");
assert.strictEqual(
  isSessionExpired({ apiKey: "k", expirationTime: 100_000 }, 100_000 - 60_000 - 1),
  false,
  "just before skew window => valid",
);
assert.strictEqual(
  isSessionExpired({ apiKey: "k", expirationTime: 100_000 }, 100_000 - 60_000 + 1),
  true,
  "inside skew window => refresh",
);

console.log("simAuthService tests passed");
