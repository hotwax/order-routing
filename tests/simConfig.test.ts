import { describe, expect, it } from "vitest";
import {
  isFeatureEnabled,
  requireDraftAssistantUrl,
  simApiBaseUrl,
  simBaseURL,
  simProductStoreId,
} from "@/utils/simConfig";

// simConfig is deliberately fail closed: every optional backend stays unavailable until the
// deployment opts in explicitly AND supplies a transport-safe origin. These specs pin that
// contract — a config that merely "looks" enabled must not resolve to a usable URL.

const SIM_ENV = {
  VITE_SIMULATION_ENABLED: "true",
  VITE_SIM_ALLOW_OMS_BEARER: "true",
  VITE_SIM_URL: "https://simulation.example.com/",
};

describe("simulation deployment configuration", () => {
  it("normalizes independently configured service URLs", () => {
    expect(requireDraftAssistantUrl({
      VITE_DRAFT_ASSISTANT_ENABLED: "true",
      VITE_MASTRA_URL: " https://circuit.example.com/ ",
    })).toBe("https://circuit.example.com");

    expect(simBaseURL(SIM_ENV)).toBe("https://simulation.example.com");
    expect(simApiBaseUrl(SIM_ENV)).toBe("https://simulation.example.com/rest/s1/");
  });

  it("refuses to build a URL for a backend that is not fully configured", () => {
    expect(() => simBaseURL({})).toThrow("VITE_SIMULATION_ENABLED");
    // Enabled but unattested: the OMS bearer must be explicitly cleared for the target origin.
    expect(() => simBaseURL({ VITE_SIMULATION_ENABLED: "true", VITE_SIM_URL: SIM_ENV.VITE_SIM_URL }))
      .toThrow("VITE_SIM_ALLOW_OMS_BEARER");
    // Plain HTTP is rejected for a non-loopback host even when every flag is set.
    expect(() => simBaseURL({ ...SIM_ENV, VITE_SIM_URL: "http://simulation.example.com" }))
      .toThrow("VITE_SIM_URL");
    expect(() => requireDraftAssistantUrl({ VITE_MASTRA_URL: "https://circuit.example.com" }))
      .toThrow("VITE_DRAFT_ASSISTANT_ENABLED");
  });

  it("reads the product store override without requiring it", () => {
    expect(simProductStoreId({})).toBe("");
    expect(simProductStoreId({ VITE_SIM_PRODUCT_STORE_ID: " STORE " })).toBe("STORE");
  });

  it("keeps features hidden unless the deployment opts in", () => {
    expect(isFeatureEnabled("simulation", {})).toBe(false);
    expect(isFeatureEnabled("simulation", { VITE_SIMULATION_ENABLED: " FALSE " })).toBe(false);
    expect(isFeatureEnabled("simulation", SIM_ENV)).toBe(true);
    // Unknown flags fail closed rather than defaulting to visible.
    expect(isFeatureEnabled("unknown", {})).toBe(false);
  });
});
