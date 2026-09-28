import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@common", () => ({
  api: (...args: any[]) => mocks.api(...args),
  commonUtil: { hasError: (response: any) => Boolean(response?.data?._ERROR_MESSAGE_) },
}));

import {
  deleteSimDatastore, getSimFill, getSimRun, listSimDatastores, listSimRoutingGroups,
  startSimFill, submitSimRun,
} from "../src/services/SimulationSetupService";

describe("Simulation setup Main OMS facade", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the existing Main OMS facade for datastore checks and fills", async () => {
    mocks.api.mockResolvedValueOnce({ data: { datastoreList: [] } });
    await expect(listSimDatastores()).resolves.toEqual([]);
    expect(mocks.api).toHaveBeenCalledWith({ url: "order-routing/simulation/datastores", method: "GET" });

    mocks.api.mockResolvedValueOnce({ data: { runWorkEffortId: "FILL1", taskCount: 31 } });
    await expect(startSimFill("DS1")).resolves.toEqual({ fillId: "FILL1", taskCount: 31 });
    expect(mocks.api).toHaveBeenCalledWith({ url: "order-routing/simulation/datastores/DS1/fill", method: "POST" });

    mocks.api.mockResolvedValueOnce({ data: { fill: { fillId: "FILL1", statusId: "SIMDSF_FAILED" } } });
    await expect(getSimFill("DS1", "FILL1")).resolves.toMatchObject({ statusId: "SIMDSF_FAILED" });
    expect(mocks.api).toHaveBeenCalledWith({ url: "order-routing/simulation/datastores/DS1/fill/FILL1", method: "GET" });
  });

  it("uses the real paged group list and simulation run paths", async () => {
    mocks.api.mockResolvedValueOnce({ data: { groupList: [{ routingGroupId: "GROUP1" }], totalCount: 201 } });
    await expect(listSimRoutingGroups(1)).resolves.toEqual({ groups: [{ routingGroupId: "GROUP1" }], totalCount: 201 });
    expect(mocks.api).toHaveBeenCalledWith({ url: "order-routing/simulation/groups", method: "GET", params: { pageIndex: 1, pageSize: 200 } });

    mocks.api.mockResolvedValueOnce({ data: { simulationId: "RUN1", statusId: "BRSIM_QUEUED" } });
    await expect(submitSimRun(["GROUP1"])).resolves.toMatchObject({ simulationId: "RUN1" });
    expect(mocks.api).toHaveBeenCalledWith({ url: "order-routing/simulation/simulations", method: "POST", data: { routingGroupIds: ["GROUP1"] } });

    mocks.api.mockResolvedValueOnce({ data: { simulation: { simulationId: "RUN1", statusId: "BRSIM_COMPLETE" }, variants: [] } });
    await expect(getSimRun("RUN1")).resolves.toMatchObject({ simulation: { statusId: "BRSIM_COMPLETE" } });
    expect(mocks.api).toHaveBeenCalledWith({ url: "order-routing/simulation/simulations/RUN1", method: "GET" });
  });

  it("deletes a datastore through the Main OMS facade", async () => {
    mocks.api.mockResolvedValueOnce({ data: {} });
    await expect(deleteSimDatastore("DS1")).resolves.toBeUndefined();
    expect(mocks.api).toHaveBeenCalledWith({ url: "order-routing/simulation/datastores/DS1", method: "DELETE" });
  });

  it("rejects an error body or a missing success payload", async () => {
    mocks.api.mockResolvedValueOnce({ data: { _ERROR_MESSAGE_: "Source database unavailable" } });
    await expect(listSimDatastores()).rejects.toThrow("Source database unavailable");
    mocks.api.mockResolvedValueOnce({ data: {} });
    await expect(submitSimRun(["GROUP1"])).rejects.toThrow("did not confirm a queued simulation");
  });
});
