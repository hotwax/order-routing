## 2026-07-21 - Parallelize stock fetching in stores
**Learning:** Found sequential API calls (N+1 queries) inside `for...of` loops in `fetchStock` methods of Pinia stores (`product.ts` and `productInventory.ts`). This blocked the main execution flow unnecessarily as each request waited for the previous one.
**Action:** Replaced sequential `for...of` loops with `await Promise.all(productIds.map(async (productId) => {...}))` to fire network requests concurrently, significantly reducing data load latency for large product groupings (like ship groups).

## 2026-07-28 - Parallelize utilStore enum fetching
**Learning:** Found sequential API calls inside a `for...of` loop in `fetchRoutingEditorEnums`. They were intentionally sequential due to a race condition caused by stale state snapshotting during the merge in `fetchEnums`. By refactoring the update pattern to not use snapshots (`this.state = { ...this.state, ...newData }`), we successfully removed the bottleneck.
**Action:** Refactored `fetchEnums` to safely merge state immediately and replaced the `for...of` loop in `fetchRoutingEditorEnums` with `await Promise.all()` to fire network requests concurrently, improving initialization latency.
