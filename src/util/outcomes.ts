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
