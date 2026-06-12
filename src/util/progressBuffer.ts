// src/util/progressBuffer.ts
import { OrderEvent } from "../types/simulation";

/** Append server-cursor-deduped `incoming` events to `existing`, keeping only the most recent
 *  `cap` (the rolling window). Order is preserved (oldest→newest). */
export function mergeEvents(existing: OrderEvent[], incoming: OrderEvent[], cap = 50): OrderEvent[] {
  const all = [...existing, ...incoming];
  return all.length > cap ? all.slice(all.length - cap) : all;
}
