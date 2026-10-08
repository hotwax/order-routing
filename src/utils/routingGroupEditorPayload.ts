export type RoutingConditionMap = Record<string, any>;

export interface BuildRoutingGroupEditorSavePayloadOptions {
  group: any;
  orderRoutingId: string;
  routingPatch?: Record<string, any>;
  orderRoutingFilterOptions?: RoutingConditionMap;
  orderRoutingSortOptions?: RoutingConditionMap;
  inventoryRules?: any[];
  rulesInformation?: Record<string, any>;
  descendingSortFields?: string | string[];
}

export interface StripRoutingGroupSaveIdsOptions {
  isNewRoutingGroup?: boolean;
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function isClientGeneratedId(value: any) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sortBySequence(items: any[]) {
  return [...items].sort((a, b) => {
    const aSeq = Number.isFinite(Number(a?.sequenceNum)) ? Number(a.sequenceNum) : Number.MAX_SAFE_INTEGER;
    const bSeq = Number.isFinite(Number(b?.sequenceNum)) ? Number(b.sequenceNum) : Number.MAX_SAFE_INTEGER;
    return aSeq - bSeq;
  });
}

function hasConditionValue(condition: any) {
  return Boolean(condition?.fieldValue) || condition?.fieldValue === 0;
}

function shouldIncludeCondition(condition: any) {
  if (!condition) return false;
  if (condition.conditionTypeEnumId === "ENTCT_SORT_BY") return true;
  return hasConditionValue(condition);
}

function valuesFromMap(map: RoutingConditionMap = {}) {
  return sortBySequence(
    Object.values(map)
      .filter(shouldIncludeCondition)
      .map((item: any) => clone(item))
  );
}

function flattenInventoryFilters(inventoryFilters: any) {
  if (!inventoryFilters || Array.isArray(inventoryFilters)) {
    return clone(inventoryFilters || []);
  }

  return [
    ...valuesFromMap(inventoryFilters.ENTCT_FILTER || {}),
    ...valuesFromMap(inventoryFilters.ENTCT_SORT_BY || {})
  ];
}

function normalizeAction(action: any) {
  if (action?.routingActionTypeId && !action.actionTypeEnumId) {
    action.actionTypeEnumId = action.routingActionTypeId;
    delete action.routingActionTypeId;
  }

  return action;
}

function flattenActions(actions: any) {
  if (!actions || Array.isArray(actions)) {
    return clone(actions || []).map(normalizeAction);
  }

  return Object.values(actions).filter(Boolean).map((action: any) => normalizeAction(clone(action)));
}

function stripTransientFields(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripTransientFields);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((cleaned: Record<string, any>, [key, entry]) => {
    if (
      key === "hasUnsavedChanges"
      || key === "isNew"
      || key === "isRoutingGroupDetailLoaded"
      || key === "_tempId"
    ) {
      return cleaned;
    }

    cleaned[key] = stripTransientFields(entry);
    return cleaned;
  }, {});
}

function getDescendingSortFieldSet(descendingSortFields: string | string[] = "") {
  let fields: unknown = descendingSortFields;
  if (typeof fields === "string") {
    const value = fields.trim();
    if (!value) return new Set<string>();

    try {
      const parsed = JSON.parse(value);
      fields = Array.isArray(parsed) ? parsed : value.split(",");
    } catch {
      fields = value.split(",");
    }
  }

  return new Set(
    (Array.isArray(fields) ? fields : [])
      .filter((field): field is string => typeof field === "string")
      .map((field) => field.trim().replace(/\s+desc$/i, ""))
      .filter(Boolean)
  );
}

function denormalizeCondition(condition: any, descendingSortFields: Set<string>) {
  const updated = clone(condition);
  const fieldName = String(updated.fieldName || "");

  if ((updated.operator === "not-equals" || updated.operator === "not-in") && fieldName.endsWith("_excluded")) {
    updated.fieldName = fieldName.slice(0, -"_excluded".length);
  }

  if (updated.conditionTypeEnumId === "ENTCT_SORT_BY") {
    const cleanFieldName = String(updated.fieldName || "").replace(/\s+desc$/i, "");
    if (descendingSortFields.has(cleanFieldName)) {
      updated.fieldName = `${cleanFieldName} desc`;
    }
  }

  return updated;
}

function denormalizeConditions(conditions: any[] = [], descendingSortFields: Set<string>) {
  return conditions.map((condition) => denormalizeCondition(condition, descendingSortFields));
}

export function buildRoutingGroupSavePayload(group: any, descendingSortFields: string | string[] = "") {
  const payload = stripTransientFields(clone(group));
  const descendingSortFieldSet = getDescendingSortFieldSet(descendingSortFields);

  payload.routings?.forEach((routing: any) => {
    routing.orderFilters = denormalizeConditions(routing.orderFilters || [], descendingSortFieldSet);
    routing.rules?.forEach((rule: any) => {
      rule.inventoryFilters = denormalizeConditions(rule.inventoryFilters || [], descendingSortFieldSet);
    });
  });

  return payload;
}
export function buildRoutingGroupEditorDraftPayload(options: BuildRoutingGroupEditorSavePayloadOptions) {
  const payload = clone(options.group);
  const routing = payload.routings?.find((route: any) => route.orderRoutingId === options.orderRoutingId);

  if (!routing) {
    return payload;
  }

  Object.assign(routing, clone(options.routingPatch || {}));
  routing.orderFilters = [
    ...valuesFromMap(options.orderRoutingFilterOptions || {}),
    ...valuesFromMap(options.orderRoutingSortOptions || {})
  ];

  if (Array.isArray(options.inventoryRules)) {
    const existingRulesById = new Map((routing.rules || []).map((rule: any) => [rule.routingRuleId, rule]));
    routing.rules = sortBySequence(options.inventoryRules).map((inventoryRule: any) => {
      const ruleId = inventoryRule.routingRuleId;
      const existingRule = clone(existingRulesById.get(ruleId) || {});
      const ruleInformation = clone(options.rulesInformation?.[ruleId] || {});
      const mergedRule = {
        ...existingRule,
        ...ruleInformation,
        ...clone(inventoryRule)
      };

      mergedRule.inventoryFilters = ruleInformation.inventoryFilters
        ? flattenInventoryFilters(ruleInformation.inventoryFilters)
        : flattenInventoryFilters(mergedRule.inventoryFilters);
      mergedRule.actions = ruleInformation.actions
        ? flattenActions(ruleInformation.actions)
        : flattenActions(mergedRule.actions);

      return mergedRule;
    });
  }

  return payload;
}

export function stripRoutingGroupSaveIds(payload: any, options: StripRoutingGroupSaveIdsOptions = {}) {
  const stripAll = Boolean(options.isNewRoutingGroup);

  if (stripAll) {
    delete payload.routingGroupId;
  }

  payload.routings?.forEach((routing: any) => {
    const stripRoutingId = stripAll || isClientGeneratedId(routing.orderRoutingId);

    if (stripAll || isClientGeneratedId(routing.routingGroupId)) {
      delete routing.routingGroupId;
    }

    if (stripRoutingId) {
      delete routing.orderRoutingId;
    }

    routing.orderFilters?.forEach((orderFilter: any) => {
      if (stripRoutingId || stripAll || isClientGeneratedId(orderFilter.orderRoutingId)) {
        delete orderFilter.orderRoutingId;
        delete orderFilter.conditionSeqId;
      }
    });

    routing.rules?.forEach((rule: any) => {
      const stripRuleId = stripAll || isClientGeneratedId(rule.routingRuleId);

      if (stripRoutingId || stripAll || isClientGeneratedId(rule.orderRoutingId)) {
        delete rule.orderRoutingId;
      }

      if (stripRuleId) {
        delete rule.routingRuleId;
      }

      rule.inventoryFilters?.forEach((filter: any) => {
        if (stripRuleId || stripAll || isClientGeneratedId(filter.routingRuleId)) {
          delete filter.routingRuleId;
          delete filter.conditionSeqId;
        }
      });

      rule.actions?.forEach((action: any) => {
        if (stripRuleId || stripAll || isClientGeneratedId(action.routingRuleId)) {
          delete action.routingRuleId;
          delete action.actionSeqId;
        }
      });
    });
  });

  return payload;
}

export interface RoutingGroupChildDeletions {
  orderFilters: Array<{ orderRoutingId: string; conditionSeqId: string }>;
  inventoryFilters: Array<{ routingRuleId: string; conditionSeqId: string }>;
  actions: Array<{ routingRuleId: string; actionSeqId: string }>;
}

/** A seq id that identifies a row the backend already persisted (not a local-only draft). */
function persistedSeqId(value: any) {
  return typeof value === "string" && value.trim() !== "" && !isClientGeneratedId(value) ? value.trim() : "";
}

function persistedSeqIds(items: any, key: string) {
  const ids = new Set<string>();
  // Both the baseline and the outgoing working copy hold these as flat arrays
  // (serializeRuleWorkingCopy flattens the editor's grouped options back out before save).
  if (!Array.isArray(items)) return ids;
  items.forEach((item: any) => {
    const id = persistedSeqId(item?.[key]);
    if (id) ids.add(id);
  });
  return ids;
}

function indexByPersistedId(items: any, key: string) {
  const index = new Map<string, any>();
  if (!Array.isArray(items)) return index;
  items.forEach((item: any) => {
    const id = persistedSeqId(item?.[key]);
    if (id) index.set(id, item);
  });
  return index;
}

/**
 * Report the persisted child rows that the outgoing group no longer contains.
 *
 * The whole-group POST upserts whatever it is handed but does not remove rows that are merely
 * absent from the payload, so a route filter / rule condition / action the user deleted in the
 * editor would survive on the backend and reappear on the post-save readback. Diffing the
 * server-pristine baseline against the outgoing group is what identifies those orphans.
 *
 * Scope: only children whose parent routing and rule still exist in the outgoing payload are
 * reported. Dropping a whole routing or rule is a different operation whose cascade the backend
 * owns; issuing child deletes for it would race that cascade and log spurious failures.
 */
export function diffRoutingGroupChildDeletions(baseline: any, outgoing: any): RoutingGroupChildDeletions {
  const deletions: RoutingGroupChildDeletions = { orderFilters: [], inventoryFilters: [], actions: [] };

  // Only a baseline captured for this same group describes what is actually on the server.
  if (!baseline?.routingGroupId || baseline.routingGroupId !== outgoing?.routingGroupId) return deletions;

  const outgoingRoutings = indexByPersistedId(outgoing.routings, "orderRoutingId");

  (Array.isArray(baseline.routings) ? baseline.routings : []).forEach((baselineRouting: any) => {
    const orderRoutingId = persistedSeqId(baselineRouting?.orderRoutingId);
    if (!orderRoutingId) return;

    const outgoingRouting = outgoingRoutings.get(orderRoutingId);
    if (!outgoingRouting) return;

    const keptOrderFilters = persistedSeqIds(outgoingRouting.orderFilters, "conditionSeqId");
    persistedSeqIds(baselineRouting.orderFilters, "conditionSeqId").forEach((conditionSeqId) => {
      if (!keptOrderFilters.has(conditionSeqId)) deletions.orderFilters.push({ orderRoutingId, conditionSeqId });
    });

    const outgoingRules = indexByPersistedId(outgoingRouting.rules, "routingRuleId");

    (Array.isArray(baselineRouting.rules) ? baselineRouting.rules : []).forEach((baselineRule: any) => {
      const routingRuleId = persistedSeqId(baselineRule?.routingRuleId);
      if (!routingRuleId) return;

      const outgoingRule = outgoingRules.get(routingRuleId);
      if (!outgoingRule) return;

      const keptConditions = persistedSeqIds(outgoingRule.inventoryFilters, "conditionSeqId");
      persistedSeqIds(baselineRule.inventoryFilters, "conditionSeqId").forEach((conditionSeqId) => {
        if (!keptConditions.has(conditionSeqId)) deletions.inventoryFilters.push({ routingRuleId, conditionSeqId });
      });

      const keptActions = persistedSeqIds(outgoingRule.actions, "actionSeqId");
      persistedSeqIds(baselineRule.actions, "actionSeqId").forEach((actionSeqId) => {
        if (!keptActions.has(actionSeqId)) deletions.actions.push({ routingRuleId, actionSeqId });
      });
    });
  });

  return deletions;
}

export function hasRoutingGroupChildDeletions(deletions: RoutingGroupChildDeletions) {
  return deletions.orderFilters.length > 0
    || deletions.inventoryFilters.length > 0
    || deletions.actions.length > 0;
}
