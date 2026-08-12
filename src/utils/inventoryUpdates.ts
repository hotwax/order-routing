import { DateTime } from "luxon";

export const ATP_DATA_MANAGER_CONFIG_ID = "IMP_ATP_PROD_FAC";

export const DATA_MANAGER_STATUSES = [
  "DmlsCancelled",
  "DmlsCrashed",
  "DmlsFailed",
  "DmlsFinished",
  "DmlsPending",
  "DmlsQueued",
  "DmlsRunning"
];

export const QUEUED_DATA_MANAGER_STATUSES = ["DmlsPending", "DmlsQueued"];
export const FAILED_DATA_MANAGER_STATUSES = ["DmlsFailed", "DmlsCrashed"];

export const RULE_GROUP_TYPE_LABELS: Record<string, string> = {
  RG_THRESHOLD: "Threshold",
  RG_SAFETY_STOCK: "Safety stock",
  RG_PICKUP_CHANNEL: "Store pickup channel",
  RG_PICKUP_FACILITY: "Store pickup facility",
  RG_SHIPPING_CHANNEL: "Shipping channel",
  RG_SHIPPING_FACILITY: "Shipping facility"
};

export const ATP_INVENTORY_RULE_GROUP_TYPES = Object.freeze(Object.keys(RULE_GROUP_TYPE_LABELS));

export const DATA_MANAGER_STATUS_LABELS: Record<string, string> = {
  DmlsCancelled: "Cancelled",
  DmlsCrashed: "Crashed",
  DmlsFailed: "Failed",
  DmlsFinished: "Finished",
  DmlsPending: "Pending",
  DmlsQueued: "Queued",
  DmlsRunning: "Running"
};

export function isActiveJobRun(run: any): boolean {
  return Boolean(run?.startTime && !run?.endTime);
}

export function isInventoryRuleGroup(group: any): boolean {
  return ATP_INVENTORY_RULE_GROUP_TYPES.includes(String(group?.groupTypeEnumId || ""));
}

export function inventoryUpdateName(group: any): string {
  const typeLabel = RULE_GROUP_TYPE_LABELS[group?.groupTypeEnumId] || "Inventory";
  const configuredName = String(group?.groupName || "").trim();
  const isTechnicalName = !configuredName
    || configuredName === String(group?.ruleGroupId || "")
    || /^M\d+$/.test(configuredName);
  return isTechnicalName ? `${typeLabel} inventory update` : configuredName;
}

export function formatFileSize(size: string | number | null | undefined): string {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatRunDuration(start: any, end: any): string {
  const toDateTime = (value: any) => {
    if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
      return DateTime.fromMillis(Number(value));
    }
    const isoDateTime = DateTime.fromISO(value || "");
    return isoDateTime.isValid ? isoDateTime : DateTime.fromSQL(value || "");
  };
  const startDate = toDateTime(start);
  const endDate = toDateTime(end);
  if (!startDate.isValid || !endDate.isValid || endDate < startDate) return "-";

  const duration = endDate.diff(startDate, ["minutes", "seconds"]);
  const minutes = Math.floor(duration.minutes);
  const seconds = Math.floor(duration.seconds);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
