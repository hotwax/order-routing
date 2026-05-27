import assert from "assert";
import { interpretJobStatus } from "../src/services/SimulationService";

assert.deepStrictEqual(interpretJobStatus({ jobId: "j", status: "running" }), { done: false });
assert.deepStrictEqual(
  interpretJobStatus({ jobId: "j", status: "complete", variation: { baseline: {}, variants: [] } }),
  { done: true, result: { variation: { baseline: {}, variants: [] } } },
);
assert.deepStrictEqual(
  interpretJobStatus({ jobId: "j", status: "failed", error: "boom" }),
  { done: true, error: "boom" },
);
assert.deepStrictEqual(
  interpretJobStatus({ jobId: "j", status: "not_found" }),
  { done: true, error: "Simulation job expired before it completed. Please re-run." },
);

console.log("simulationService tests passed");
