import { SimVariant } from "../types/simulation";

export function chunkVariants(variants: SimVariant[], size = 5): SimVariant[][] {
  const batches: SimVariant[][] = [];
  for (let i = 0; i < variants.length; i += size) batches.push(variants.slice(i, i + size));
  return batches;
}

/** Merge per-batch `{ variation }` envelopes into one. Baseline is identical across batches —
 *  keep the first non-null one. Variants are concatenated in batch order. Null entries
 *  (failed/timed-out batches) are skipped; the caller tracks those failures separately. */
export function mergeVariationResults(results: (any | null)[]): { baseline: any; variants: any[]; partial: boolean } {
  let baseline: any = null;
  const variants: any[] = [];
  let partial = false;
  for (const r of results) {
    if (!r || !r.variation) { partial = true; continue; }
    // The baseline run is exposed as `groupRun` in the backend's variation envelope (same shape
    // as each variant's groupRun); older/alternate shapes used `baseline`. Accept either.
    if (baseline === null) baseline = r.variation.groupRun ?? r.variation.baseline ?? null;
    if (r.variation.partial) partial = true;
    for (const v of r.variation.variants ?? []) variants.push(v);
  }
  return { baseline, variants, partial };
}
