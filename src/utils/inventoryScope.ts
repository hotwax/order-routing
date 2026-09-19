import type { LocationQuery, LocationQueryValue } from "vue-router";

export type LocationInventoryScope = {
  type: "location";
  facilityId: string;
};

export type ChannelInventoryScope = {
  type: "channel";
  channelId: string;
};

export type InvalidInventoryScope = {
  type: "invalid";
  reason: "multiple-scopes" | "multiple-values";
  facilityId: string;
  channelId: string;
};

export type InventoryScope = LocationInventoryScope | ChannelInventoryScope | InvalidInventoryScope;

export type InventoryListLocationScope = {
  type: "location";
  facilityIds: string[];
};

export type InventoryListScope = InventoryListLocationScope | ChannelInventoryScope | InvalidInventoryScope;

export type InventorySignFilter = "" | "positive" | "negative";
export type SafetyStockOperator = "" | "less-than" | "greater-than";

export type InventoryOperationalFilterState = {
  allowBrokering: string;
  allowPickup: string;
  atpFilter: InventorySignFilter;
  qohFilter: InventorySignFilter;
  safetyStockOperator: SafetyStockOperator;
  safetyStockValue: string;
};

export type InventoryListQueryState = InventoryOperationalFilterState & {
  facilityIds?: string[];
  channelId?: string;
  productIds: string[];
  sortField: string;
  pageIndex: number;
};

function firstQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function queryValues(value: LocationQueryValue | LocationQueryValue[] | undefined): string[] {
  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => String(entry || "").split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseInventoryListQuery(query: LocationQuery): InventoryListQueryState {
  const parsedPageIndex = Number(firstQueryValue(query.pageIndex));
  const availableToPromiseFrom = firstQueryValue(query.availableToPromise_from);
  const availableToPromiseThru = firstQueryValue(query.availableToPromise_thru);
  const quantityOnHandFrom = firstQueryValue(query.quantityOnHand_from);
  const quantityOnHandThru = firstQueryValue(query.quantityOnHand_thru);
  const minimumStockFrom = firstQueryValue(query.minimumStock_from);
  const minimumStockThru = firstQueryValue(query.minimumStock_thru);

  return {
    facilityIds: [...new Set(queryValues(query.facilityId))],
    channelId: firstQueryValue(query.channelId),
    productIds: [...new Set(queryValues(query.productId))],
    sortField: firstQueryValue(query.orderByField),
    allowBrokering: firstQueryValue(query.allowBrokering),
    allowPickup: firstQueryValue(query.allowPickup),
    atpFilter: availableToPromiseFrom === "1" ? "positive" : availableToPromiseThru === "-1" ? "negative" : "",
    qohFilter: quantityOnHandFrom === "1" ? "positive" : quantityOnHandThru === "-1" ? "negative" : "",
    safetyStockOperator: minimumStockFrom !== "" ? "greater-than" : minimumStockThru !== "" ? "less-than" : "",
    safetyStockValue: minimumStockFrom || minimumStockThru,
    pageIndex: Number.isInteger(parsedPageIndex) && parsedPageIndex >= 0 ? parsedPageIndex : 0,
  };
}

function inventoryOperationalQueryParams(state: InventoryOperationalFilterState, includeInventory = true): Record<string, string> {
  const params: Record<string, string> = {};
  if(state.allowBrokering) {params.allowBrokering = state.allowBrokering;}
  if(state.allowPickup) {params.allowPickup = state.allowPickup;}
  if(state.safetyStockOperator === "greater-than" && state.safetyStockValue !== "") {params.minimumStock_from = state.safetyStockValue;}
  if(state.safetyStockOperator === "less-than" && state.safetyStockValue !== "") {params.minimumStock_thru = state.safetyStockValue;}

  if(includeInventory) {
    if(state.atpFilter === "positive") {params.availableToPromise_from = "1";}
    if(state.atpFilter === "negative") {params.availableToPromise_thru = "-1";}
    if(state.qohFilter === "positive") {params.quantityOnHand_from = "1";}
    if(state.qohFilter === "negative") {params.quantityOnHand_thru = "-1";}
  }

  return params;
}

export function inventoryOperationalFilterParams(state: InventoryOperationalFilterState, includeInventory = true): Record<string, string> {
  const params = inventoryOperationalQueryParams(state, includeInventory);
  if(state.safetyStockValue === "") {return params;}

  const safetyStockValue = Number(state.safetyStockValue);
  if(!Number.isInteger(safetyStockValue)) {
    delete params.minimumStock_from;
    delete params.minimumStock_thru;

    return params;
  }

  if(state.safetyStockOperator === "greater-than") {params.minimumStock_from = String(safetyStockValue + 1);}
  if(state.safetyStockOperator === "less-than") {params.minimumStock_thru = String(safetyStockValue - 1);}

  return params;
}

export function inventoryListQuery(scope: InventoryListScope, state: InventoryListQueryState): Record<string, string> {
  const query: Record<string, string> = {};
  if(scope.type === "channel") {
    if(scope.channelId) {query.channelId = scope.channelId;}
  } else if(scope.type === "location" && scope.facilityIds.length) {
    query.facilityId = scope.facilityIds.join(",");
    if(scope.facilityIds.length > 1) {query.facilityId_op = "in";}
  }

  if(state.productIds.length) {query.productId = state.productIds.join(",");}
  if(state.sortField) {query.orderByField = state.sortField;}
  Object.assign(query, inventoryOperationalQueryParams(state, scope.type === "location"));
  if(state.pageIndex > 0) {query.pageIndex = String(state.pageIndex);}

  return query;
}

export function parseInventoryListScope(query: LocationQuery): InventoryListScope {
  const facilityIds = [...new Set(queryValues(query.facilityId))];
  const channelId = firstQueryValue(query.channelId);

  if(facilityIds.length && channelId) {
    return { type: "invalid", reason: "multiple-scopes", facilityId: facilityIds.join(","), channelId };
  }

  if(channelId) {return { type: "channel", channelId };}

  return { type: "location", facilityIds };
}

export function parseInventoryScope(query: LocationQuery): InventoryScope {
  const facilityId = firstQueryValue(query.facilityId);
  const channelId = firstQueryValue(query.channelId);

  const hasMultipleValues = [query.facilityId, query.channelId].some((value) =>
    Array.isArray(value) && value.filter(Boolean).length > 1);

  if(hasMultipleValues) {
    return { type: "invalid", reason: "multiple-values", facilityId, channelId };
  }

  if(facilityId && channelId) {
    return { type: "invalid", reason: "multiple-scopes", facilityId, channelId };
  }

  if(channelId) {return { type: "channel", channelId };}

  return { type: "location", facilityId };
}

export function inventoryScopeQuery(scope: InventoryScope): Record<string, string> | undefined {
  if(scope.type === "channel") {return scope.channelId ? { channelId: scope.channelId } : undefined;}
  if(scope.type === "location") {return scope.facilityId ? { facilityId: scope.facilityId } : undefined;}

  return { facilityId: scope.facilityId, channelId: scope.channelId };
}

export function resolveInventoryChannelId(channels: any[], requestedChannelId = "") {
  if(requestedChannelId && channels.some((channel: any) => channel.facilityGroupId === requestedChannelId)) {
    return requestedChannelId;
  }

  return channels[0]?.facilityGroupId || "";
}

export function inventoryScopeErrorMessage(scope: InvalidInventoryScope): string {
  return scope.reason === "multiple-values"
    ? "Use only one facility or channel in the inventory URL."
    : "Choose either a channel or a facility, not both.";
}
