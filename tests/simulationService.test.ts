import { afterEach, describe, expect, it, vi } from "vitest";

const { simApi } = vi.hoisted(() => ({ simApi: vi.fn() }));

vi.mock("@common", () => ({
  commonUtil: {
    hasError: (response: any) => response?._error === true,
  },
}));

vi.mock("../src/services/SimApiService", () => ({ simApi }));

import {
  isRecoverableSimulationPollError,
  pollJob,
} from "../src/services/SimulationService";
import { interpretJobStatus } from "../src/utils/simulationCompute";

const progress = (nextSeq: number, events: any[] = []) => ({
  phase: "BROKER",
  phaseLabel: "Brokering",
  phaseIndex: 1,
  phaseCount: 2,
  ordersInScope: 10,
  ordersProcessed: nextSeq,
  brokered: nextSeq,
  queued: 0,
  events,
  nextSeq,
});

describe("simulation job polling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    simApi.mockReset();
  });

  it("interprets terminal job statuses", () => {
    expect(interpretJobStatus({ jobId: "j", status: "running" })).toEqual({ done: false });
    expect(interpretJobStatus({ jobId: "j", status: "complete", variation: { baseline: {}, variants: [] } }))
      .toEqual({ done: true, result: { variation: { baseline: {}, variants: [] } } });
    expect(interpretJobStatus({ jobId: "j", status: "failed", error: "boom" }))
      .toEqual({ done: true, error: "boom" });
    expect(interpretJobStatus({ jobId: "j", status: "not_found" }))
      .toEqual({ done: true, error: "Simulation job expired before it completed. Please re-run." });
  });

  it("polls through completion, emits progress, and never moves the progress cursor backward", async () => {
    vi.useFakeTimers();
    const onPhase = vi.fn();
    const onProgress = vi.fn();
    simApi
      .mockResolvedValueOnce({ data: { jobId: "J1", status: "running", progress: progress(4, [{ seq: 4 }]) } })
      .mockResolvedValueOnce({ data: { jobId: "J1", status: "running", progress: progress(2, [{ seq: 2 }]) } })
      .mockResolvedValueOnce({ data: { jobId: "J1", status: "complete", progress: progress(6), groupRun: { simulationId: "S1" } } });

    const polling = pollJob("G1", "J1", onPhase, onProgress);
    await vi.advanceTimersByTimeAsync(2_500);
    await vi.advanceTimersByTimeAsync(2_500);

    await expect(polling).resolves.toEqual({ groupRun: { simulationId: "S1" } });
    expect(onPhase).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(simApi.mock.calls.map(([request]) => request.params.sinceSeq)).toEqual([0, 4, 4]);
  });

  it.each([
    [{ jobId: "J1", status: "failed", error: "backend failed" }, "backend failed"],
    [{ jobId: "J1", status: "not_found" }, "expired before it completed"],
    [{ jobId: "J1", status: "complete" }, "completed without a result"],
  ])("rejects a terminal response that cannot produce results", async (response, message) => {
    simApi.mockResolvedValue({ data: response });
    await expect(pollJob("G1", "J1")).rejects.toThrow(message);
  });

  it("recovers from a transient network interruption without losing the job", async () => {
    vi.useFakeTimers();
    simApi
      .mockRejectedValueOnce(new Error("socket reset"))
      .mockResolvedValueOnce({ data: { jobId: "J1", status: "complete", variation: { variants: [] } } });

    const polling = pollJob("G1", "J1");
    await vi.advanceTimersByTimeAsync(2_500);

    await expect(polling).resolves.toEqual({ variation: { variants: [] } });
    expect(simApi).toHaveBeenCalledTimes(2);
  });

  it("marks repeated network interruption as recoverable for reload reattachment", async () => {
    vi.useFakeTimers();
    simApi.mockRejectedValue(new Error("offline"));

    const polling = pollJob("G1", "J1").catch((reason) => reason);
    await vi.advanceTimersByTimeAsync(5_000);

    const error = await polling;
    expect(error.message).toContain("Reopen this routing group");
    expect(isRecoverableSimulationPollError(error)).toBe(true);
    expect(simApi).toHaveBeenCalledTimes(3);
  });

  it("aborts while sleeping between polls", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    simApi.mockResolvedValue({ data: { jobId: "J1", status: "running" } });

    const polling = pollJob("G1", "J1", undefined, undefined, controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();

    const error = await polling.catch((reason) => reason);
    expect(error.name).toBe("AbortError");
    expect(isRecoverableSimulationPollError(error)).toBe(true);
    expect(simApi).toHaveBeenCalledTimes(1);
  });

  it("classifies the poll deadline as recoverable", async () => {
    vi.useFakeTimers();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValue(Number.MAX_SAFE_INTEGER);
    simApi.mockResolvedValue({ data: { jobId: "J1", status: "running" } });

    const polling = pollJob("G1", "J1").catch((reason) => reason);
    await vi.advanceTimersByTimeAsync(2_500);

    const error = await polling;
    expect(error.message).toContain("timed out");
    expect(isRecoverableSimulationPollError(error)).toBe(true);
    expect(simApi).toHaveBeenCalledTimes(1);
  });
});
