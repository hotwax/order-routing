// src/util/persistedSimulationAdapter.ts
// Maps the persisted past-simulation detail (backend R2: { simulation:{header}, variants:[] })
// into the { baseline, variants, partial, simulationRan } shape SimulationResults.vue / toRows()
// render. Pure — no runtime imports, safe under `npx tsx`. The single seam absorbing
// persisted-vs-live differences. NOTE: per the confirmed contract, JSON fields arrive PARSED
// (variant.diff is an object); a raw diffJson string is parsed only as a defensive fallback.
// Persisted variants carry counts but no `outcomes` object, so outcomes is null here; the richer
// outcome-metric panels degrade to their empty state until backend aggregates (R5/Phase 2) feed them.

const yes = (v: any): boolean => v === "Y" || v === true;
const num = (v: any): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function counts(v: any): { brokeredItemCount: number; attemptedItemCount: number; queuedItemCount: number; outcomes: any } {
  return {
    brokeredItemCount: num(v?.brokeredItemCount),
    attemptedItemCount: num(v?.attemptedItemCount),
    queuedItemCount: num(v?.queuedItemCount),
    outcomes: null,   // Phase 1: persisted runs carry no outcomes; rich panels degrade until R2 adds it
  };
}

/** Parse a JSON-string field to an object; pass an object through; undefined on null/blank/corrupt. */
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
  const header = raw?.simulation ?? raw ?? {};   // R2 nests the header under `simulation`
  const all = Array.isArray(raw?.variants) ? raw.variants : [];
  const baselineVariant = all.find((v: any) => yes(v?.isBaseline)) ?? null;
  const nonBaseline = all.filter((v: any) => !yes(v?.isBaseline));

  const anyFailed = all.some((v: any) => yes(v?.failed));
  return {
    baseline: baselineVariant ? counts(baselineVariant) : counts(header),
    variants: nonBaseline.map((v: any) => ({
      label: v?.label ?? "",
      groupRun: counts(v),
      diff: v?.diff ?? parseJson(v?.diffJson),   // prefer the parsed `diff`; fall back to raw string
      failed: yes(v?.failed),
      ...(v?.failureReason ? { failureReason: v.failureReason } : {}),
    })),
    partial: yes(header?.partial) || anyFailed,
    simulationRan: header?.simulationRan !== "N" && header?.simulationRan !== false,
  };
}
