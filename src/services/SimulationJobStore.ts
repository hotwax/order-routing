// src/services/SimulationJobStore.ts
// localStorage persistence of in-flight simulation jobs so a run survives a page refresh.
// @common-free so the test runs under tsx.

export interface SimJobRecord {
  jobId: string;
  batchIndex: number;
  batchCount: number;
  variantLabels: string[];
  submittedAt: number; // epoch ms
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PRUNE_MS = 2 * 60 * 60_000; // 2h
const keyFor = (routingGroupId: string) => `sim.inflight.${routingGroupId}`;

function defaultStorage(): StorageLike | null {
  try {
    return typeof globalThis !== "undefined" && globalThis.localStorage ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

export function recordJobs(routingGroupId: string, jobs: SimJobRecord[], storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(keyFor(routingGroupId), JSON.stringify(jobs));
  } catch (e) {
    console.error("[SimulationJobStore] recordJobs failed", e);
  }
}

export function clearJobs(routingGroupId: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(keyFor(routingGroupId));
  } catch (e) {
    console.error("[SimulationJobStore] clearJobs failed", e);
  }
}

/** Returns the non-expired job records for a group, pruning (rewriting/clearing) any older than 2h. */
export function getJobs(routingGroupId: string, now: number = Date.now(), storage: StorageLike | null = defaultStorage()): SimJobRecord[] {
  if (!storage) return [];
  let raw: string | null;
  try {
    raw = storage.getItem(keyFor(routingGroupId));
  } catch {
    return [];
  }
  if (!raw) return [];
  let list: SimJobRecord[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    list = parsed;
  } catch {
    return [];
  }
  const fresh = list.filter((j) => now - (j?.submittedAt ?? 0) <= PRUNE_MS);
  if (fresh.length !== list.length) {
    if (fresh.length) recordJobs(routingGroupId, fresh, storage);
    else clearJobs(routingGroupId, storage);
  }
  return fresh;
}

export function removeJob(routingGroupId: string, jobId: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  let raw: string | null;
  try {
    raw = storage.getItem(keyFor(routingGroupId));
  } catch {
    return;
  }
  if (!raw) return;
  let list: SimJobRecord[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    list = parsed;
  } catch {
    return;
  }
  const next = list.filter((j) => j.jobId !== jobId);
  if (next.length) recordJobs(routingGroupId, next, storage);
  else clearJobs(routingGroupId, storage);
}
