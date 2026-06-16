// src/util/simulationResults.ts
// Pure helpers for the simulation results dashboard.
// Merges: outcomes.ts, routingResultJoin.ts, traceRollup.ts, persistedSimulationAdapter.ts

import type { SimulationOutcomes } from "../types/simulation";
import type { CompareRow, RoutingRunResult, OrderTrace } from "../types/variation";
import { stripVariationPrefix } from "./variationUtils";

// ─── outcomes ─────────────────────────────────────────────────────────────────

export interface OutcomeRow {
  label: string;
  isBaseline: boolean;
  failed: boolean;
  groupRun: any;
  outcomes: SimulationOutcomes | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

export function toRows(results: any): OutcomeRow[] {
  if (!results) return [];
  const rows: OutcomeRow[] = [];
  if (results.baseline) {
    rows.push({ label: "Baseline", isBaseline: true, failed: false, groupRun: results.baseline, outcomes: (results.baseline.outcomes as SimulationOutcomes) ?? null });
  }
  for (const v of results.variants ?? []) {
    rows.push({ label: v.label, isBaseline: false, failed: !!v.failed, groupRun: v.groupRun ?? null, outcomes: (v.groupRun?.outcomes as SimulationOutcomes) ?? null });
  }
  return rows;
}

export function fillRateOf(row: OutcomeRow): number | null {
  if (row.outcomes && typeof row.outcomes.fillRate === "number") return row.outcomes.fillRate;
  const brokered = row.groupRun?.brokeredItemCount;
  const attempted = row.groupRun?.attemptedItemCount;
  if (typeof brokered === "number" && typeof attempted === "number" && attempted > 0) return brokered / attempted;
  return null;
}

export function formatPercent(value: number | null, fractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatMoney(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] || currency || "";
  return `${symbol}${Number(amount).toFixed(2)}`;
}

export function moneySaved(baseline: OutcomeRow, variant: OutcomeRow): number | null {
  const b = baseline.outcomes?.cost;
  const v = variant.outcomes?.cost;
  if (!b?.available || !v?.available) return null;
  return b.totalShippingCost - v.totalShippingCost;
}

export interface OutcomeWeights { unfillable: number; sla: number; cost: number; }
export const DEFAULT_WEIGHTS: OutcomeWeights = { unfillable: 0.5, sla: 0.3, cost: 0.2 };

export interface ScoredRow extends OutcomeRow {
  unfillableScore: number;
  slaScore: number;
  costScore: number;
  score: number;
}

export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map((v) => (v - min) / (max - min));
}

export function renormalizeWeights(w: OutcomeWeights): OutcomeWeights {
  const sum = w.unfillable + w.sla + w.cost;
  if (sum <= 0) return { ...w };
  return { unfillable: w.unfillable / sum, sla: w.sla / sum, cost: w.cost / sum };
}

export function computeScores(results: any, weights: OutcomeWeights = DEFAULT_WEIGHTS): ScoredRow[] {
  const rows = toRows(results);
  const anyOutcomes = rows.some((r) => r.outcomes);
  const anySla = rows.some((r) => r.outcomes?.sla?.available);
  const anyCost = rows.some((r) => r.outcomes?.cost?.available);
  const costRowsIdx = rows.map((r, i) => (r.outcomes?.cost?.available ? i : -1)).filter((i) => i >= 0);
  const costValues = costRowsIdx.map((i) => rows[i].outcomes!.cost.totalShippingCost);
  const costNorm = minMaxNormalize(costValues);
  const costScoreByIdx = new Map<number, number>();
  costRowsIdx.forEach((rowIdx, k) => costScoreByIdx.set(rowIdx, 1 - costNorm[k]));
  const active: OutcomeWeights = { unfillable: anyOutcomes ? weights.unfillable : 0, sla: anySla ? weights.sla : 0, cost: anyCost ? weights.cost : 0 };
  const w = renormalizeWeights(active);
  return rows.map((row, i) => {
    const unfillableScore = row.outcomes ? 1 - (row.outcomes.unfillable?.rate ?? 1) : 0;
    const slaScore = row.outcomes?.sla?.available ? row.outcomes.sla.complianceRate : 0;
    const costScore = costScoreByIdx.has(i) ? costScoreByIdx.get(i)! : 0;
    const score = w.unfillable * unfillableScore + w.sla * slaScore + w.cost * costScore;
    return { ...row, unfillableScore, slaScore, costScore, score };
  });
}

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

// ─── routingResultJoin ────────────────────────────────────────────────────────

export interface JoinArgs {
  variationGroupId: string;
  parentResults: RoutingRunResult[];
  variationResults: RoutingRunResult[];
  routingNameById: Record<string, string>;
}

export function joinRoutingResults(args: JoinArgs): CompareRow[] {
  const { variationGroupId, parentResults, variationResults, routingNameById } = args;
  const parentById = new Map(parentResults.map((p) => [p.orderRoutingId, p]));
  const seenParent = new Set<string>();
  const rows: CompareRow[] = [];
  for (const v of variationResults) {
    const parentId = stripVariationPrefix(variationGroupId, v.orderRoutingId);
    const parent = parentById.get(parentId) || null;
    if (parent) seenParent.add(parentId);
    rows.push({ routingName: routingNameById[v.orderRoutingId] || routingNameById[parentId] || v.orderRoutingId, parentRoutingId: parent ? parentId : null, variationRoutingId: v.orderRoutingId, parent, variation: v });
  }
  for (const p of parentResults) {
    if (seenParent.has(p.orderRoutingId)) continue;
    rows.push({ routingName: routingNameById[p.orderRoutingId] || p.orderRoutingId, parentRoutingId: p.orderRoutingId, variationRoutingId: null, parent: p, variation: null });
  }
  return rows.sort((a, b) => {
    const sa = a.variation?.sequenceNum ?? a.parent?.sequenceNum ?? 0;
    const sb = b.variation?.sequenceNum ?? b.parent?.sequenceNum ?? 0;
    return sa - sb;
  });
}

// ─── traceRollup ──────────────────────────────────────────────────────────────

export interface FacilityRollupRow { facilityId: string; itemCount: number; totalRoutedQty: number; }

export function outcomeCounts(traces?: OrderTrace[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of traces ?? []) {
    const reason = t.finalReason || "UNKNOWN";
    counts[reason] = (counts[reason] || 0) + 1;
  }
  return counts;
}

export function facilityRollup(traces?: OrderTrace[]): FacilityRollupRow[] {
  const byFacility = new Map<string, FacilityRollupRow>();
  for (const t of traces ?? []) {
    for (const a of t.finalAssignments ?? []) {
      if (!a.facilityId) continue;
      const row = byFacility.get(a.facilityId) || { facilityId: a.facilityId, itemCount: 0, totalRoutedQty: 0 };
      row.itemCount += 1;
      row.totalRoutedQty += a.routedQty ?? 0;
      byFacility.set(a.facilityId, row);
    }
  }
  return [...byFacility.values()].sort((a, b) => b.itemCount - a.itemCount || a.facilityId.localeCompare(b.facilityId, "en"));
}

export interface FacilityCompareRow { facilityId: string; parentQty: number; variationQty: number; delta: number; }

export function compareFacilities(parentTraces?: OrderTrace[], variationTraces?: OrderTrace[]): FacilityCompareRow[] {
  const parent = new Map(facilityRollup(parentTraces).map((r) => [r.facilityId, r.itemCount]));
  const variation = new Map(facilityRollup(variationTraces).map((r) => [r.facilityId, r.itemCount]));
  const ids = new Set([...parent.keys(), ...variation.keys()]);
  return [...ids]
    .map((facilityId) => ({ facilityId, parentQty: parent.get(facilityId) ?? 0, variationQty: variation.get(facilityId) ?? 0, delta: (variation.get(facilityId) ?? 0) - (parent.get(facilityId) ?? 0) }))
    .sort((a, b) => b.variationQty - a.variationQty || b.parentQty - a.parentQty || a.facilityId.localeCompare(b.facilityId, "en"));
}

export interface QueuedItem { orderId: string; shipGroupSeqId?: string; orderItemSeqId?: string; newlyQueued: boolean; }

const itemKey = (t: { orderId: string; shipGroupSeqId?: string; orderItemSeqId?: string }) => `${t.orderId}|${t.shipGroupSeqId ?? ""}|${t.orderItemSeqId ?? ""}`;

export function queuedDiff(parentTraces: OrderTrace[] | undefined, variationTraces?: OrderTrace[]): QueuedItem[] {
  const hasParent = parentTraces != null;
  const parentQueued = new Set((parentTraces ?? []).filter((t) => t.finalReason === "QUEUED").map(itemKey));
  return (variationTraces ?? [])
    .filter((t) => t.finalReason === "QUEUED")
    .map((t) => ({ orderId: t.orderId, shipGroupSeqId: t.shipGroupSeqId, orderItemSeqId: t.orderItemSeqId, newlyQueued: hasParent && !parentQueued.has(itemKey(t)) }));
}

const OUTCOME_TEXT: Record<string, string> = {
  FULL_BROKER: "fully brokered here", PARTIAL_BROKER: "partially brokered here", QUEUED: "queued",
  ROUTED: "routed", ROUTED_TO_QUEUE: "moved to queue", NO_INVENTORY: "no available inventory — fell through",
  SKIPPED_BY_ACTION: "skipped by action filter", ERROR: "errored",
};

export function describeRuleAttempts(trace: OrderTrace): string[] {
  return [...(trace.ruleAttempts ?? [])]
    .sort((a, b) => (a.sequenceNum ?? Infinity) - (b.sequenceNum ?? Infinity))
    .map((ra) => {
      const key = ra.outcome ?? "";
      const text = (Object.hasOwn(OUTCOME_TEXT, key) ? OUTCOME_TEXT[key] : null)
        ?? (ra.outcome || "unknown outcome").replace(/_/g, " ").toLowerCase();
      const err = ra.errorMessage ? ` (${ra.errorMessage})` : "";
      return `Rule ${ra.sequenceNum ?? "?"}: ${text}${err}`;
    });
}

// ─── persistedSimulationAdapter ───────────────────────────────────────────────

const yes = (v: any): boolean => v === "Y" || v === true;
const num = (v: any): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function counts(v: any): { brokeredItemCount: number; attemptedItemCount: number; queuedItemCount: number; outcomes: any } {
  return { brokeredItemCount: num(v?.brokeredItemCount), attemptedItemCount: num(v?.attemptedItemCount), queuedItemCount: num(v?.queuedItemCount), outcomes: null };
}

function parseJson(v: any): any {
  if (v == null || v === "") return undefined;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return undefined; }
}

export interface AdaptedResults {
  baseline: any;
  variants: Array<{ label: string; groupRun: any; diff: any; failed: boolean; failureReason?: string }>;
  partial: boolean;
  simulationRan: boolean;
}

export function persistedSimulationAdapter(raw: any): AdaptedResults {
  const header = raw?.simulation ?? raw ?? {};
  const all = Array.isArray(raw?.variants) ? raw.variants : [];
  const baselineVariant = all.find((v: any) => yes(v?.isBaseline)) ?? null;
  const nonBaseline = all.filter((v: any) => !yes(v?.isBaseline));
  const anyFailed = all.some((v: any) => yes(v?.failed));
  return {
    baseline: baselineVariant ? counts(baselineVariant) : counts(header),
    variants: nonBaseline.map((v: any) => ({
      label: v?.label ?? "",
      groupRun: counts(v),
      diff: v?.diff ?? parseJson(v?.diffJson),
      failed: yes(v?.failed),
      ...(v?.failureReason ? { failureReason: v.failureReason } : {}),
    })),
    partial: yes(header?.partial) || anyFailed,
    simulationRan: header?.simulationRan !== "N" && header?.simulationRan !== false,
  };
}
