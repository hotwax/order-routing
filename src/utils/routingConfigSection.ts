const targetLabels: Record<string, string> = {
  "newRouting.name": "Routing name",
  "route.statusId": "Status",
  "selectedRule.statusId": "Status",
  "selectedRule.partialAllocation": "Allow partial allocation",
  "selectedRule.partialGroupItemsAllocation": "Partially allocate grouped items",
  "selectedRule.unavailableItemsAction": "Move unavailable items to",
  "selectedRule.unavailableItemsQueueId": "Unavailable items queue",
  "selectedRule.clearAutoCancelDays": "Clear auto cancel days",
  "selectedRule.autoCancelDays": "Auto cancel days"
};

const settingLabels: Record<string, string> = {
  FACILITY_GROUP: "Group",
  FACILITY_GROUP_EXCLUDED: "Excluded group",
  PROXIMITY: "Proximity",
  MEASUREMENT_SYSTEM: "Measurement unit",
  BRK_SAFETY_STOCK: "Safety stock",
  FACILITY_ORDER_LIMIT: "Facility order limit",
  SHIP_THRESHOLD: "Shipment threshold",
  WOS: "Week of supply",
  QUEUE: "Queue",
  QUEUE_EXCLUDED: "Excluded queue",
  SHIPPING_METHOD: "Shipping method",
  SHIPPING_METHOD_EXCLUDED: "Excluded shipping method",
  PRIORITY: "Order priority",
  PRIORITY_EXCLUDED: "Excluded order priority",
  PROMISE_DATE: "Promise date",
  PROMISE_DATE_EXCLUDED: "Excluded promise date",
  SALES_CHANNEL: "Sales channel",
  SALES_CHANNEL_EXCLUDED: "Excluded sales channel",
  ORIGIN_FACILITY_GROUP: "Origin facility group",
  ORIGIN_FACILITY_GROUP_EXCLUDED: "Excluded origin facility group",
  SHIP_BY: "Ship by date",
  SHIP_AFTER: "Ship after date",
  ORDER_DATE: "Order date",
  SHIPPING_METHOD_SORT: "Shipping method",
  SORT_PRIORITY: "Order priority",
  INV_BALANCE: "Inventory balance",
  CUSTOMER_SEQ: "Custom sequence"
};

export function routingConfigTargetLabel(target: string) {
  if (targetLabels[target]) return targetLabels[target];
  const setting = target.split(".").pop() || target;
  return settingLabels[setting] || humanizeRoutingConfigValue(setting);
}

export function humanizeRoutingConfigValue(value: string) {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}
