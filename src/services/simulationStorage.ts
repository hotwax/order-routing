// src/services/simulationStorage.ts
// localStorage persistence for simulation state. Merges SimulationHistoryCache.ts + SimulationJobStore.ts.

import type { StorageLike, PastSimHeader, DetailEntry, SimJobRecord } from "../types/simulation";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function defaultStorage(): StorageLike | null {
  try { return typeof globalThis !== "undefined" && globalThis.localStorage ? globalThis.localStorage : null; }
  catch { return null; }
}

function readJson<T>(storage: StorageLike, key: string, fallback: T): T {
  try { const raw = storage.getItem(key); if (!raw) return fallback; const p = JSON.parse(raw); return p ?? fallback; }
  catch { return fallback; }
}

function writeJson(storage: StorageLike, key: string, value: any): void {
  try { storage.setItem(key, JSON.stringify(value)); } catch (e) { console.error("[simulationStorage] write failed", key, e); }
}

// ─── Past Simulations History Cache (list + detail, localStorage) ─────────────

const LIST_CAP = 50;
const DETAIL_CAP = 25;
const HISTORY_PRUNE_MS = 30 * 24 * 60 * 60_000; // 30 days

const listKey = (storeId: string) => `sim.history.list.${storeId}`;
const detailKey = (id: string) => `sim.history.detail.${id}`;
const LRU_KEY = "sim.history.lru";

// createdDate is epoch millis (Long) per the confirmed contract, but tolerate ISO strings and
// digit-only strings (e.g. "1780999300000") that Date.parse() rejects as invalid.
const ts = (d?: string | number): number => {
  if (typeof d === "number") return Number.isFinite(d) ? d : 0;
  if (typeof d === "string" && /^\d+$/.test(d)) { const num = Number(d); return Number.isFinite(num) ? num : 0; }
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
  if (now - (bucket.cachedAt ?? 0) > HISTORY_PRUNE_MS) { try { storage.removeItem(listKey(storeId)); } catch { /* ignore */ } return []; }
  return bucket.headers;
}

export function prependHeader(storeId: string, header: PastSimHeader, now: number = Date.now(), storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  const existing = getList(storeId, now, storage).filter((h) => h.simulationId !== header.simulationId);
  setList(storeId, [header, ...existing], now, storage);
}

function lruOrder(storage: StorageLike): string[] { return readJson<string[]>(storage, LRU_KEY, []); }
function touchLru(storage: StorageLike, id: string): void {
  const order = lruOrder(storage).filter((x) => x !== id);
  order.unshift(id);
  while (order.length > DETAIL_CAP) { const evict = order.pop()!; try { storage.removeItem(detailKey(evict)); } catch { /* ignore */ } }
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
  if (now - (entry.cachedAt ?? 0) > HISTORY_PRUNE_MS) {
    try { storage.removeItem(detailKey(id)); } catch { /* ignore */ }
    writeJson(storage, LRU_KEY, lruOrder(storage).filter((x) => x !== id));
    return null;
  }
  touchLru(storage, id);
  return entry;
}

// ─── In-flight Job Store (localStorage) ──────────────────────────────────────

const JOB_PRUNE_MS = 2 * 60 * 60_000; // 2h
const keyFor = (routingGroupId: string) => `sim.inflight.${routingGroupId}`;

export function recordJobs(routingGroupId: string, jobs: SimJobRecord[], storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try { storage.setItem(keyFor(routingGroupId), JSON.stringify(jobs)); }
  catch (e) { console.error("[simulationStorage] recordJobs failed", e); }
}

export function clearJobs(routingGroupId: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try { storage.removeItem(keyFor(routingGroupId)); }
  catch (e) { console.error("[simulationStorage] clearJobs failed", e); }
}

export function getJobs(routingGroupId: string, now: number = Date.now(), storage: StorageLike | null = defaultStorage()): SimJobRecord[] {
  if (!storage) return [];
  let raw: string | null;
  try { raw = storage.getItem(keyFor(routingGroupId)); } catch { return []; }
  if (!raw) return [];
  let list: SimJobRecord[];
  try { const parsed = JSON.parse(raw); if (!Array.isArray(parsed)) return []; list = parsed; } catch { return []; }
  const fresh = list.filter((j) => now - (j?.submittedAt ?? 0) <= JOB_PRUNE_MS);
  if (fresh.length !== list.length) { if (fresh.length) recordJobs(routingGroupId, fresh, storage); else clearJobs(routingGroupId, storage); }
  return fresh;
}

export function removeJob(routingGroupId: string, jobId: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  let raw: string | null;
  try { raw = storage.getItem(keyFor(routingGroupId)); } catch { return; }
  if (!raw) return;
  let list: SimJobRecord[];
  try { const parsed = JSON.parse(raw); if (!Array.isArray(parsed)) return; list = parsed; } catch { return; }
  const next = list.filter((j) => j.jobId !== jobId);
  if (next.length) recordJobs(routingGroupId, next, storage);
  else clearJobs(routingGroupId, storage);
}

export const SimulationStorage = {
  setList,
  getList,
  prependHeader,
  putDetail,
  getDetail,
  recordJobs,
  clearJobs,
  getJobs,
  removeJob,
};
