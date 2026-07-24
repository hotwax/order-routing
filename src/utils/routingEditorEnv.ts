export interface RoutingEditorEnumConfig {
  id: string;
  code: string;
}

export type RoutingEditorEnumMap = Record<string, RoutingEditorEnumConfig>;

export const DEFAULT_RULE_ENUMS: RoutingEditorEnumMap = {
  QUEUE: { id: "OIP_QUEUE", code: "facilityId" },
  QUEUE_EXCLUDED: { id: "OIP_QUEUE_EXCLUDED", code: "facilityId_excluded" },
  PROD_CATEGORY: { id: "OIP_PROD_CATEGORY", code: "productCategoryId" },
  PROD_CATEGORY_EXCLUDED: { id: "PROD_CATEGORY_EXCLUDED", code: "productCategoryId_excluded" },
  SHIPPING_METHOD: { id: "OIP_SHIP_METH_TYPE", code: "shipmentMethodTypeId" },
  SHIPPING_METHOD_EXCLUDED: { id: "OIP_SHIP_METH_TYPE_EXCLUDED", code: "shipmentMethodTypeId_excluded" },
  PRIORITY: { id: "OIP_PRIORITY", code: "priority" },
  PRIORITY_EXCLUDED: { id: "OIP_PRIORITY_EXCLUDED", code: "priority_excluded" },
  PROMISE_DATE: { id: "OIP_PROMISE_DATE", code: "promiseDaysCutoff" },
  PROMISE_DATE_EXCLUDED: { id: "OIP_PROMISE_DATE_EXCLUDED", code: "promiseDaysCutoff_excluded" },
  SALES_CHANNEL: { id: "OIP_SALES_CHANNEL", code: "salesChannelEnumId" },
  SALES_CHANNEL_EXCLUDED: { id: "OIP_SALES_CHANNEL_EXCLUDED", code: "salesChannelEnumId_excluded" },
  ORIGIN_FACILITY_GROUP: { id: "OIP_ORIGIN_FAC_GRP", code: "originFacilityGroupId" },
  ORIGIN_FACILITY_GROUP_EXCLUDED: { id: "OIP_ORIGIN_FAC_GRP_EXCLUDED", code: "originFacilityGroupId_excluded" },
  SHIP_BY: { id: "OSP_SHIP_BY", code: "shipBeforeDate" },
  SHIP_AFTER: { id: "OSP_SHIP_AFTER", code: "shipAfterDate" },
  ORDER_DATE: { id: "OSP_ORDER_DATE", code: "orderDate" },
  SHIPPING_METHOD_SORT: { id: "OSP_SHIP_METH", code: "deliveryDays" },
  SORT_PRIORITY: { id: "OSP_PRIORITY", code: "priority" }
};

export const DEFAULT_CONDITION_FILTER_ENUMS: RoutingEditorEnumMap = {
  FACILITY_GROUP: { id: "IIP_FACILITY_GROUP", code: "facilityGroupId" },
  FACILITY_GROUP_EXCLUDED: { id: "IIP_FACILITY_GROUP_EXCLUDED", code: "facilityGroupId_excluded" },
  PROXIMITY: { id: "IIP_PROXIMITY", code: "distance" },
  BRK_SAFETY_STOCK: { id: "IIP_BRK_SFTY_STOCK", code: "brokeringSafetyStock" },
  MEASUREMENT_SYSTEM: { id: "IIP_MSMNT_SYSTEM", code: "measurementSystem" },
  SPLIT_ITEM_GROUP: { id: "IIP_SPLIT_ITEM_GROUP", code: "splitOrderItemGroup" },
  FACILITY_ORDER_LIMIT: { id: "IFP_IGNORE_ORD_FAC_LIMIT", code: "ignoreFacilityOrderLimit" },
  SHIP_THRESHOLD: { id: "IFP_SHIP_THREHOLD", code: "shipmentThreshold" },
  WOS: { id: "IFP_WOS", code: "weekOfSupply" }
};

export const DEFAULT_CONDITION_SORT_ENUMS: RoutingEditorEnumMap = {
  PROXIMITY: { id: "ISP_PROXIMITY", code: "distance" },
  INV_BALANCE: { id: "ISP_INV_BAL", code: "inventoryForAllocation" },
  CUSTOMER_SEQ: { id: "ISP_CUST_SEQ", code: "facilitySequence" }
};

export const DEFAULT_ACTION_ENUMS: RoutingEditorEnumMap = {
  RM_AUTO_CANCEL_DATE: { id: "ORA_RM_CANCEL_DATE", code: "RM_AUTO_CANCEL_DATE" },
  AUTO_CANCEL_DAYS: { id: "ORA_AUTO_CANCEL_DAYS", code: "ADD_AUTO_CANCEL_DATE" },
  NEXT_RULE: { id: "ORA_NEXT_RULE", code: "NEXT_RULE" },
  MOVE_TO_QUEUE: { id: "ORA_MV_TO_QUEUE", code: "MOVE_TO_QUEUE" }
};

function cloneEnumMap(value: RoutingEditorEnumMap): RoutingEditorEnumMap {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, { ...entry }])
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Parse one of the routing-editor enum environment variables without making the
 * application boot dependent on perfectly formed deployment configuration.
 *
 * Missing default entries are retained, partial entries inherit their default
 * id/code, and malformed/custom entries are ignored. A returned map is always a
 * fresh object so a consumer cannot mutate the shared defaults.
 */
export function parseRoutingEditorEnvJson(
  value: string | undefined,
  fallback: RoutingEditorEnumMap
): RoutingEditorEnumMap {
  const merged = cloneEnumMap(fallback);
  if (!value?.trim()) return merged;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return merged;
  }

  if (!isObject(parsed)) return merged;

  Object.entries(parsed).forEach(([key, candidate]) => {
    if (!isObject(candidate)) return;

    const defaultEntry = merged[key];
    const id = isNonEmptyString(candidate.id) ? candidate.id : defaultEntry?.id;
    const code = isNonEmptyString(candidate.code) ? candidate.code : defaultEntry?.code;
    if (!id || !code) return;

    merged[key] = { id, code };
  });

  return merged;
}

/** Safely parse string-to-string deployment maps such as cron-expression labels. */
export function parseRoutingStringRecordEnvJson(
  value: string | undefined,
  fallback: Record<string, string> = {}
): Record<string, string> {
  const merged = { ...fallback };
  if (!value?.trim()) return merged;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isObject(parsed)) return merged;
    Object.entries(parsed).forEach(([key, candidate]) => {
      if (isNonEmptyString(key) && isNonEmptyString(candidate)) merged[key] = candidate;
    });
  } catch {
    return merged;
  }
  return merged;
}
