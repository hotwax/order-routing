import assert from "assert";
import { makeOutcomes, makeResults } from "./fixtures/outcomes";
import { toRows, formatPercent, formatMoney, fillRateOf, moneySaved } from "../src/util/outcomes";

// toRows: baseline first, asymmetry normalized
{
  const results = makeResults(makeOutcomes(), [
    { label: "Tighter distance", outcomes: makeOutcomes({ fillRate: 0.97 }) },
  ]);
  const rows = toRows(results);
  assert.strictEqual(rows.length, 2, "baseline + 1 variant");
  assert.strictEqual(rows[0].isBaseline, true);
  assert.strictEqual(rows[0].label, "Baseline");
  assert.strictEqual(rows[1].isBaseline, false);
  assert.strictEqual(rows[1].label, "Tighter distance");
  // baseline outcomes read from .outcomes; variant from .groupRun.outcomes
  assert.strictEqual(rows[0].outcomes?.fillRate, 0.94);
  assert.strictEqual(rows[1].outcomes?.fillRate, 0.97);
}

// toRows: null results -> empty
{
  assert.deepStrictEqual(toRows(null), []);
}

// toRows: tolerates missing outcomes (legacy backend) -> outcomes null, groupRun kept
{
  const results = makeResults(null, [{ label: "v1", outcomes: null }]);
  const rows = toRows(results);
  assert.strictEqual(rows[0].outcomes, null);
  assert.strictEqual(rows[0].groupRun.brokeredItemCount, 470);
}

// fillRateOf: prefers outcomes.fillRate, falls back to brokered/attempted
{
  const results = makeResults(makeOutcomes({ fillRate: 0.5 }), [{ label: "v1", outcomes: null }]);
  const rows = toRows(results);
  assert.strictEqual(fillRateOf(rows[0]), 0.5, "uses outcomes.fillRate when present");
  assert.strictEqual(fillRateOf(rows[1]), 480 / 500, "legacy fallback brokered/attempted");
}

// fillRateOf: no attempts -> null
{
  const rows = toRows(makeResults(null, []));
  const baselineRow = { label: "b", isBaseline: true, failed: false, outcomes: null, groupRun: { brokeredItemCount: 0, attemptedItemCount: 0 } };
  assert.strictEqual(fillRateOf(baselineRow as any), null);
}

// formatPercent
{
  assert.strictEqual(formatPercent(0.894), "89.4%");
  assert.strictEqual(formatPercent(1), "100.0%");
  assert.strictEqual(formatPercent(null), "—");
}

// formatMoney (inline "$" + 2dp for USD)
{
  assert.strictEqual(formatMoney(1840.5, "USD"), "$1840.50");
  assert.strictEqual(formatMoney(null, "USD"), "—");
}

// moneySaved: baseline - variant, null when either cost unavailable
{
  const base = toRows(makeResults(makeOutcomes(), []))[0];
  const cheaper = toRows(makeResults(makeOutcomes(), [
    { label: "v", outcomes: makeOutcomes({ cost: { ...makeOutcomes().cost, totalShippingCost: 1500 } }) },
  ]))[1];
  assert.strictEqual(moneySaved(base, cheaper), 340.5);

  const noCost = toRows(makeResults(makeOutcomes(), [
    { label: "v", outcomes: makeOutcomes({ cost: { ...makeOutcomes().cost, available: false } }) },
  ]))[1];
  assert.strictEqual(moneySaved(base, noCost), null);
}

console.log("outcomes (rows + formatters) tests passed");
