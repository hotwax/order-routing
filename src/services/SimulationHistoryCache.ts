// src/services/SimulationHistoryCache.ts
// localStorage cache for the Past Simulations viewer. @common-free so it runs under tsx.
// - List: the DEFAULT view per productStore (latest 50 headers). Filtered views are NOT cached.
// - Detail: an LRU (25) of full R2 responses, keyed by simulationId. Completed runs are immutable.
// - Both prune entries older than 30 days on read. All writes are best-effort (cache is optional).

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PastSimHeader {
  simulationId: string; routingGroupId?: string; productStoreId?: string;
  runType?: string; statusId?: string;
  attemptedItemCount?: number; brokeredItemCount?: number; queuedItemCount?: number;
  durationMs?: number; sampleSize?: number; sampleCap?: number;
  simulationRan?: any; partial?: any; createdDate?: string | number; createdByUser?: string;
}
export interface DetailEntry { header: PastSimHeader; raw: any; cachedAt: number; }

const LIST_CAP = 50;
const DETAIL_CAP = 25;
const PRUNE_MS = 30 * 24 * 60 * 60_000; // 30 days

const listKey = (storeId: string) => `sim.history.list.${storeId}`;
const detailKey = (id: string) => `sim.history.detail.${id}`;
const LRU_KEY = "sim.history.lru";

function defaultStorage(): StorageLike | null {
  try { return typeof globalThis !== "undefined" && globalThis.localStorage ? globalThis.localStorage : null; }
  catch { return null; }
}
function readJson<T>(storage: StorageLike, key: string, fallback: T): T {
  try { const raw = storage.getItem(key); if (!raw) return fallback; const p = JSON.parse(raw); return p ?? fallback; }
  catch { return fallback; }
}
function writeJson(storage: StorageLike, key: string, value: any): void {
  try { storage.setItem(key, JSON.stringify(value)); } catch (e) { console.error("[SimulationHistoryCache] write failed", key, e); }
}
// createdDate is epoch millis (Long) per the confirmed contract, but tolerate ISO strings and
// digit-only strings (e.g. "1780999300000") that Date.parse() rejects as invalid.
const ts = (d?: string | number): number => {
  if (typeof d === "number") return Number.isFinite(d) ? d : 0;
  if (typeof d === "string" && /^\d+$/.test(d)) {
    const num = Number(d);
    return Number.isFinite(num) ? num : 0;
  }
  const t = d ? Date.parse(d) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

interface ListBucket { headers: PastSimHeader[]; cachedAt: number; }

export function setList(storeId: string, headers: PastSimHeader[], cachedAt: number = Date.now(), storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  const sorted = [...headers].sort((a, b) => ts(b.createdDate) - ts(a.createdDate)).slice(0, LIST_CAP);
  writeJson(storage, listKey(storeId), { headers: sorted, cachedAt } as ListBucket);
}

export function getList(storeId: string, now: number = Date.now(), storage: StorageLike | null = defaultStorage()): PastSimHeader[] {
  if (!storage) return [];
  const bucket = readJson<ListBucket | null>(storage, listKey(storeId), null);
  if (!bucket || !Array.isArray(bucket.headers)) return [];
  if (now - (bucket.cachedAt ?? 0) > PRUNE_MS) { try { storage.removeItem(listKey(storeId)); } catch { /* ignore */ } return []; }
  return bucket.headers;
}

/** Prepend a header to the cached list (dedupe by simulationId), keeping it newest-first and capped. */
export function prependHeader(storeId: string, header: PastSimHeader, now: number = Date.now(), storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  const existing = getList(storeId, now, storage).filter((h) => h.simulationId !== header.simulationId);
  setList(storeId, [header, ...existing], now, storage);
}

function lruOrder(storage: StorageLike): string[] { return readJson<string[]>(storage, LRU_KEY, []); }
function touchLru(storage: StorageLike, id: string): void {
  const order = lruOrder(storage).filter((x) => x !== id);
  order.unshift(id);
  while (order.length > DETAIL_CAP) {
    const evict = order.pop()!;
    try { storage.removeItem(detailKey(evict)); } catch { /* ignore */ }
  }
  writeJson(storage, LRU_KEY, order);
}

export function putDetail(id: string, entry: DetailEntry, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  writeJson(storage, detailKey(id), entry);
  touchLru(storage, id);
}

export function getDetail(id: string, now: number = Date.now(), storage: StorageLike | null = defaultStorage()): DetailEntry | null {
  if (!storage) return null;
  const entry = readJson<DetailEntry | null>(storage, detailKey(id), null);
  if (!entry) return null;
  if (now - (entry.cachedAt ?? 0) > PRUNE_MS) {
    try { storage.removeItem(detailKey(id)); } catch { /* ignore */ }
    writeJson(storage, LRU_KEY, lruOrder(storage).filter((x) => x !== id));
    return null;
  }
  touchLru(storage, id); // mark most-recently-read
  return entry;
}
