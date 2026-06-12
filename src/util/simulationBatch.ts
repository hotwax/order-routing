export function chunkVariants<T>(items: T[], size = 5): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** Merge per-batch `{ variation }` envelopes into one. Baseline is identical across batches —
 *  keep the first non-null one. Variants are concatenated in batch order. Null entries
 *  (failed/timed-out batches) are skipped; the caller tracks those failures separately. */
export function mergeVariationResults(
  results: (any | null)[],
): { baseline: any; variants: any[]; partial: boolean; simulationRan: boolean } {
  let baseline: any = null;
  const variants: any[] = [];
  let partial = false;
  let simulationRan = true;
  for (const r of results) {
    if (!r || !r.variation) { partial = true; continue; }
    // Verified backend shape: variation.baseline is { label, groupRun, diff, ... } — the headline
    // counts live on baseline.groupRun. Fall back to the older guessed shapes for safety.
    if (baseline === null) baseline = r.variation.baseline?.groupRun ?? r.variation.groupRun ?? r.variation.baseline ?? null;
    if (r.variation.partial) partial = true;
    if (r.variation.simulationRan === false) simulationRan = false;
    for (const v of r.variation.variants ?? []) variants.push(v);
  }
  return { baseline, variants, partial, simulationRan };
}
