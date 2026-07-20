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

function firstQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
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
