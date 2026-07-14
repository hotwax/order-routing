import { validate } from "uuid";

type ConditionMap = Record<string, any>;

interface BuildRoutingGroupEditorSavePayloadOptions {
  group: any;
  orderRoutingId: string;
  routingPatch?: Record<string, any>;
  orderRoutingFilterOptions?: ConditionMap;
  orderRoutingSortOptions?: ConditionMap;
  inventoryRules?: any[];
  rulesInformation?: Record<string, any>;
  descendingSortFields?: string;
}

interface StripRoutingGroupSaveIdsOptions {
  isNewRoutingGroup?: boolean;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value || {}));
}

function isClientGeneratedId(value: any) {
  return typeof value === "string" && validate(value);
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

function valuesFromMap(map: ConditionMap = {}) {
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

function flattenActions(actions: any) {
  if (!actions || Array.isArray(actions)) {
    return clone(actions || []).map(normalizeAction);
  }

  return Object.values(actions).filter(Boolean).map((action: any) => normalizeAction(clone(action)));
}

function normalizeAction(action: any) {
  if (action?.routingActionTypeId && !action.actionTypeEnumId) {
    action.actionTypeEnumId = action.routingActionTypeId;
    delete action.routingActionTypeId;
  }

  return action;
}

function stripTransientFields(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripTransientFields);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((cleaned: Record<string, any>, [key, entry]) => {
    if (key === "hasUnsavedChanges" || key === "isNew" || key === "isRoutingGroupDetailLoaded") {
      return cleaned;
    }

    cleaned[key] = stripTransientFields(entry);
    return cleaned;
  }, {});
}

function getDescendingSortFieldSet(descendingSortFields = "") {
  return new Set(descendingSortFields.split(",").map((field) => field.trim()).filter(Boolean));
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

export function buildRoutingGroupSavePayload(group: any, descendingSortFields = "") {
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

export function buildRoutingGroupEditorSavePayload(options: BuildRoutingGroupEditorSavePayloadOptions) {
  const payload = buildRoutingGroupEditorDraftPayload(options);
  return buildRoutingGroupSavePayload(payload, options.descendingSortFields);
}
