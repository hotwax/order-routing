import assert from "assert";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";
import {
  minMaxNormalize, renormalizeWeights, computeScores, selectWinner, DEFAULT_WEIGHTS,
} from "../src/utils/simulationResults";

it("scores simulation outcomes and selects a winner", () => {
// minMaxNormalize: standard
{
  assert.deepStrictEqual(minMaxNormalize([100, 200, 300]), [0, 0.5, 1]);
}
// minMaxNormalize: all equal -> all 0 (neutral)
{
  assert.deepStrictEqual(minMaxNormalize([50, 50, 50]), [0, 0, 0]);
}
// minMaxNormalize: single value -> [0]
{
  assert.deepStrictEqual(minMaxNormalize([42]), [0]);
}
// minMaxNormalize: empty -> []
{
  assert.deepStrictEqual(minMaxNormalize([]), []);
}

// renormalizeWeights: drops zeros, scales remainder to sum 1
{
  const w = renormalizeWeights({ unfillable: 0.5, sla: 0.3, cost: 0 });
  assert.ok(Math.abs(w.unfillable - 0.625) < 1e-9);
  assert.ok(Math.abs(w.sla - 0.375) < 1e-9);
  assert.strictEqual(w.cost, 0);
}

// computeScores: lower unfillable rate + higher SLA + lower cost => higher score
{
  const results = makeResults(
    makeOutcomes({ unfillable: { itemCount: 30, orderCount: 12, rate: 0.06 } }),
    [
      { label: "better", outcomes: makeOutcomes({
          unfillable: { itemCount: 10, orderCount: 4, rate: 0.02 },
          sla: { ...makeOutcomes().sla, complianceRate: 0.95 },
          cost: { ...makeOutcomes().cost, totalShippingCost: 1500 },
        }) },
      { label: "worse", outcomes: makeOutcomes({
          unfillable: { itemCount: 50, orderCount: 20, rate: 0.10 },
          sla: { ...makeOutcomes().sla, complianceRate: 0.80 },
          cost: { ...makeOutcomes().cost, totalShippingCost: 2200 },
        }) },
    ],
  );
  const scored = computeScores(results, DEFAULT_WEIGHTS);
  const better = scored.find((r) => r.label === "better")!;
  const worse = scored.find((r) => r.label === "worse")!;
  assert.ok(better.score > worse.score, "better variant scores higher");
}

// computeScores: a family unavailable for ALL rows -> its weight dropped, no NaN
{
  const noCost = (over = {}) => makeOutcomes({ cost: { ...makeOutcomes().cost, available: false }, ...over });
  const results = makeResults(noCost(), [{ label: "v", outcomes: noCost() }]);
  const scored = computeScores(results, DEFAULT_WEIGHTS);
  for (const r of scored) assert.ok(!Number.isNaN(r.score), "no NaN when cost dropped");
}

// selectWinner: highest score among variants (not baseline); fill-rate tiebreak
{
  const base = makeOutcomes();
  const a = makeOutcomes({ fillRate: 0.90 });
  const b = makeOutcomes({ fillRate: 0.99 }); // identical scores, higher fill rate wins tiebreak
  const results = makeResults(base, [
    { label: "A", outcomes: a },
    { label: "B", outcomes: b },
  ]);
  const scored = computeScores(results, DEFAULT_WEIGHTS);
  // force a tie to exercise the tiebreak
  scored.forEach((r) => { if (!r.isBaseline) r.score = 0.5; });
  assert.strictEqual(selectWinner(scored), "B");
}

// selectWinner: failed variants excluded
{
  const results = makeResults(makeOutcomes(), [
    { label: "good", outcomes: makeOutcomes({ unfillable: { itemCount: 0, orderCount: 0, rate: 0 } }) },
    { label: "broken", outcomes: null, failed: true },
  ]);
  const scored = computeScores(results, DEFAULT_WEIGHTS);
  assert.strictEqual(selectWinner(scored), "good");
}

console.log("outcomes (score + winner) tests passed");
});
