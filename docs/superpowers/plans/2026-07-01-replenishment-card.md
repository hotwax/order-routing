# Replenishment Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a validated Replenishment card to the inventory detail page so a user can understand replenishment behavior for one product at one facility: reorder point, maximum stock, reorder quantity, sales velocity, incoming inventory, and trend history.

**Architecture:** Keep the inventory detail page as the owner of `productId` and `selectedFacilityId`. Add a focused `ReplenishmentCard.vue` presentation component and a `useReplenishmentMetrics.ts` composable that reuses the existing ProductFacility and InventoryItemDetail sources. Put all derived math in pure utility functions so the card can be tested without Ionic.

**Tech Stack:** Vue 3, Ionic Vue, TypeScript, Pinia, Vitest, existing `@common` API client, Maarg `/rest/s1` endpoints only. Do not inspect or depend on `hotwax-oms`.

---

## Validation Summary

Figma node validated:

- File: `bVPRRw282CqGKMdbz7dciH`
- Node: `55613:80264`
- Root component name: `Replenishment`
- Mapped components from Figma descriptions:
  - `Input` maps to Ionic `ion-input`.
  - `Button` maps to Ionic `ion-button`.
  - `Chip` maps to Ionic `ion-chip`.
- Visible labels:
  - `Replenishment`
  - `Reorder point`
  - `Maximum stock`
  - `Reorder quantity`
  - `Save changes`
  - `Sales velocity: 4 units / day`
  - `Incoming: 40 units`
  - `Restock Inventory`

Maarg validation used local registry handle `test-maarg` and did not print credentials.

- Login route: `POST /rest/s1/admin/login`
- Auth header for follow-up calls: `api_key`
- Valid sample pair: `productId=M101717`, `facilityId=CENTRAL_WAREHOUSE`
- `GET /rest/s1/oms/inventoryItem/detail` returned rows with these validated keys:
  - `accountingQuantityDiff`
  - `accountingQuantityTotal`
  - `availableToPromiseDiff`
  - `availableToPromiseTotal`
  - `description`
  - `effectiveDate`
  - `facilityId`
  - `inventoryItemDetailSeqId`
  - `inventoryItemId`
  - `inventoryItemTypeId`
  - `lastAvailableToPromise`
  - `lastQuantityOnHand`
  - `locationSeqId`
  - `physicalInventoryId`
  - `productId`
  - `quantityOnHandDiff`
  - `quantityOnHandTotal`
  - `reasonEnumId`
- `GET /rest/s1/oms/productFacilities/search?productId=M101717&facilityId=CENTRAL_WAREHOUSE&pageSize=1` returned `products[0].inventoryConfig` with these validated keys:
  - `allowBrokering`
  - `allowPickup`
  - `atp`
  - `computedLastInventoryCount`
  - `daysToShip`
  - `lastInventoryCount`
  - `minimumStock`
  - `qoh`
- `GET /rest/s1/oms/productFacilities?productId=M101717&facilityId=CENTRAL_WAREHOUSE&pageSize=1` returned the direct ProductFacility row with these validated keys:
  - `productId`
  - `facilityId`
  - `inventoryItemId`
  - `lastInventoryCount`
  - `computedLastInventoryCount`
  - `createdStamp`
  - `lastUpdatedStamp`
- `maximumStock` and `reorderQuantity` were not returned by either validated ProductFacility endpoint on `test-maarg`.
- `POST /rest/s1/admin/runSolrQuery` is the validated Maarg Solr endpoint. `POST /rest/s1/solr-query` returned 404 on `test-maarg`, so new replenishment code must use `admin/runSolrQuery`.
- Inbound order details validated:
  - `GET /rest/s1/oms/purchaseOrders/{orderId}` returns `order.originFacilityId`, item `productId`, item `quantity`, item `availableToPromise`, item `estimatedDeliveryDate`, and item `statusId`.
  - `GET /rest/s1/oms/transferOrders/{orderId}` returns order/item `facilityId`, item `orderFacilityId`, item `quantity`, item `totalReceivedQuantity`, item `totalIssuedQuantity`, item `statusId`, and ship group `estimatedDeliveryDate`.

## Source Map

### Product and Facility Context

Source file: `src/views/InventoryDetail.vue`

- `productId`: use the existing `productId` ref seeded from `router.currentRoute.value.params.productId`.
- `selectedFacilityId`: use the existing selected facility ref.
- Facility display name: use existing `facilityName(selectedFacilityId.value)`.
- Reload trigger: recompute replenishment whenever `productId` or `selectedFacilityId` changes, after `fetchInventoryConfig()` and `loadInventoryHistory()` complete.

### ProductFacility Data

Endpoint:

```ts
api({
  url: "oms/productFacilities/search",
  method: "GET",
  params: {
    productId,
    facilityId,
    pageSize: 1
  }
})
```

Validated response path:

```ts
const record = response.data?.products?.[0] ?? null;
const config = record?.inventoryConfig ?? null;
```

Use these fields:

- `config.minimumStock`: source for Figma `Reorder point`. This is the existing safety stock/reorder threshold field.
- `config.atp`: source for current sellable inventory position and graph current marker.
- `config.qoh`: source for physical inventory context if the card needs a tooltip or secondary line.
- `config.daysToShip`: validated but not visible in the Figma card. Do not show it in the first implementation unless the design changes.
- `config.allowPickup` and `config.allowBrokering`: validated but not relevant to replenishment. Do not duplicate them in the new card.
- `config.lastInventoryCount` and `config.computedLastInventoryCount`: validated but not visible in the Figma card. Do not show them in the first implementation.

Direct ProductFacility endpoint:

```ts
api({
  url: "oms/productFacilities",
  method: "GET",
  params: {
    productId,
    facilityId,
    pageSize: 1
  }
})
```

Use these direct ProductFacility fields only when needed:

- `inventoryItemId`: source for inventory adjustment actions that need the current item id.
- `lastInventoryCount`: direct ProductFacility last count value.
- `computedLastInventoryCount`: direct ProductFacility computed count value.

Do not use these fields until Maarg exposes them:

- `maximumStock`
- `reorderQuantity`
- `reorderPoint`

Current backend behavior ignores these fields in `fieldsToSelect` and does not return them. The frontend must not invent persisted values for them.

### InventoryItemDetail Data

Endpoint:

```ts
api({
  url: "oms/inventoryItem/detail",
  method: "GET",
  params: {
    productId,
    facilityId,
    pageSize: 250,
    orderByField: "effectiveDate desc"
  }
})
```

Use these fields:

- `effectiveDate`: x-axis timestamp for the replenishment trend.
- `availableToPromiseTotal`: post-movement ATP value for trend points.
- `lastAvailableToPromise`: fallback base ATP value when `availableToPromiseTotal` is not present.
- `availableToPromiseDiff`: delta for sales velocity and fallback post-movement ATP calculation.
- `quantityOnHandTotal`: post-movement QOH value if a QOH trend is later needed.
- `lastQuantityOnHand`: fallback base QOH value when `quantityOnHandTotal` is not present.
- `quantityOnHandDiff`: movement delta for QOH.
- `orderId`: join key for classifying sales order demand and inbound order types.
- `inventoryItemId`: stable row identity and adjustment source reference.
- `inventoryItemDetailSeqId`: stable row identity.
- `reasonEnumId`, `physicalInventoryId`, `description`: classification support, not directly displayed in the card.

Trend point formula:

```ts
const atpAfter = numberOrNull(row.availableToPromiseTotal)
  ?? addNumbers(row.lastAvailableToPromise, row.availableToPromiseDiff);
```

Use `availableToPromiseTotal` first because it is the explicit post-movement balance. Use `lastAvailableToPromise + availableToPromiseDiff` only as a fallback.

### Sales Velocity

Source: `InventoryItemDetail` rows plus order summaries resolved from `admin/runSolrQuery`.

Order summary endpoint:

```ts
api({
  url: "admin/runSolrQuery",
  method: "POST",
  data: {
    json: {
      params: {
        rows: orderIds.length,
        group: true,
        "group.field": "orderId",
        "group.limit": 1,
        "group.ngroups": true,
        "q.op": "AND",
        start: 0,
        fl: "orderId,orderName,orderTypeId,orderStatusId,orderStatusDesc,orderDate,customerPartyName,facilityId,productId,quantity",
        defType: "edismax"
      },
      query: "*:*",
      filter: `docType: ORDER AND orderId: (${orderIds.map((id) => `"${id}"`).join(" OR ")})`
    }
  }
})
```

Calculation:

- Window: rolling 30 days ending at `DateTime.now()`.
- Include rows where:
  - `row.effectiveDate` is inside the rolling 30-day window.
  - `Number(row.availableToPromiseDiff) < 0`.
  - `row.orderId` is present.
  - joined order summary has `orderTypeId === "SALES_ORDER"`.
- Quantity: `Math.abs(Number(row.availableToPromiseDiff))`.
- Velocity: `sum(quantity) / 30`.
- Display: one decimal when not an integer, otherwise no decimal.
- Empty case: display `Sales velocity: 0 units / day`.

### Incoming Units

Source: candidate inbound orders from `admin/runSolrQuery`, confirmed with Maarg order-detail endpoints.

Candidate query:

```ts
api({
  url: "admin/runSolrQuery",
  method: "POST",
  data: {
    json: {
      params: {
        rows: 100,
        start: 0,
        fl: "orderId,orderName,orderTypeId,orderStatusId,orderStatusDesc,orderDate,productId,facilityId,quantity",
        "q.op": "AND",
        defType: "edismax"
      },
      query: "*:*",
      filter: `docType: ORDER AND productId: "${productId}" AND (orderTypeId: PURCHASE_ORDER OR orderTypeId: TRANSFER_ORDER) AND -orderStatusId: ORDER_CANCELLED AND -orderStatusId: ORDER_COMPLETED`
    }
  }
})
```

Purchase order detail:

```ts
api({
  url: `oms/purchaseOrders/${orderId}`,
  method: "GET"
})
```

Purchase order incoming rule:

- Use `order.originFacilityId` as the receiving facility.
- Include only if `order.originFacilityId === selectedFacilityId`.
- Include item rows where `item.productId === productId`.
- Exclude item statuses `ITEM_CANCELLED`, `ITEM_COMPLETED`, and `ITEM_REJECTED`.
- Remaining quantity: `Number(item.availableToPromise ?? item.quantity ?? 0)`.

Transfer order detail:

```ts
api({
  url: `oms/transferOrders/${orderId}`,
  method: "GET"
})
```

Transfer order incoming rule:

- Use `item.orderFacilityId` or `shipGroup.orderFacilityId` as the destination facility.
- Use `item.facilityId` as the source facility.
- Include only if destination facility equals `selectedFacilityId`.
- Include item rows where `item.productId === productId`.
- Include item statuses `ITEM_CREATED`, `ITEM_APPROVED`, and `ITEM_PENDING_RECEIPT`.
- Remaining quantity: `Number(item.quantity ?? 0) - Number(item.totalReceivedQuantity ?? 0)`.
- Ignore rows with remaining quantity less than or equal to zero.

Display:

- Sum purchase and transfer remaining quantities.
- Display `Incoming: {incomingUnits} units`.
- If the candidate query or detail calls fail, display `Incoming unavailable` rather than a misleading zero.

### Maximum Stock and Reorder Quantity

Current validated Maarg responses do not expose persisted `maximumStock` or `reorderQuantity` fields for ProductFacility.

First frontend implementation must behave this way:

- Render `Maximum stock` and `Reorder quantity` as disabled read-only fields with an unavailable value, or hide them behind a disabled state, until the Maarg API exposes them.
- Save only `minimumStock` from the first version.
- Do not calculate and persist a fake `reorderQuantity`.
- Do not derive `maximumStock` from history.

When Maarg exposes the fields, update the source map:

- `config.maximumStock`: Figma `Maximum stock`.
- `config.reorderQuantity`: Figma `Reorder quantity`.
- Save payload includes both fields after integer validation.

### Save Changes

Endpoint:

```ts
api({
  url: "oms/productFacilities",
  method: "POST",
  data: [
    {
      productId,
      facilityId,
      minimumStock
    }
  ]
})
```

Validation:

- Accept only non-negative integers.
- Save only fields that changed.
- First implementation saves `minimumStock` only.
- After a successful save, refetch ProductFacility config and replenishment metrics.
- Show existing toast pattern through `commonUtil.showToast`.

### Restock Inventory

Do not implement direct inventory mutation from this button.

Validated safe behavior:

- Use Fast Travel via `buildAppUrl` only after the target app route is confirmed.
- Prefer PreOrder for purchase order creation.
- If no create route is confirmed or no `VITE_PREORDER_URL` is configured, render the button disabled.

Existing validated registry:

```ts
buildAppUrl("preorder", path, query)
buildAppUrl("transfers", path, query)
```

First implementation rule:

- Keep `Restock Inventory` disabled with explanatory helper text unless the implementing agent confirms a working PreOrder or Transfers create route in the target environment.

## File Changes

Create:

- `src/components/ReplenishmentCard.vue`
- `src/composables/useReplenishmentMetrics.ts`
- `src/utils/replenishmentMetrics.ts`
- `tests/replenishmentMetrics.test.ts`

Modify:

- `src/views/InventoryDetail.vue`
- `src/composables/useProductFacility.ts`
- `src/locales/en.json`

Do not modify existing CSS blocks for current pages or components. If layout CSS is needed, add scoped CSS only inside the new `ReplenishmentCard.vue`, and do not define font-family, text color, background color, or custom Ionic color values.

## Implementation Tasks

### 1. Add Pure Metric Utilities

- [ ] Create `src/utils/replenishmentMetrics.ts`.
- [ ] Export typed helpers for numeric conversion, trend point construction, sales velocity, and incoming-unit aggregation.

Use this shape:

```ts
export interface InventoryDetailRow {
  effectiveDate?: string | number;
  availableToPromiseTotal?: string | number;
  availableToPromiseDiff?: string | number;
  lastAvailableToPromise?: string | number;
  quantityOnHandTotal?: string | number;
  quantityOnHandDiff?: string | number;
  lastQuantityOnHand?: string | number;
  orderId?: string;
}

export interface OrderSummary {
  orderId: string;
  orderTypeId?: string;
}

export interface TrendPoint {
  timestamp: number;
  atp: number;
}
```

Rules:

- [ ] `toNumber(value)` returns `null` for blank, null, undefined, or non-numeric values.
- [ ] `buildTrendPoints(rows)` sorts by timestamp ascending and uses `availableToPromiseTotal` before the fallback calculation.
- [ ] `calculateSalesVelocity(rows, orderSummaries, now, days)` filters negative ATP sales rows only.
- [ ] `formatUnitsPerDay(value)` returns `0`, integer string, or one-decimal string.

### 2. Add Replenishment Composable

- [ ] Create `src/composables/useReplenishmentMetrics.ts`.
- [ ] Use the existing `api` and `logger` imports from `@common`.
- [ ] Fetch candidate inbound orders through `admin/runSolrQuery`.
- [ ] Fetch purchase order details through `oms/purchaseOrders/{orderId}`.
- [ ] Fetch transfer order details through `oms/transferOrders/{orderId}`.
- [ ] Return a single state object:

```ts
export interface ReplenishmentMetrics {
  loading: boolean;
  incomingLoading: boolean;
  incomingUnavailable: boolean;
  incomingUnits: number;
  salesVelocityUnitsPerDay: number;
  trendPoints: TrendPoint[];
}
```

Implementation constraints:

- [ ] Cache order details by `orderId` inside the composable instance.
- [ ] Do not use `solr-query`.
- [ ] Do not call any `hotwax-oms` endpoint or repo code.
- [ ] Treat incoming failures as metric-level failures, not page-level failures.

### 3. Update ProductFacility Types

- [ ] Modify `src/composables/useProductFacility.ts`.
- [ ] Make the ProductFacility interface match the validated shape and future fields without requiring unavailable values:

```ts
interface ProductFacilityConfig {
  allowBrokering?: string | null;
  allowPickup?: string | null;
  atp?: string | number | null;
  qoh?: string | number | null;
  minimumStock?: string | number | null;
  daysToShip?: string | number | null;
  computedLastInventoryCount?: string | number | null;
  lastInventoryCount?: string | number | null;
  inventoryItemId?: string | null;
  maximumStock?: string | number | null;
  reorderQuantity?: string | number | null;
}
```

- [ ] Keep `fetchProductFacility`, `fetchInventoryLogs`, and `updateProductFacility` API routes unchanged.
- [ ] Do not add module-level singleton state.

### 4. Build Replenishment Card

- [ ] Create `src/components/ReplenishmentCard.vue`.
- [ ] Use only core Ionic components:
  - `ion-card`
  - `ion-card-header`
  - `ion-card-title`
  - `ion-card-content`
  - `ion-item`
  - `ion-input`
  - `ion-button`
  - `ion-chip`
  - `ion-label`
  - `ion-skeleton-text`
- [ ] Do not use `ion-grid`, `ion-row`, or Ionic grid utility classes.
- [ ] Keep CSS scoped to this new file and use only layout properties such as `display`, `gap`, `align-items`, `min-height`, and `overflow`.
- [ ] Do not set colors, fonts, or box shadows manually. Let Ionic card/input/chip/button styles provide visual treatment.

Props:

```ts
const props = defineProps<{
  productId: string;
  facilityId: string;
  minimumStock: string | number | null | undefined;
  maximumStock?: string | number | null;
  reorderQuantity?: string | number | null;
  salesVelocityUnitsPerDay: number;
  incomingUnits: number;
  incomingUnavailable: boolean;
  trendPoints: TrendPoint[];
  isLoading: boolean;
  isSaving: boolean;
  restockHref: string | null;
}>();
```

Emits:

```ts
const emit = defineEmits<{
  (event: "save", payload: { minimumStock: number }): void;
}>();
```

Card behavior:

- [ ] `Reorder point` is editable and bound to `minimumStock`.
- [ ] `Maximum stock` is disabled until `maximumStock` is present from Maarg.
- [ ] `Reorder quantity` is disabled until `reorderQuantity` is present from Maarg.
- [ ] `Save changes` emits only changed editable values.
- [ ] `Sales velocity` chip uses `salesVelocityUnitsPerDay`.
- [ ] `Incoming` chip uses `incomingUnits` or `Incoming unavailable`.
- [ ] `Restock Inventory` is an anchor button only when `restockHref` is non-null; otherwise disabled.

### 5. Render Trend Graph Without New Dependencies

- [ ] Implement an inline SVG inside `ReplenishmentCard.vue`.
- [ ] Keep it simple: one ATP line, optional reorder point dashed line, optional maximum stock dashed line, current ATP marker.
- [ ] Do not add chart libraries.
- [ ] Do not use external Figma image assets for the graph.

Graph source rules:

- x-axis: `TrendPoint.timestamp`.
- y-axis: `TrendPoint.atp`.
- reorder point line: `minimumStock`, when numeric.
- maximum stock line: `maximumStock`, only when numeric.
- current marker: latest trend point or current `config.atp` fallback.

Empty graph behavior:

- [ ] If there are no trend points, show a compact empty state inside the card: `No inventory movement yet`.

### 6. Wire Into Inventory Detail

- [ ] Modify `src/views/InventoryDetail.vue`.
- [ ] Import `ReplenishmentCard`.
- [ ] Import `useReplenishmentMetrics`.
- [ ] Instantiate the replenishment composable next to the existing ProductFacility composable.
- [ ] After `fetchInventoryConfig()` and `loadInventoryHistory()`, compute metrics from the already-loaded `inventoryLogs` and the selected product/facility.
- [ ] Insert the card after the existing facility/inventory summary card and before the inventory history section.
- [ ] Avoid duplicate information:
  - Keep QOH and ATP in the current inventory summary.
  - Do not also show safety stock/reorder point in the old configuration section once the Replenishment card is present.
  - Keep `Allow Brokering`, `Allow Pickup`, and `Days to Ship` in the configuration section.

Save handler:

```ts
async function saveReplenishmentConfig(payload: { minimumStock: number }) {
  await productFacilityApi.updateProductFacility([
    {
      productId: productId.value,
      facilityId: selectedFacilityId.value,
      minimumStock: payload.minimumStock
    }
  ]);
  await fetchInventoryConfig();
  await refreshReplenishmentMetrics();
}
```

### 7. Add Translations

- [ ] Modify `src/locales/en.json`.
- [ ] Add these keys if missing:
  - `Replenishment`
  - `Reorder point`
  - `Maximum stock`
  - `Reorder quantity`
  - `Sales velocity: {value} units / day`
  - `Incoming: {value} units`
  - `Incoming unavailable`
  - `Restock Inventory`
  - `No inventory movement yet`
  - `Replenishment settings saved`
  - `Replenishment settings could not be saved`
  - `Maximum stock is not available from Maarg yet`
  - `Reorder quantity is not available from Maarg yet`

### 8. Tests

- [ ] Add `tests/replenishmentMetrics.test.ts`.
- [ ] Cover trend point calculation from `availableToPromiseTotal`.
- [ ] Cover trend fallback from `lastAvailableToPromise + availableToPromiseDiff`.
- [ ] Cover sales velocity including only negative ATP rows for joined `SALES_ORDER` summaries.
- [ ] Cover incoming transfer remaining quantity as `quantity - totalReceivedQuantity`.
- [ ] Cover incoming purchase quantity from `availableToPromise` fallback to `quantity`.
- [ ] Cover unavailable incoming state in the composable with mocked API rejection.

Run:

```bash
pnpm test:unit -- tests/replenishmentMetrics.test.ts
pnpm test:unit
pnpm build
```

### 9. Manual Validation

- [ ] Start from the inventory detail branch, not the consolidated editor branch.
- [ ] Start the app:

```bash
pnpm dev --host 0.0.0.0 --port 8104
```

- [ ] Open `http://localhost:8104/inventory`.
- [ ] Navigate to a product that has inventory history at the selected facility.
- [ ] Confirm the card appears on `/inventory/:productId`.
- [ ] Change facility and confirm:
  - reorder point refetches,
  - sales velocity recalculates,
  - incoming recalculates,
  - graph redraws.
- [ ] Save a valid reorder point and confirm `oms/productFacilities` POST is called with only `productId`, `facilityId`, and `minimumStock`.
- [ ] Confirm no request uses `solr-query`.
- [ ] Confirm no request uses an endpoint from `hotwax-oms`.
- [ ] Confirm maximum stock and reorder quantity are disabled or unavailable until Maarg exposes fields.

## Execution Order

1. Maarg API prerequisite: expose and validate persisted `maximumStock` and `reorderQuantity` for ProductFacility if those fields are required for the first release.
2. Frontend data utilities: implement and test `src/utils/replenishmentMetrics.ts`.
3. Frontend data composable: implement `src/composables/useReplenishmentMetrics.ts`.
4. UI component: implement `src/components/ReplenishmentCard.vue` with Ionic components only.
5. Inventory detail integration: render the card and wire save/refresh.
6. Restock action: enable only after a real PreOrder or Transfers create route is validated.
7. Full verification: run unit tests, build, and browser validation on localhost.

## Non-Goals

- Do not implement a new restock creation service in Order Routing.
- Do not use `hotwax-oms`.
- Do not persist `maximumStock` or `reorderQuantity` until Maarg exposes them in validated API responses.
- Do not add chart libraries.
- Do not modify existing CSS files or existing style blocks.
- Do not use Ionic grid components or grid utility classes for the new card.
