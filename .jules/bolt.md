## 2026-07-21 - Parallelize stock fetching in stores
**Learning:** Found sequential API calls (N+1 queries) inside `for...of` loops in `fetchStock` methods of Pinia stores (`product.ts` and `productInventory.ts`). This blocked the main execution flow unnecessarily as each request waited for the previous one.
**Action:** Replaced sequential `for...of` loops with `await Promise.all(productIds.map(async (productId) => {...}))` to fire network requests concurrently, significantly reducing data load latency for large product groupings (like ship groups).
