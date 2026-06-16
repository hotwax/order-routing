// tests/simulationHistoryCache.test.ts
import assert from "assert";
import * as Cache from "../src/services/simulationStorage";

// In-memory StorageLike for headless testing.
function mem(): Cache.StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}
const hdr = (id: string, createdDate: string, statusId = "COMPLETE") =>
  ({ simulationId: id, productStoreId: "STORE", statusId, createdDate } as any);

// list set/get roundtrip, scoped by productStoreId.
{
  const s = mem();
  Cache.setList("STORE", [hdr("A", "2026-06-09T10:00:00Z"), hdr("B", "2026-06-09T09:00:00Z")], Date.now(), s);
  const got = Cache.getList("STORE", Date.now(), s);
  assert.strictEqual(got.length, 2, "roundtrip 2 headers");
  assert.strictEqual(Cache.getList("OTHER", Date.now(), s).length, 0, "other store bucket empty");
}

// list capped at 50 newest by createdDate desc.
{
  const s = mem();
  const many = Array.from({ length: 60 }, (_, i) => hdr(`S${i}`, `2026-06-09T${String(i % 24).padStart(2, "0")}:00:00Z`));
  Cache.setList("STORE", many, Date.now(), s);
  assert.strictEqual(Cache.getList("STORE", Date.now(), s).length, 50, "capped at 50");
}

// detail LRU put/get; eviction past 25 (least-recently-read goes first).
{
  const s = mem();
  const now = Date.now();
  for (let i = 0; i < 25; i++) Cache.putDetail(`D${i}`, { header: hdr(`D${i}`, "2026-06-09T10:00:00Z"), raw: { simulationId: `D${i}` }, cachedAt: now }, s);
  Cache.getDetail("D0", Date.now(), s);                // touch D0 so it's most-recent
  Cache.putDetail("D25", { header: hdr("D25", "2026-06-09T10:00:00Z"), raw: {}, cachedAt: now }, s); // evicts LRU (D1)
  assert.ok(Cache.getDetail("D0", Date.now(), s), "D0 survives (recently read)");
  assert.strictEqual(Cache.getDetail("D1", Date.now(), s), null, "D1 evicted");
}

// 30-day prune on read (list + detail).
{
  const s = mem();
  const now = 30 * 864e5 + 1000;
  Cache.setList("STORE", [hdr("OLD", "2026-01-01T00:00:00Z")], 0, s); // cachedAt 0 -> > 30d old at `now`
  assert.strictEqual(Cache.getList("STORE", now, s).length, 0, "stale list pruned");
  Cache.putDetail("OLDD", { header: hdr("OLDD", "2026-01-01T00:00:00Z"), raw: {}, cachedAt: 0 }, s);
  assert.strictEqual(Cache.getDetail("OLDD", now, s), null, "stale detail pruned");
}

// corrupt JSON tolerated.
{
  const s = mem();
  s.map.set("sim.history.list.STORE", "{not json");
  assert.deepStrictEqual(Cache.getList("STORE", Date.now(), s), [], "corrupt list -> []");
}

// null storage is a no-op (SSR / unavailable).
{
  assert.deepStrictEqual(Cache.getList("STORE", Date.now(), null), [], "null storage -> []");
  Cache.setList("STORE", [hdr("A", "2026-06-09T10:00:00Z")], Date.now(), null); // must not throw
}

console.log("SimulationHistoryCache tests passed");
