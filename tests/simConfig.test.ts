import { describe, expect, it } from "vitest";
import {
  isFeatureEnabled,
  requireDraftAssistantUrl,
  simulationConfigError,
} from "@/utils/simConfig";

const SIM_ENV = { VITE_SIMULATION_ENABLED: "true" };

describe("simulation deployment configuration", () => {
  it("normalizes the optional assistant URL", () => {
    expect(requireDraftAssistantUrl({
      VITE_DRAFT_ASSISTANT_ENABLED: "true",
      VITE_MASTRA_URL: " https://circuit.example.com/ ",
    })).toBe("https://circuit.example.com");

  });

  it("requires an explicit simulation opt-in but no browser-to-Sim credentials or URL", () => {
    expect(simulationConfigError({})).toContain("VITE_SIMULATION_ENABLED");
    expect(simulationConfigError(SIM_ENV)).toBeNull();
    expect(() => requireDraftAssistantUrl({ VITE_MASTRA_URL: "https://circuit.example.com" }))
      .toThrow("VITE_DRAFT_ASSISTANT_ENABLED");
  });

  it("keeps features hidden unless the deployment opts in", () => {
    expect(isFeatureEnabled("simulation", {})).toBe(false);
    expect(isFeatureEnabled("simulation", { VITE_SIMULATION_ENABLED: " FALSE " })).toBe(false);
    expect(isFeatureEnabled("simulation", SIM_ENV)).toBe(true);
    // Unknown flags fail closed rather than defaulting to visible.
    expect(isFeatureEnabled("unknown", {})).toBe(false);
  });
});
