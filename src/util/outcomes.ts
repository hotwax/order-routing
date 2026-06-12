// Pure helpers for the outcomes-first simulation dashboard. No Vue/DOM imports so
// the logic runs headless under `npx tsx`. Money formatting is done with a tiny
// inline formatter that matches commonUtil.formatCurrency's "$X.XX" shape; the
// components pass commonUtil.formatCurrency results directly where they need
// locale symbols, but the helpers here stay dependency-free for testability.

import type { SimulationOutcomes } from "../types/simulation";

export interface OutcomeRow {
  label: string;
  isBaseline: boolean;
  failed: boolean;
  groupRun: any;
  outcomes: SimulationOutcomes | null;
}

/** Currency symbols mirrored from common/utils/commonUtil currentSymbol; falls back to the code. */
const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

/** Normalize the store's results into a uniform row list. Baseline first.
 *  Resolves the baseline-vs-variant asymmetry: baseline.outcomes vs variant.groupRun.outcomes. */
export function toRows(results: any): OutcomeRow[] {
  if (!results) return [];
  const rows: OutcomeRow[] = [];
  if (results.baseline) {
    rows.push({
      label: "Baseline",
      isBaseline: true,
      failed: false,
      groupRun: results.baseline,
      outcomes: (results.baseline.outcomes as SimulationOutcomes) ?? null,
    });
  }
  for (const v of results.variants ?? []) {
    rows.push({
      label: v.label,
      isBaseline: false,
      failed: !!v.failed,
      groupRun: v.groupRun ?? null,
      outcomes: (v.groupRun?.outcomes as SimulationOutcomes) ?? null,
    });
  }
  return rows;
}

/** Fill rate 0..1: outcomes.fillRate when present, else legacy brokered/attempted, else null. */
export function fillRateOf(row: OutcomeRow): number | null {
  if (row.outcomes && typeof row.outcomes.fillRate === "number") return row.outcomes.fillRate;
  const brokered = row.groupRun?.brokeredItemCount;
  const attempted = row.groupRun?.attemptedItemCount;
  if (typeof brokered === "number" && typeof attempted === "number" && attempted > 0) {
    return brokered / attempted;
  }
  return null;
}

/** Format a 0..1 rate as a percent string, or "—" for null. */
export function formatPercent(value: number | null, fractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

/** Format money, or "—" for null. Mirrors commonUtil.formatCurrency ("$1840.50"). */
export function formatMoney(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] || currency || "";
  return `${symbol}${Number(amount).toFixed(2)}`;
}

/** baseline.totalShippingCost − variant.totalShippingCost; null if either cost unavailable. */
export function moneySaved(baseline: OutcomeRow, variant: OutcomeRow): number | null {
  const b = baseline.outcomes?.cost;
  const v = variant.outcomes?.cost;
  if (!b?.available || !v?.available) return null;
  return b.totalShippingCost - v.totalShippingCost;
}

export interface OutcomeWeights {
  unfillable: number;
  sla: number;
  cost: number;
}

export const DEFAULT_WEIGHTS: OutcomeWeights = { unfillable: 0.5, sla: 0.3, cost: 0.2 };

export interface ScoredRow extends OutcomeRow {
  unfillableScore: number;
  slaScore: number;
  costScore: number;
  score: number;
}

/** Min-max scale to 0..1. All-equal or single -> all 0 (neutral). Empty -> []. */
export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map((v) => (v - min) / (max - min));
}

/** Drop zero/absent families and rescale the rest to sum 1. All-zero -> unchanged. */
export function renormalizeWeights(w: OutcomeWeights): OutcomeWeights {
  const sum = w.unfillable + w.sla + w.cost;
  if (sum <= 0) return { ...w };
  return { unfillable: w.unfillable / sum, sla: w.sla / sum, cost: w.cost / sum };
}

/** Compute per-objective sub-scores (higher = better) and the weighted composite for every row.
 *  Families unavailable across ALL rows have their weight dropped, then weights renormalize. */
export function computeScores(results: any, weights: OutcomeWeights = DEFAULT_WEIGHTS): ScoredRow[] {
  const rows = toRows(results);

  const anyOutcomes = rows.some((r) => r.outcomes);
  const anySla = rows.some((r) => r.outcomes?.sla?.available);
  const anyCost = rows.some((r) => r.outcomes?.cost?.available);

  // cost sub-score needs min-max across the rows that report cost.
  const costRowsIdx = rows.map((r, i) => (r.outcomes?.cost?.available ? i : -1)).filter((i) => i >= 0);
  const costValues = costRowsIdx.map((i) => rows[i].outcomes!.cost.totalShippingCost);
  const costNorm = minMaxNormalize(costValues);
  const costScoreByIdx = new Map<number, number>();
  costRowsIdx.forEach((rowIdx, k) => costScoreByIdx.set(rowIdx, 1 - costNorm[k]));

  // weights: drop families that no row supports.
  const active: OutcomeWeights = {
    unfillable: anyOutcomes ? weights.unfillable : 0,
    sla: anySla ? weights.sla : 0,
    cost: anyCost ? weights.cost : 0,
  };
  const w = renormalizeWeights(active);

  return rows.map((row, i) => {
    const unfillableScore = row.outcomes ? 1 - (row.outcomes.unfillable?.rate ?? 1) : 0;
    const slaScore = row.outcomes?.sla?.available ? row.outcomes.sla.complianceRate : 0;
    const costScore = costScoreByIdx.has(i) ? costScoreByIdx.get(i)! : 0;
    const score = w.unfillable * unfillableScore + w.sla * slaScore + w.cost * costScore;
    return { ...row, unfillableScore, slaScore, costScore, score };
  });
}

/** Winning variant label (baseline excluded, failed excluded). Ties broken by fill rate. */
export function selectWinner(scored: ScoredRow[]): string | undefined {
  const candidates = scored.filter((r) => !r.isBaseline && !r.failed);
  if (candidates.length === 0) return undefined;
  let best = candidates[0];
  for (const r of candidates.slice(1)) {
    if (r.score > best.score) { best = r; continue; }
    if (r.score === best.score) {
      const rf = fillRateOf(r) ?? -1;
      const bf = fillRateOf(best) ?? -1;
      if (rf > bf) best = r;
    }
  }
  return best.label;
}
