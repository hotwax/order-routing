import assert from "assert";
import { mergeEvents } from "../src/util/progressBuffer";
import { OrderEvent } from "../src/types/simulation";

const ev = (seq: number): OrderEvent => ({ seq, orderId: `O${seq}`, facilityId: null, finalReason: "QUEUED" });

// appends incoming to existing
{
  const out = mergeEvents([ev(1), ev(2)], [ev(3)], 50);
  assert.deepStrictEqual(out.map((e) => e.seq), [1, 2, 3], "appends in order");
}

// caps at the most recent `cap` events (keeps newest)
{
  const existing = [ev(1), ev(2), ev(3)];
  const out = mergeEvents(existing, [ev(4), ev(5)], 3);
  assert.deepStrictEqual(out.map((e) => e.seq), [3, 4, 5], "keeps the last `cap`");
}

// empty inputs
{
  assert.deepStrictEqual(mergeEvents([], [], 50), [], "empty in → empty out");
  assert.deepStrictEqual(mergeEvents([ev(1)], [], 50).map((e) => e.seq), [1], "no incoming keeps existing");
}

// exactly at cap → keep all
{
  const out = mergeEvents([ev(1), ev(2)], [ev(3)], 3);
  assert.deepStrictEqual(out.map((e) => e.seq), [1, 2, 3], "exact-cap keeps all");
}

console.log("progressBuffer tests passed");
