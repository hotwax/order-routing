import { describe, expect, it } from "vitest";
import {
  isFeatureEnabled,
  mastraUrl,
  simApiBaseUrl,
  simBaseURL,
  simProductStoreId,
} from "@/utils/simConfig";

describe("simulation deployment configuration", () => {
  it("normalizes independently configured service URLs", () => {
    const env = {
      VITE_MASTRA_URL: " https://circuit.example.com/ ",
      VITE_SIM_URL: "https://simulation.example.com/",
    };

    expect(mastraUrl(env)).toBe("https://circuit.example.com");
    expect(simBaseURL(env)).toBe("https://simulation.example.com/");
    expect(simApiBaseUrl(env)).toBe("https://simulation.example.com/rest/s1/");
  });

  it("uses the current origin and store unless an override is supplied", () => {
    expect(simBaseURL({})).toBe("");
    expect(simApiBaseUrl({})).toBe("/rest/s1/");
    expect(simProductStoreId({})).toBe("");
    expect(simProductStoreId({ VITE_SIM_PRODUCT_STORE_ID: " STORE " })).toBe("STORE");
  });

  it("hides simulation only for an explicit false flag", () => {
    expect(isFeatureEnabled("simulation", {})).toBe(true);
    expect(isFeatureEnabled("simulation", { VITE_SIMULATION_ENABLED: " FALSE " })).toBe(false);
    expect(isFeatureEnabled("unknown", {})).toBe(true);
  });
});
