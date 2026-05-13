import { ZodError } from "zod/v4";
import {
  brokeringRouteDraftSchema
} from "./brokeringRouteDraftSchema";
import type {
  BrokeringRouteDraft
} from "./brokeringRouteDraftSchema";
import type {
  DraftValue,
  PageCapabilityManifest
} from "./pageCapabilitySchema";

// This service is the strict gate for the brokering-route-draft.v1 contract.
// The Zod schema validates the exact JSON shape. This file then validates
// cross-field business rules and manifest-backed option IDs before Mastra
// returns the draft object to the PWA.

type DraftOption = {
  id: string;
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
};

type DraftTargetDependency = {
  target: string;
  values: DraftValue[];
  description?: string;
};

type DraftTargetCapability = {
  target: string;
  label?: string;
  valueType?: string;
  currentValue?: DraftValue;
  options?: DraftOption[];
  multiple?: boolean;
  editable?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  staticDisabled?: boolean;
  dependencies?: DraftTargetDependency[];
};

type ValidationContext = {
  issues: string[];
  targets: Map<string, DraftTargetCapability>;
  currentValues: Map<string, DraftValue | undefined>;
};

const SUPPORTED_SCHEMA_VERSION = "brokering-route-draft.v1";

const orderFilterTargets = {
  queues: {
    include: "route.orderFilters.QUEUE",
    exclude: "route.orderFilters.QUEUE_EXCLUDED"
  },
  shippingMethods: {
    include: "route.orderFilters.SHIPPING_METHOD",
    exclude: "route.orderFilters.SHIPPING_METHOD_EXCLUDED"
  },
  priorities: {
    include: "route.orderFilters.PRIORITY",
    exclude: "route.orderFilters.PRIORITY_EXCLUDED"
  },
  salesChannels: {
    include: "route.orderFilters.SALES_CHANNEL",
    exclude: "route.orderFilters.SALES_CHANNEL_EXCLUDED"
  },
  originFacilityGroups: {
    include: "route.orderFilters.ORIGIN_FACILITY_GROUP",
    exclude: "route.orderFilters.ORIGIN_FACILITY_GROUP_EXCLUDED"
  }
} as const;

const orderSortTargets = {
  shipByDate: "route.orderSorts.SHIP_BY",
  shipAfterDate: "route.orderSorts.SHIP_AFTER",
  orderDate: "route.orderSorts.ORDER_DATE",
  shippingMethod: "route.orderSorts.SHIPPING_METHOD_SORT",
  priority: "route.orderSorts.SORT_PRIORITY"
} as const;

const inventorySortTargets = {
  proximity: "selectedRule.inventorySorts.PROXIMITY",
  inventoryBalance: "selectedRule.inventorySorts.INV_BALANCE",
  customerSequence: "selectedRule.inventorySorts.CUSTOMER_SEQ"
} as const;

const facilityOrderLimitValues = {
  respect: "false",
  bypass: "true"
} as const;

const unavailableActionValues = {
  nextRule: "ORA_NEXT_RULE",
  moveToQueue: "ORA_MV_TO_QUEUE"
} as const;

// A dedicated error type lets API routes return 422 validation failures
// without confusing them with model/provider failures.
export class BrokeringRouteDraftValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Brokering route draft validation failed: ${issues.join("; ")}`);
    this.name = "BrokeringRouteDraftValidationError";
    this.issues = issues;
  }
}

// Public entry point used by /brokering-route-draft.
// It deliberately does not normalize model output. Provider output must already
// match the strict contract, otherwise the route returns a validation error.
export function validateBrokeringRouteDraftJson(value: unknown, manifest: PageCapabilityManifest): BrokeringRouteDraft {
  const schemaVersion = readSchemaVersion(value);
  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new BrokeringRouteDraftValidationError([
      `This validator only validates schemaVersion '${SUPPORTED_SCHEMA_VERSION}'. Received '${schemaVersion || "missing"}'.`
    ]);
  }

  const schemaResult = brokeringRouteDraftSchema.safeParse(value);
  if (!schemaResult.success) {
    throw new BrokeringRouteDraftValidationError(formatZodIssues(schemaResult.error));
  }

  const manifestIssues = validateBrokeringRouteDraftAgainstManifest(schemaResult.data, manifest);
  if (manifestIssues.length) {
    throw new BrokeringRouteDraftValidationError(manifestIssues);
  }

  return schemaResult.data;
}

function readSchemaVersion(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  return typeof schemaVersion === "string" ? schemaVersion : "";
}

function validateBrokeringRouteDraftAgainstManifest(draft: BrokeringRouteDraft, manifest: PageCapabilityManifest) {
  const context: ValidationContext = {
    issues: [],
    targets: new Map((manifest.editableTargets as DraftTargetCapability[]).map((target) => [target.target, target])),
    currentValues: new Map(
      (manifest.editableTargets as DraftTargetCapability[]).map((target) => [target.target, target.currentValue])
    )
  };

  validateTargetChange(context, "route.statusId", draft.route.statusId, "route.statusId");
  validateOrderSelection(context, draft.route.orderSelection);
  draft.route.inventoryRules.forEach((rule, index) => validateInventoryRule(context, rule, `route.inventoryRules[${index}]`));

  return context.issues;
}

function validateOrderSelection(context: ValidationContext, orderSelection: BrokeringRouteDraft["route"]["orderSelection"]) {
  validateOptionSelection(context, orderSelection.filters.queues, "route.orderSelection.filters.queues", orderFilterTargets.queues);
  validateOptionSelection(context, orderSelection.filters.shippingMethods, "route.orderSelection.filters.shippingMethods", orderFilterTargets.shippingMethods);
  validateOptionSelection(context, orderSelection.filters.priorities, "route.orderSelection.filters.priorities", orderFilterTargets.priorities);
  validateNullableNumberTarget(context, "route.orderFilters.PROMISE_DATE", orderSelection.filters.promiseDateDays.max, "route.orderSelection.filters.promiseDateDays.max");
  validateNullableNumberTarget(context, "route.orderFilters.PROMISE_DATE_EXCLUDED", orderSelection.filters.promiseDateDays.excludeMax, "route.orderSelection.filters.promiseDateDays.excludeMax");
  validateOptionSelection(context, orderSelection.filters.salesChannels, "route.orderSelection.filters.salesChannels", orderFilterTargets.salesChannels);
  validateOptionSelection(context, orderSelection.filters.originFacilityGroups, "route.orderSelection.filters.originFacilityGroups", orderFilterTargets.originFacilityGroups);
  validateSorts(context, orderSelection.sorts, "route.orderSelection.sorts", orderSortTargets);
}

function validateInventoryRule(
  context: ValidationContext,
  rule: BrokeringRouteDraft["route"]["inventoryRules"][number],
  path: string
) {
  validateTargetChange(context, "selectedRule.statusId", rule.statusId, `${path}.statusId`);
  validateOptionSelection(context, rule.inventorySelection.filters.facilityGroups, `${path}.inventorySelection.filters.facilityGroups`, {
    include: "selectedRule.inventoryFilters.FACILITY_GROUP",
    exclude: "selectedRule.inventoryFilters.FACILITY_GROUP_EXCLUDED"
  });
  validateProximity(context, rule.inventorySelection.filters.proximity, `${path}.inventorySelection.filters.proximity`);
  validateNullableNumberTarget(context, "selectedRule.inventoryFilters.BRK_SAFETY_STOCK", rule.inventorySelection.filters.safetyStock.minimum, `${path}.inventorySelection.filters.safetyStock.minimum`);
  validateFacilityOrderLimit(context, rule.inventorySelection.filters.facilityOrderLimit, `${path}.inventorySelection.filters.facilityOrderLimit`);
  validateNullableNumberTarget(context, "selectedRule.inventoryFilters.SHIP_THRESHOLD", rule.inventorySelection.filters.shipmentThreshold, `${path}.inventorySelection.filters.shipmentThreshold`);
  validateSorts(context, rule.inventorySelection.sorts, `${path}.inventorySelection.sorts`, inventorySortTargets);
  validateAllocation(context, rule.allocation, `${path}.allocation`);
  validateUnavailableItems(context, rule.unavailableItems, `${path}.unavailableItems`);
}

function validateOptionSelection(
  context: ValidationContext,
  selection: { include: string[]; exclude: string[] },
  path: string,
  targets: { include: string; exclude: string }
) {
  const overlap = selection.include.filter((value) => selection.exclude.includes(value));
  if (overlap.length) {
    context.issues.push(`${path} cannot include and exclude the same option IDs: ${overlap.join(", ")}.`);
  }

  validateTargetChange(context, targets.include, selection.include, `${path}.include`, { skipEmpty: true });
  validateTargetChange(context, targets.exclude, selection.exclude, `${path}.exclude`, { skipEmpty: true });
}

function validateProximity(
  context: ValidationContext,
  proximity: BrokeringRouteDraft["route"]["inventoryRules"][number]["inventorySelection"]["filters"]["proximity"],
  path: string
) {
  if (proximity.maxDistance === null && proximity.unit !== null) {
    context.issues.push(`${path}.unit requires ${path}.maxDistance.`);
  }

  if (proximity.maxDistance !== null && proximity.unit === null) {
    context.issues.push(`${path}.unit is required when ${path}.maxDistance is set.`);
  }

  validateNullableNumberTarget(context, "selectedRule.inventoryFilters.PROXIMITY", proximity.maxDistance, `${path}.maxDistance`);
  if (proximity.unit !== null) {
    validateTargetChange(context, "selectedRule.inventoryFilters.MEASUREMENT_SYSTEM", proximity.unit, `${path}.unit`);
  }
}

function validateFacilityOrderLimit(context: ValidationContext, value: "respect" | "bypass" | "unchanged", path: string) {
  if (value === "unchanged") {
    return;
  }

  validateTargetChange(context, "selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT", facilityOrderLimitValues[value], path);
}

function validateAllocation(
  context: ValidationContext,
  allocation: BrokeringRouteDraft["route"]["inventoryRules"][number]["allocation"],
  path: string
) {
  if (allocation.partialGroupedItemAllocation && !allocation.partialOrderAllocation) {
    context.issues.push(`${path}.partialGroupedItemAllocation requires ${path}.partialOrderAllocation to be true.`);
  }

  validateBooleanTarget(context, "selectedRule.partialAllocation", allocation.partialOrderAllocation, `${path}.partialOrderAllocation`);
  validateBooleanTarget(context, "selectedRule.partialGroupItemsAllocation", allocation.partialGroupedItemAllocation, `${path}.partialGroupedItemAllocation`);
}

function validateUnavailableItems(
  context: ValidationContext,
  unavailableItems: BrokeringRouteDraft["route"]["inventoryRules"][number]["unavailableItems"],
  path: string
) {
  validateTargetChange(context, "selectedRule.unavailableItemsAction", unavailableActionValues[unavailableItems.action], `${path}.action`);

  if (unavailableItems.action === "moveToQueue" && unavailableItems.queueId === null) {
    context.issues.push(`${path}.queueId is required when ${path}.action is 'moveToQueue'.`);
  }

  if (unavailableItems.action === "nextRule" && unavailableItems.queueId !== null) {
    context.issues.push(`${path}.queueId must be null when ${path}.action is 'nextRule'.`);
  }

  if (unavailableItems.queueId !== null) {
    validateTargetChange(context, "selectedRule.unavailableItemsQueueId", unavailableItems.queueId, `${path}.queueId`);
  }

  validateAutoCancel(context, unavailableItems.autoCancel, `${path}.autoCancel`);
}

function validateAutoCancel(
  context: ValidationContext,
  autoCancel: BrokeringRouteDraft["route"]["inventoryRules"][number]["unavailableItems"]["autoCancel"],
  path: string
) {
  if (autoCancel.mode === "days" && autoCancel.days === null) {
    context.issues.push(`${path}.days is required when ${path}.mode is 'days'.`);
  }

  if (autoCancel.mode !== "days" && autoCancel.days !== null) {
    context.issues.push(`${path}.days must be null unless ${path}.mode is 'days'.`);
  }

  if (autoCancel.mode === "clear") {
    validateTargetChange(context, "selectedRule.clearAutoCancelDays", true, `${path}.mode`);
  }

  if (autoCancel.mode === "days") {
    validateTargetChange(context, "selectedRule.clearAutoCancelDays", false, `${path}.mode`);
    validateTargetChange(context, "selectedRule.autoCancelDays", autoCancel.days as number, `${path}.days`);
  }
}

function validateSorts(
  context: ValidationContext,
  sorts: Array<{ field: string; direction: "asc" | "desc" }>,
  path: string,
  targetsByField: Record<string, string>
) {
  const seenFields = new Set<string>();
  sorts.forEach((sort, index) => {
    if (seenFields.has(sort.field)) {
      context.issues.push(`${path}[${index}] has duplicate sort field '${sort.field}'.`);
      return;
    }

    seenFields.add(sort.field);
    validateTargetChange(context, targetsByField[sort.field], true, `${path}[${index}].field`);
  });
}

function validateNullableNumberTarget(
  context: ValidationContext,
  targetName: string,
  value: number | null,
  path: string
) {
  if (value === null) {
    return;
  }

  validateTargetChange(context, targetName, value, path);
}

function validateBooleanTarget(
  context: ValidationContext,
  targetName: string,
  value: boolean,
  path: string
) {
  const target = context.targets.get(targetName);
  if (target && valuesEqual(value, target.currentValue)) {
    return;
  }

  validateTargetChange(context, targetName, value, path);
}

function validateTargetChange(
  context: ValidationContext,
  targetName: string | undefined,
  value: DraftValue,
  path: string,
  options: { skipEmpty?: boolean } = {}
) {
  if (options.skipEmpty && isEmptyDraftValue(value)) {
    return;
  }

  if (!targetName) {
    context.issues.push(`${path} does not map to a page capability target.`);
    return;
  }

  const target = context.targets.get(targetName);
  if (!target) {
    context.issues.push(`${path} maps to '${targetName}', but that target is missing from pageCapabilityManifest.editableTargets.`);
    return;
  }

  const normalizedValue = normalizeValueForTarget(value, target, path);
  if (normalizedValue.issues.length) {
    context.issues.push(...normalizedValue.issues);
    return;
  }

  const issuesBeforeTarget = context.issues.length;
  context.issues.push(...validateTargetValue(normalizedValue.value, target, path));

  const isChangingValue = !valuesEqual(normalizedValue.value, target.currentValue);
  if (isChangingValue && target.editable !== true) {
    context.issues.push(`${path} maps to '${targetName}', but that target is not editable.`);
  }

  const disabledReason = isChangingValue ? getDisabledReason(target, context.currentValues) : "";
  if (disabledReason) {
    context.issues.push(`${path} maps to '${targetName}', but that target cannot be changed. ${disabledReason}`);
  }

  if (context.issues.length === issuesBeforeTarget) {
    context.currentValues.set(targetName, normalizedValue.value);
  }
}

function normalizeValueForTarget(value: DraftValue, target: DraftTargetCapability, path: string) {
  if (Array.isArray(value) && target.multiple !== true && target.valueType !== "string[]") {
    if (value.length === 1) {
      return { value: value[0], issues: [] };
    }

    return {
      value,
      issues: [`${path} maps to '${target.target}', which accepts only one value.`]
    };
  }

  return { value, issues: [] };
}

function validateTargetValue(value: DraftValue, target: DraftTargetCapability, path: string) {
  if (target.options?.length) {
    return validateOptionValue(value, target, path);
  }

  if (target.valueType === "boolean" && typeof value !== "boolean") {
    return [`${path} must be a boolean for '${target.target}'.`];
  }

  if (target.valueType === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    return [`${path} must be a finite number for '${target.target}'.`];
  }

  if (target.valueType === "string[]" && !isStringArray(value)) {
    return [`${path} must be an array of strings for '${target.target}'.`];
  }

  if ((target.valueType === "string" || target.valueType === "enum") && typeof value !== "string") {
    return [`${path} must be a string for '${target.target}'.`];
  }

  return [];
}

function validateOptionValue(value: DraftValue, target: DraftTargetCapability, path: string) {
  const values = Array.isArray(value) ? value : [String(value)];
  const optionsById = new Map((target.options || []).map((option) => [String(option.id), option]));
  const validIds = Array.from(optionsById.keys());
  const issues: string[] = [];

  if (Array.isArray(value) && target.multiple !== true && values.length > 1) {
    issues.push(`${path} maps to '${target.target}', which accepts only one option ID.`);
  }

  values.forEach((requestedValue) => {
    const option = optionsById.get(String(requestedValue));
    if (!option) {
      issues.push(`${path} value '${requestedValue}' for '${target.target}' must use one of the manifest option IDs: ${validIds.join(", ")}.`);
      return;
    }

    if (option.disabled) {
      issues.push(`${path} value '${requestedValue}' for '${target.target}' is disabled. ${option.disabledReason || ""}`.trim());
    }
  });

  return issues;
}

function getDisabledReason(target: DraftTargetCapability, currentValues: Map<string, DraftValue | undefined>) {
  if (target.staticDisabled) {
    return target.disabledReason || "The control is currently disabled.";
  }

  const unmetDependency = target.dependencies?.find((dependency) => {
    const currentValue = currentValues.get(dependency.target);
    return !dependency.values.some((value) => valuesEqual(value, currentValue));
  });
  if (unmetDependency) {
    return unmetDependency.description || target.disabledReason || "A required control dependency is not satisfied.";
  }

  if (target.disabled && !target.dependencies?.length) {
    return target.disabledReason || "The control is currently disabled.";
  }

  return "";
}

function formatZodIssues(error: ZodError) {
  return error.issues.map((issue) => {
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function isEmptyDraftValue(value: DraftValue) {
  return Array.isArray(value) ? value.length === 0 : value === "";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function valuesEqual(expected: DraftValue, actual: DraftValue | undefined) {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  return String(expected) === String(actual);
}
