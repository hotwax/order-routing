import assert from "node:assert";
import {
  isDraftAssistantEnabled,
  isDeveloperFeatureEnabled,
  isFeatureEnabled,
  isSimulationEnabled,
  isTestDriveEnabled,
} from "../src/utils/simConfig";

const readySimulation = {
  VITE_SIMULATION_ENABLED: "true",
  VITE_SIM_ALLOW_OMS_BEARER: "true",
  VITE_SIM_URL: "https://sim.example.test",
};

it("fails optional feature flags closed until their complete config is explicit", () => {
  assert.equal(isSimulationEnabled({}), false, "simulation is off by default");
  assert.equal(isSimulationEnabled({ VITE_SIMULATION_ENABLED: "true" }), false, "a URL and bearer attestation are required");
  assert.equal(isSimulationEnabled({ ...readySimulation, VITE_SIM_ALLOW_OMS_BEARER: "false" }), false);
  assert.equal(isSimulationEnabled(readySimulation), true);
  assert.equal(isSimulationEnabled({ ...readySimulation, VITE_SIMULATION_ENABLED: " TRUE " }), true);
  assert.equal(isSimulationEnabled({ ...readySimulation, VITE_SIMULATION_ENABLED: "anything" }), false);

  assert.equal(isDraftAssistantEnabled({}), false, "assistant is off by default");
  assert.equal(isDraftAssistantEnabled({ VITE_DRAFT_ASSISTANT_ENABLED: "true" }), false, "assistant URL is required");
  assert.equal(isDraftAssistantEnabled({
    VITE_DRAFT_ASSISTANT_ENABLED: "true",
    VITE_MASTRA_URL: "https://circuit.example.test",
  }), true);

  assert.equal(isFeatureEnabled("simulation", readySimulation), true);
  assert.equal(isFeatureEnabled("draftAssistant", {}), false);
  assert.equal(isDeveloperFeatureEnabled("draftAssistant", false, {
    VITE_DRAFT_ASSISTANT_ENABLED: "true",
    VITE_MASTRA_URL: "https://circuit.example.test",
  }), false, "configured Circuit stays hidden outside developer mode");
  assert.equal(isDeveloperFeatureEnabled("draftAssistant", true, {
    VITE_DRAFT_ASSISTANT_ENABLED: "true",
    VITE_MASTRA_URL: "https://circuit.example.test",
  }), true);
  assert.equal(isDeveloperFeatureEnabled("simulation", false, readySimulation), false, "configured Simulation stays hidden outside developer mode");
  assert.equal(isDeveloperFeatureEnabled("simulation", true, readySimulation), true);
  assert.equal(isDeveloperFeatureEnabled("simulation", true, {}), false, "developer mode does not bypass backend configuration");
  assert.equal(isTestDriveEnabled({}), false, "Test Drive is off by default");
  assert.equal(isTestDriveEnabled({ VITE_TEST_DRIVE_ENABLED: "true" }), false, "backend attestation is required");
  assert.equal(isTestDriveEnabled({
    VITE_TEST_DRIVE_ENABLED: "true",
    VITE_TEST_DRIVE_BACKEND_AUTH_VERIFIED: "true",
  }), true);
  assert.equal(isFeatureEnabled("testDrive", {}), false);
  assert.equal(isDeveloperFeatureEnabled("testDrive", false, {
    VITE_TEST_DRIVE_ENABLED: "true",
    VITE_TEST_DRIVE_BACKEND_AUTH_VERIFIED: "true",
  }), true, "developer mode does not change unrelated feature gates");
  assert.equal(isFeatureEnabled("unregisteredFeature", {}), false, "unknown flags fail closed");
});
