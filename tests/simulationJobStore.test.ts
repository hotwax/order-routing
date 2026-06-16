import assert from "assert";
import { recordJobs, getJobs, removeJob, clearJobs, SimJobRecord, StorageLike } from "../src/services/simulationStorage";

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
}
const rec = (jobId: string, submittedAt: number, batchIndex = 0): SimJobRecord =>
  ({ jobId, batchIndex, batchCount: 1, variantLabels: ["V"], submittedAt });

const NOW = 1_000_000_000_000;

// round-trip
{
  const s = fakeStorage();
  recordJobs("G1", [rec("j1", NOW)], s);
  assert.deepStrictEqual(getJobs("G1", NOW, s).map((j) => j.jobId), ["j1"], "record + get round-trip");
}
// prune drops records older than 2h, keeps younger
{
  const s = fakeStorage();
  recordJobs("G1", [rec("old", NOW - 3 * 60 * 60_000), rec("young", NOW - 10 * 60_000)], s);
  assert.deepStrictEqual(getJobs("G1", NOW, s).map((j) => j.jobId), ["young"], "prunes >2h");
}
// removeJob drops one and clears key when empty
{
  const s = fakeStorage();
  recordJobs("G1", [rec("j1", NOW), rec("j2", NOW, 1)], s);
  removeJob("G1", "j1", s);
  assert.deepStrictEqual(getJobs("G1", NOW, s).map((j) => j.jobId), ["j2"], "removeJob drops one");
  removeJob("G1", "j2", s);
  assert.strictEqual(s.map.has("sim.inflight.G1"), false, "key cleared when empty");
}
// corrupt / missing → []
{
  const s = fakeStorage();
  assert.deepStrictEqual(getJobs("MISSING", NOW, s), [], "missing key → []");
  s.setItem("sim.inflight.BAD", "{not json");
  assert.deepStrictEqual(getJobs("BAD", NOW, s), [], "corrupt → []");
}
// clearJobs
{
  const s = fakeStorage();
  recordJobs("G1", [rec("j1", NOW)], s);
  clearJobs("G1", s);
  assert.deepStrictEqual(getJobs("G1", NOW, s), [], "clearJobs empties");
}

// removeJob/getJobs/recordJobs: a throwing storage is a graceful no-op (no propagation)
{
  const throwing: StorageLike = {
    getItem: () => { throw new Error("SecurityError"); },
    setItem: () => { throw new Error("SecurityError"); },
    removeItem: () => { throw new Error("SecurityError"); },
  };
  assert.doesNotThrow(() => removeJob("G1", "j1", throwing), "removeJob swallows storage errors");
  assert.doesNotThrow(() => clearJobs("G1", throwing), "clearJobs swallows storage errors");
  assert.deepStrictEqual(getJobs("G1", NOW, throwing), [], "getJobs returns [] on storage errors");
  assert.doesNotThrow(() => recordJobs("G1", [rec("j1", NOW)], throwing), "recordJobs swallows storage errors");
}

console.log("simulationJobStore tests passed");
