import { describe, expect, it, vi } from "vitest";
import {
  getDetail,
  getJobs,
  getList,
  putDetail,
  recordJobs,
  removeJob,
  setList,
} from "@/services/simulationStorage";
import type { PastSimHeader, SimJobRecord, StorageLike } from "@/types/simulation";

function memoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

const header = (simulationId: string, createdDate: string): PastSimHeader => ({
  simulationId,
  productStoreId: "STORE",
  statusId: "COMPLETE",
  createdDate,
});

describe("simulation history cache", () => {
  it("keeps list entries isolated by product store", () => {
    const storage = memoryStorage();
    setList("STORE", [header("A", "2026-06-09T10:00:00Z")], 1_000, storage);

    expect(getList("STORE", 1_000, storage).map(({ simulationId }) => simulationId)).toEqual(["A"]);
    expect(getList("OTHER", 1_000, storage)).toEqual([]);
  });

  it("evicts the least recently used detail after the cache limit", () => {
    const storage = memoryStorage();
    for (let index = 0; index < 25; index += 1) {
      putDetail(`D${index}`, { header: header(`D${index}`, "2026-06-09T10:00:00Z"), raw: {}, cachedAt: 1_000 }, storage);
    }
    getDetail("D0", 1_000, storage);
    putDetail("D25", { header: header("D25", "2026-06-09T10:00:00Z"), raw: {}, cachedAt: 1_000 }, storage);

    expect(getDetail("D0", 1_000, storage)).not.toBeNull();
    expect(getDetail("D1", 1_000, storage)).toBeNull();
  });
});

describe("in-flight simulation jobs", () => {
  const now = 1_000_000_000_000;
  const job = (jobId: string, submittedAt: number, batchIndex = 0): SimJobRecord => ({
    jobId,
    submittedAt,
    batchIndex,
    batchCount: 2,
    variantLabels: ["A"],
  });

  it("prunes expired jobs and removes only the completed job", () => {
    const storage = memoryStorage();
    recordJobs("GROUP", [job("old", now - 3 * 60 * 60_000), job("current", now)], storage);

    expect(getJobs("GROUP", now, storage).map(({ jobId }) => jobId)).toEqual(["current"]);
    removeJob("GROUP", "current", storage);
    expect(getJobs("GROUP", now, storage)).toEqual([]);
    expect(storage.values.has("sim.inflight.GROUP")).toBe(false);
  });

  it("degrades safely when browser storage is unavailable", () => {
    const storage: StorageLike = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("SecurityError"); },
      removeItem: () => { throw new Error("SecurityError"); },
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => recordJobs("GROUP", [job("J", now)], storage)).not.toThrow();
    expect(getJobs("GROUP", now, storage)).toEqual([]);
    expect(() => removeJob("GROUP", "J", storage)).not.toThrow();
    consoleError.mockRestore();
  });
});
