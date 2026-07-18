function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

export interface RoutingEditorReferenceMaps {
  facilities: Record<string, any>;
  facilityGroups: Record<string, any>;
  shippingMethods: Record<string, any>;
  salesChannels: Record<string, any>;
  catalogCategories: Record<string, any>;
}

const ROUTING_EDITOR_STATUS_LABELS: Record<string, string> = {
  ROUTING_ACTIVE: "Active",
  ROUTING_DRAFT: "Draft",
  ROUTING_ARCHIVED: "Archived",
  RULE_ACTIVE: "Active",
  RULE_DRAFT: "Draft",
  RULE_ARCHIVED: "Archived"
};

/** Display-only fallback for simulation codes when no simulation-scoped description API exists. */
export function routingEditorCodeLabel(code: string): string {
  const value = String(code || "").trim();
  if (!value) return value;
  if (ROUTING_EDITOR_STATUS_LABELS[value]) return ROUTING_EDITOR_STATUS_LABELS[value];
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Keep simulation editor references isolated from the authenticated OMS stores. */
export function routingEditorReferenceMaps(
  sandbox: boolean,
  simulation: Omit<RoutingEditorReferenceMaps, "catalogCategories">,
  live: RoutingEditorReferenceMaps
): RoutingEditorReferenceMaps {
  if (!sandbox) return live;
  return {
    facilities: simulation.facilities || {},
    facilityGroups: simulation.facilityGroups || {},
    shippingMethods: simulation.shippingMethods || {},
    salesChannels: simulation.salesChannels || {},
    // No simulation-scoped catalog endpoint is available. Fail closed instead of borrowing OMS data.
    catalogCategories: {}
  };
}

export type RoutingNavigationOperation = "editor-save" | "circuit" | "variation-save" | "simulation-run" | null;

export function activeRoutingNavigationOperation(flags: {
  isSavingEditor: boolean;
  isApplyingCircuit: boolean;
  isSavingVariation: boolean;
  isRunningSimulation: boolean;
}): RoutingNavigationOperation {
  if (flags.isSavingEditor) return "editor-save";
  if (flags.isApplyingCircuit) return "circuit";
  if (flags.isSavingVariation) return "variation-save";
  if (flags.isRunningSimulation) return "simulation-run";
  return null;
}

export function routingWorkingKey(value: any): string {
  return String(value?.orderRoutingId || value?._tempId || "");
}

export function ruleWorkingKey(value: any): string {
  return String(value?.routingRuleId || value?._tempId || "");
}

/** Compare the user-editable rule projection without being affected by object key insertion order. */
export function isRoutingRuleDraftDirty(current: any, baseline: any): boolean {
  if (!baseline) return Boolean(current);
  return JSON.stringify(stableDraftValue(editableRuleState(current)))
    !== JSON.stringify(stableDraftValue(editableRuleState(baseline)));
}

function editableRuleState(rule: any) {
  return {
    ruleName: rule?.ruleName || "",
    statusId: rule?.statusId || "",
    sequenceNum: Number(rule?.sequenceNum || 0),
    assignmentEnumId: rule?.assignmentEnumId || "",
    inventoryFilters: rule?.inventoryFilters || {},
    actions: rule?.actions || {}
  };
}

function stableDraftValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableDraftValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result: Record<string, any>, key) => {
      result[key] = stableDraftValue(value[key]);
      return result;
    }, {});
}

/** Always rebind scheduler UI state from the visible group, including the unscheduled case. */
export function routingGroupScheduleWorkingCopy(group: any): any {
  return cloneValue(group?.schedule || {});
}

/**
 * Run a live Circuit preview as a fail-closed transaction. The caller deliberately receives the
 * original rejection so it cannot publish a pending proposal after a partially-applied mutation.
 */
export async function applyRoutingProposalPreview<T>(
  capture: () => void,
  apply: () => Promise<T>,
  rollback: () => void
): Promise<T> {
  capture();
  try {
    return await apply();
  } catch (error) {
    rollback();
    throw error;
  }
}

/**
 * Rebind a persisted group after Discard, then republish clean state after queued control updates.
 * Ionic inputs may emit while their values are being rebound; the final clean publication prevents
 * those programmatic events from surviving as a persisted dirty flag.
 */
export async function settleRoutingEditorDiscard(
  rebind: () => void,
  publishClean: () => void,
  settleQueuedUpdates: () => Promise<void>
): Promise<void> {
  rebind();
  publishClean();
  await settleQueuedUpdates();
  publishClean();
}

export interface PendingRoutingInlineEdits {
  group: any;
  activeRouting?: any;
  activeRule?: any;
  inventoryRules?: any[];
  editing: {
    groupName?: boolean;
    description?: boolean;
    routeName?: boolean;
    ruleName?: boolean;
  };
  values: {
    groupName?: unknown;
    description?: unknown;
    routeName?: unknown;
    ruleName?: unknown;
  };
}

/**
 * Fold text that is still inside an inline rename control into the authoritative editor working
 * copy before a header Save/navigation flush. Group, route, and rule names remain required; an
 * empty description is a valid committed value.
 */
export function applyPendingRoutingInlineEdits(options: PendingRoutingInlineEdits): boolean {
  const { group, activeRouting, activeRule, inventoryRules = [], editing, values } = options;
  let changed = false;

  const groupName = String(values.groupName ?? "").trim();
  if (editing.groupName && group && groupName && groupName !== String(group.groupName ?? "").trim()) {
    group.groupName = groupName;
    changed = true;
  }

  const description = String(values.description ?? "").trim();
  if (editing.description && group && description !== String(group.description ?? "").trim()) {
    group.description = description;
    changed = true;
  }

  const routeName = String(values.routeName ?? "").trim();
  if (editing.routeName
    && activeRouting
    && routeName
    && routeName !== String(activeRouting.routingName ?? "").trim()) {
    activeRouting.routingName = routeName;
    changed = true;
  }

  const ruleName = String(values.ruleName ?? "").trim();
  if (editing.ruleName && activeRule && ruleName) {
    const rawRule = inventoryRules.find((rule) => ruleWorkingKey(rule) === ruleWorkingKey(activeRule));
    if (ruleName !== String(rawRule?.ruleName ?? "").trim()) {
      activeRule.ruleName = ruleName;
      changed = true;
    }
  }

  return changed;
}

export function canonicalRoutingEditorRoute(routingGroupId: string): string {
  return `/order-routing/${routingGroupId}`;
}

/** A store switch while a routing record/test page is open would mix two product-store contexts. */
export function isRoutingRecordRoute(path: string): boolean {
  return /^\/order-routing\/[^/]+(?:\/|$)/.test(String(path || ""));
}

/**
 * Resolve the post-save URL while synchronously publishing the clean state first. A newly-created
 * group receives its backend id on the first save, which requires a route replacement; clearing the
 * host's dirty signal before returning that URL keeps its navigation guard from prompting for the
 * commit that just succeeded.
 */
export function prepareRoutingGroupSaveCommit(
  previousRoutingGroupId: string,
  savedRoutingGroupId: string,
  markClean: () => void
): string | undefined {
  markClean();
  if (!savedRoutingGroupId || savedRoutingGroupId === previousRoutingGroupId) return undefined;
  return canonicalRoutingEditorRoute(savedRoutingGroupId);
}

export function projectRuleForEditor(rule: any) {
  const projection = cloneValue(rule || {});
  const conditions = Array.isArray(projection.inventoryFilters)
    ? projection.inventoryFilters
    : [
        ...Object.values(projection.inventoryFilters?.ENTCT_FILTER || {}),
        ...Object.values(projection.inventoryFilters?.ENTCT_SORT_BY || {})
      ];
  const actions = Array.isArray(projection.actions)
    ? projection.actions
    : Object.values(projection.actions || {});

  projection.inventoryFilters = conditions.reduce((result: any, condition: any) => {
    const type = condition.conditionTypeEnumId || "ENTCT_FILTER";
    if (!result[type]) result[type] = {};
    result[type][condition.fieldName] = cloneValue(condition);
    return result;
  }, { ENTCT_FILTER: {}, ENTCT_SORT_BY: {} });
  projection.actions = actions.reduce((result: any, action: any) => {
    const actionTypeEnumId = action.actionTypeEnumId || action.routingActionTypeId;
    if (actionTypeEnumId) {
      result[actionTypeEnumId] = { ...cloneValue(action), routingActionTypeId: actionTypeEnumId };
    }
    return result;
  }, {});

  return projection;
}

export function serializeRuleWorkingCopy(
  rule: any,
  filterOptions: Record<string, any>,
  sortOptions: Record<string, any>,
  actions: Record<string, any>
) {
  const serialized = cloneValue(rule || {});
  serialized.inventoryFilters = [
    ...Object.values(filterOptions || {}),
    ...Object.values(sortOptions || {})
  ].map((condition: any) => cloneValue(condition));
  serialized.actions = Object.values(actions || {}).map((action: any) => {
    const serializedAction = cloneValue(action);
    serializedAction.actionTypeEnumId = serializedAction.actionTypeEnumId || serializedAction.routingActionTypeId;
    delete serializedAction.routingActionTypeId;
    return serializedAction;
  });
  return serialized;
}

export function serializeRoutingWorkingCopy(
  routing: any,
  filterOptions: Record<string, any>,
  sortOptions: Record<string, any>,
  rules: any[]
) {
  const serialized = cloneValue(routing || {});
  serialized.orderFilters = [
    ...Object.values(filterOptions || {}),
    ...Object.values(sortOptions || {})
  ].map((condition: any) => cloneValue(condition));
  serialized.rules = cloneValue(rules || []);
  return serialized;
}

/**
 * Update an order-routing filter using the backend field code as the map key.
 *
 * Controls use enum names such as QUEUE and SHIPPING_METHOD, while persisted conditions use enum
 * codes such as facilityId and shipmentMethodTypeId. Writing with the enum name creates a second
 * condition that the control never reads back. Keep one canonical row and remove any legacy alias.
 */
export function updateRoutingFilterCondition(
  options: Record<string, any>,
  enumerations: Record<string, any>,
  parameter: string,
  rawValue: any,
  multiple = false
) {
  const next = cloneValue(options || {});
  const fieldName = String(enumerations?.[parameter]?.code || parameter);
  const selectedValues = multiple
    ? (Array.isArray(rawValue) ? rawValue : rawValue === undefined || rawValue === null || rawValue === "" ? [] : [rawValue])
    : rawValue;
  const fieldValue = multiple
    ? selectedValues.map((value: any) => String(value)).filter(Boolean).join(",")
    : selectedValues;
  const existing = next[fieldName];

  if (existing) {
    existing.fieldValue = fieldValue;
  } else {
    next[fieldName] = {
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName,
      fieldValue,
      operator: "equals",
      sequenceNum: Object.keys(next).filter((key) => key !== parameter).length + 1
    };
  }

  if (parameter !== fieldName) delete next[parameter];
  return next;
}

export function replaceWorkingEntry<T>(
  entries: T[],
  next: T,
  key: (value: T) => string
): T[] {
  const nextKey = key(next);
  if (!nextKey) return entries;
  const index = entries.findIndex((entry) => key(entry) === nextKey);
  if (index < 0) return [...entries, next];
  const result = [...entries];
  result[index] = next;
  return result;
}
