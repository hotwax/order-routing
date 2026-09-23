/** Persist the accepted run ID so a browser reload can link back to the real Sim Routing job. */
export interface VariationRunRecoveryRecord {
  routingGroupId: string;
  variationId: string;
  serverVariationId: string;
  variationLabel: string;
  simulationId?: string;
  startedAt: number;
  status: "running" | "interrupted";
  interruptedAt?: number;
  lastError?: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const key = (routingGroupId: string) => `sim.variation-run.${routingGroupId}`;

function availableStorage(): StorageLike | null {
  try { return globalThis.localStorage || null; }
  catch { return null; }
}

export function setVariationRun(record: VariationRunRecoveryRecord, storage: StorageLike | null = availableStorage()): void {
  try { storage?.setItem(key(record.routingGroupId), JSON.stringify(record)); }
  catch { /* Simulation still runs; only reload recovery is unavailable. */ }
}

export function getVariationRun(
  routingGroupId: string,
  now = Date.now(),
  storage: StorageLike | null = availableStorage(),
): VariationRunRecoveryRecord | null {
  try {
    const raw = storage?.getItem(key(routingGroupId));
    if (!raw) return null;
    const record = JSON.parse(raw) as VariationRunRecoveryRecord;
    if (record.routingGroupId !== routingGroupId || !record.variationId || !record.serverVariationId
        || !record.startedAt || !["running", "interrupted"].includes(record.status)) return null;
    if (now - record.startedAt > MAX_AGE_MS) {
      storage?.removeItem(key(routingGroupId));
      return null;
    }
    return record;
  } catch { return null; }
}

export function clearVariationRun(routingGroupId: string, storage: StorageLike | null = availableStorage()): void {
  try { storage?.removeItem(key(routingGroupId)); }
  catch { /* Best-effort cleanup only. */ }
}

export const SimulationStorage = { setVariationRun, getVariationRun, clearVariationRun };
