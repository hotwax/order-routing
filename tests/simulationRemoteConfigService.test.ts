import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.fn();

vi.mock("@common", () => ({
  api: (...args: any[]) => api(...args),
}));

import {
  SIM_ROUTING_REMOTE_ID,
  loadSimulationRemoteConfig,
  saveSimulationRemoteConfig,
} from "../src/services/SimulationRemoteConfigService";

describe("simulation remote configuration", () => {
  beforeEach(() => api.mockReset());

  it("loads only SIM_ROUTING_CONFIG through the OMS SystemMessageRemote API", async () => {
    api.mockResolvedValue({
      data: {
        systemMessageRemoteList: [{
          systemMessageRemoteId: SIM_ROUTING_REMOTE_ID,
          sendUrl: "http://localhost:8082/rest/s1",
          username: "simulation.service",
        }],
      },
    });

    await expect(loadSimulationRemoteConfig()).resolves.toEqual({
      systemMessageRemoteId: "SIM_ROUTING_CONFIG",
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
    });
    expect(api).toHaveBeenCalledWith({
      url: "oms/systemMessageRemotes",
      method: "GET",
      params: { systemMessageRemoteId: ["SIM_ROUTING_CONFIG"] },
    });
  });

  it("creates SIM_ROUTING_CONFIG with username and encrypted password fields", async () => {
    api.mockResolvedValue({ data: {} });

    await saveSimulationRemoteConfig({
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
      password: "service-password",
    }, false);

    expect(api).toHaveBeenCalledWith({
      url: "oms/systemMessageRemotes",
      method: "POST",
      data: {
        systemMessageRemoteId: "SIM_ROUTING_CONFIG",
        description: "Sim Routing Sister Instance Remote",
        sendUrl: "http://localhost:8082/rest/s1",
        username: "simulation.service",
        password: "service-password",
        sendAuthEnumId: "SmatLogin",
      },
    });
  });

  it("preserves the stored password when an existing remote is saved with a blank password", async () => {
    api.mockResolvedValue({ data: {} });

    await saveSimulationRemoteConfig({
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
      password: "",
    }, true);

    expect(api).toHaveBeenCalledWith({
      url: "oms/systemMessageRemotes/SIM_ROUTING_CONFIG",
      method: "PUT",
      data: {
        systemMessageRemoteId: "SIM_ROUTING_CONFIG",
        description: "Sim Routing Sister Instance Remote",
        sendUrl: "http://localhost:8082/rest/s1",
        username: "simulation.service",
        sendAuthEnumId: "SmatLogin",
      },
    });
  });

  it("requires a password when the remote does not exist yet", async () => {
    await expect(saveSimulationRemoteConfig({
      sendUrl: "http://localhost:8082/rest/s1",
      username: "simulation.service",
      password: "",
    }, false)).rejects.toThrow("Password is required");

    expect(api).not.toHaveBeenCalled();
  });
});
