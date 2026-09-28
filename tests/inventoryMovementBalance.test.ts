import { describe, expect, it } from "vitest";
import { movementBalance } from "../src/utils/inventoryMovement";

// Real rows for product 142834 at facility 100013 (NYC - Greene St.), whose card reads QOH 2 / ATP 2.
describe("movementBalance", () => {
  it("reports the balance the movement left behind, from the backend's own prior balance", () => {
    // TO11283: prior balance 0, receives 4
    expect(movementBalance({ lastQuantityOnHand: 0, quantityOnHandDiff: 4, lastAvailableToPromise: 0, availableToPromiseDiff: 4 }))
      .toEqual({ qoh: 4, atp: 4 });
    // TO11484: prior balance 4, receives 2
    expect(movementBalance({ lastQuantityOnHand: 4, quantityOnHandDiff: 2, lastAvailableToPromise: 4, availableToPromiseDiff: 2 }))
      .toEqual({ qoh: 6, atp: 6 });
  });

  it("does not reconstruct the balance by summing diffs, which drifts from the truth", () => {
    // The row after TO11484 reports a prior balance of 6 even though accumulating the earlier diffs
    // from zero lands on 5 — the delta chain is discontinuous, so the backend figure is authoritative.
    expect(movementBalance({ lastQuantityOnHand: 6, quantityOnHandDiff: -2 }).qoh).toBe(4);
  });

  // Guard for issue #469: the display was removed once because it invented a balance from a fake
  // 0 baseline when these keys were absent. An unknown balance must stay unknown.
  it("returns null rather than fabricating a 0 baseline when the prior balance is missing", () => {
    expect(movementBalance({ quantityOnHandDiff: 3, availableToPromiseDiff: 3 })).toEqual({ qoh: null, atp: null });
    expect(movementBalance({ lastQuantityOnHand: null, quantityOnHandDiff: -100 }).qoh).toBeNull();
    expect(movementBalance({ lastQuantityOnHand: "", quantityOnHandDiff: -100 }).qoh).toBeNull();
  });

  it("never substitutes quantityOnHandTotal, which is the item's current total on every row", () => {
    // quantityOnHandTotal is 2 on all 19 rows of this product's history; using it would render the
    // same balance everywhere.
    expect(movementBalance({ quantityOnHandTotal: 2, availableToPromiseTotal: 2, quantityOnHandDiff: 4 }))
      .toEqual({ qoh: null, atp: null });
  });

  it("treats a zero prior balance and a zero diff as real values", () => {
    expect(movementBalance({ lastQuantityOnHand: 0, quantityOnHandDiff: 0, lastAvailableToPromise: 0, availableToPromiseDiff: 0 }))
      .toEqual({ qoh: 0, atp: 0 });
  });

  it("tolerates a missing diff and string-encoded numbers", () => {
    expect(movementBalance({ lastQuantityOnHand: 3 }).qoh).toBe(3);
    expect(movementBalance({ lastQuantityOnHand: "3", quantityOnHandDiff: "-1" }).qoh).toBe(2);
  });
});
