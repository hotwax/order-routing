import {
  buildDraftTarget,
  createDraftOutputContract,
  createDraftTargetBindings,
  toDraftOptions
} from "../services/DraftAssistantService";
import type {
  DraftOperation,
  DraftOption,
  DraftTargetBindings,
  DraftTargetCapability,
  DraftValue,
  DraftValueType,
  PageCapabilityManifest
} from "../services/DraftAssistantService";

type EnumInfo = {
  id: string;
  code: string;
};

type ConditionOption = {
  conditionSeqId?: string;
  conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY";
  fieldName: string;
  fieldValue?: string | number | boolean;
  operator?: string;
  sequenceNum?: number;
  createdDate?: number;
  [key: string]: unknown;
};

export type BrokeringRulesDraftRefs = {
  orderRoutingId: string;
  selectedRoutingRule: any;
  routingStatus: { value: string };
  orderRoutingFilterOptions: { value: Record<string, ConditionOption> };
  orderRoutingSortOptions: { value: Record<string, ConditionOption> };
  inventoryRuleFilterOptions: { value: Record<string, ConditionOption> };
  inventoryRuleSortOptions: { value: Record<string, ConditionOption> };
  inventoryRuleActions: { value: Record<string, any> };
  inventoryRules: { value: any[] };
  rulesInformation: { value: Record<string, any> };
  rulesForReorder?: { value: any[] };
  ruleActionType?: { value: string };
  hasUnsavedChanges: { value: boolean };
  ruleEnums: Record<string, EnumInfo>;
  conditionFilterEnums: Record<string, EnumInfo>;
  conditionSortEnums: Record<string, EnumInfo>;
  actionEnums: Record<string, EnumInfo>;
};

type ManifestInput = {
  pageRoute: string;
  orderRoutingId: string;
  routingName: string;
  routingStatus: string;
  brokeringRun?: {
    routingGroupId?: string;
    groupName?: string;
    productStoreId?: string;
    schedule?: any;
    routings?: Array<{
      orderRoutingId: string;
      routingName: string;
      statusId: string;
      sequenceNum: number;
    }>;
  };
  selectedRoutingRule: any;
  isTestEnabled: boolean;
  orderRoutingFilterOptions: Record<string, ConditionOption>;
  orderRoutingSortOptions: Record<string, ConditionOption>;
  inventoryRuleFilterOptions: Record<string, ConditionOption>;
  inventoryRuleSortOptions: Record<string, ConditionOption>;
  inventoryRuleActions: Record<string, any>;
  inventoryRules?: any[];
  rulesInformation?: Record<string, any>;
  ruleActionType: string;
  ruleEnums: Record<string, EnumInfo>;
  conditionFilterEnums: Record<string, EnumInfo>;
  conditionSortEnums: Record<string, EnumInfo>;
  actionEnums: Record<string, EnumInfo>;
  facilities: Record<string, any>;
  shippingMethods: Record<string, any>;
  salesChannels: Record<string, any>;
  facilityGroups: Record<string, any>;
  brokeringFacilityGroups: Record<string, any>;
};

type FilterDefinition = {
  key: string;
  label: string;
  description?: string;
  aliases?: string[];
  valueType: DraftValueType;
  optionSource?: string;
  options?: DraftOption[];
  multiple?: boolean;
};

type SortDefinition = {
  key: string;
  label: string;
};

const routeFilterDefinitions: FilterDefinition[] = [
  { key: "QUEUE", label: "Queue filter", valueType: "string[]", optionSource: "queues", multiple: true },
  { key: "QUEUE_EXCLUDED", label: "Excluded queue filter", valueType: "string[]", optionSource: "queues", multiple: true },
  { key: "SHIPPING_METHOD", label: "Shipping method filter", valueType: "string[]", optionSource: "shippingMethods", multiple: true },
  { key: "SHIPPING_METHOD_EXCLUDED", label: "Excluded shipping method filter", valueType: "string[]", optionSource: "shippingMethods", multiple: true },
  { key: "PRIORITY", label: "Order priority filter", valueType: "enum", optionSource: "priorities" },
  { key: "PRIORITY_EXCLUDED", label: "Excluded order priority filter", valueType: "enum", optionSource: "priorities" },
  { key: "PROMISE_DATE", label: "Promise date filter", valueType: "number" },
  { key: "PROMISE_DATE_EXCLUDED", label: "Excluded promise date filter", valueType: "number" },
  { key: "SALES_CHANNEL", label: "Sales channel filter", valueType: "string[]", optionSource: "salesChannels", multiple: true },
  { key: "SALES_CHANNEL_EXCLUDED", label: "Excluded sales channel filter", valueType: "string[]", optionSource: "salesChannels", multiple: true },
  { key: "ORIGIN_FACILITY_GROUP", label: "Origin facility group filter", valueType: "string[]", optionSource: "facilityGroups", multiple: true },
  { key: "ORIGIN_FACILITY_GROUP_EXCLUDED", label: "Excluded origin facility group filter", valueType: "string[]", optionSource: "facilityGroups", multiple: true }
];

const routeSortDefinitions: SortDefinition[] = [
  { key: "SHIP_BY", label: "Ship-by date sort" },
  { key: "SHIP_AFTER", label: "Ship-after date sort" },
  { key: "ORDER_DATE", label: "Order date sort" },
  { key: "SHIPPING_METHOD_SORT", label: "Shipping method sort" },
  { key: "SORT_PRIORITY", label: "Priority sort" }
];

const inventoryFilterDefinitions: FilterDefinition[] = [
  {
    key: "FACILITY_GROUP",
    label: "Inventory facility group filter",
    description: "Restricts eligible locations to one brokering facility group. Leave unset when the user asks for all brokering locations.",
    aliases: ["location", "locations", "brokering location", "brokering locations"],
    valueType: "enum",
    optionSource: "brokeringFacilityGroups"
  },
  {
    key: "FACILITY_GROUP_EXCLUDED",
    label: "Excluded inventory facility group filter",
    description: "Excludes one brokering facility group while otherwise keeping all brokering locations eligible. Use this for requests like 'all brokering locations except warehouses'.",
    aliases: ["exclude location", "exclude locations", "except location", "except locations", "all locations except", "all facilities except", "all brokering locations except", "exclude warehouse", "exclude warehouses", "except warehouse", "except warehouses", "no warehouses", "without warehouses"],
    valueType: "enum",
    optionSource: "brokeringFacilityGroups"
  },
  { key: "PROXIMITY", label: "Proximity filter", valueType: "number" },
  { key: "MEASUREMENT_SYSTEM", label: "Proximity measurement system", valueType: "enum", optionSource: "measurementSystems" },
  { key: "BRK_SAFETY_STOCK", label: "Brokering safety stock filter", valueType: "number" },
  {
    key: "FACILITY_ORDER_LIMIT",
    label: "Facility order limit check",
    description: "Controls whether this rule respects facility order limits. Set false to enforce store caps and protect stores. Set true only when the user explicitly asks to turn off, ignore, or bypass facility order limits.",
    aliases: ["store cap", "store caps", "store usage cap", "protect stores", "facility order limit", "order limit check"],
    valueType: "boolean",
    options: facilityOrderLimitOptions()
  },
  { key: "SHIP_THRESHOLD", label: "Shipment threshold filter", valueType: "number" }
];

const inventorySortDefinitions: SortDefinition[] = [
  { key: "PROXIMITY", label: "Inventory proximity sort" },
  { key: "INV_BALANCE", label: "Available inventory balance sort" },
  { key: "CUSTOMER_SEQ", label: "Customer sequence sort" }
];


export function buildBrokeringRulesManifest(input: ManifestInput): PageCapabilityManifest {
  const hasSelectedRule = Boolean(input.selectedRoutingRule?.routingRuleId);
  const selectedRuleDisabledReason = hasSelectedRule
    ? input.isTestEnabled ? "Test mode is active." : ""
    : "No rule is currently selected.";
  const optionSources = buildOptionSources(input);
  const targets: DraftTargetCapability[] = [
    buildDraftTarget({
      target: "route.statusId",
      label: "Route status",
      description: "Changes the visible status control for the current routing route.",
      entity: "route",
      valueType: "enum",
      currentValue: input.routingStatus,
      options: routeStatusOptions(),
      staticDisabled: input.isTestEnabled,
      disabledReason: input.isTestEnabled ? "Test mode is active." : ""
    }),
    buildDraftTarget({
      target: "selectedRule.statusId",
      label: "Selected rule status",
      description: "Changes the visible status control for the selected inventory rule.",
      entity: "selectedRule",
      valueType: "enum",
      currentValue: input.selectedRoutingRule?.statusId,
      options: ruleStatusOptions(),
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabledReason: selectedRuleDisabledReason
    })
  ];

  routeFilterDefinitions.forEach((definition) => {
    targets.push(buildDraftTarget({
      target: `route.orderFilters.${definition.key}`,
      label: definition.label,
      description: `Sets or creates the ${definition.label.toLowerCase()} on the route draft.`,
      entity: "route",
      valueType: definition.valueType,
      currentValue: getConditionValue(input.orderRoutingFilterOptions, input.ruleEnums, definition.key),
      options: definition.optionSource ? optionSources[definition.optionSource] : undefined,
      multiple: Boolean(definition.multiple),
      staticDisabled: input.isTestEnabled,
      disabledReason: input.isTestEnabled ? "Test mode is active." : ""
    }));
  });

  routeSortDefinitions.forEach((definition) => {
    targets.push(buildDraftTarget({
      target: `route.orderSorts.${definition.key}`,
      label: definition.label,
      description: `Adds or removes the ${definition.label.toLowerCase()} on the route draft.`,
      entity: "route",
      valueType: "boolean",
      currentValue: Boolean(getConditionValue(input.orderRoutingSortOptions, input.ruleEnums, definition.key)),
      staticDisabled: input.isTestEnabled,
      disabledReason: input.isTestEnabled ? "Test mode is active." : ""
    }));
  });

  inventoryFilterDefinitions.forEach((definition) => {
    targets.push(buildDraftTarget({
      target: `selectedRule.inventoryFilters.${definition.key}`,
      label: definition.label,
      description: definition.description || `Sets or creates the ${definition.label.toLowerCase()} on the selected rule draft.`,
      aliases: definition.aliases,
      entity: "selectedRule",
      valueType: definition.valueType,
      currentValue: getTypedConditionValue(input.inventoryRuleFilterOptions, input.conditionFilterEnums, definition),
      options: definition.options || (definition.optionSource ? optionSources[definition.optionSource] : undefined),
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabledReason: selectedRuleDisabledReason
    }));
  });

  inventorySortDefinitions.forEach((definition) => {
    const isCustomerSequenceDisabled = definition.key === "CUSTOMER_SEQ" && !getConditionValue(input.inventoryRuleFilterOptions, input.conditionFilterEnums, "FACILITY_GROUP");
    targets.push(buildDraftTarget({
      target: `selectedRule.inventorySorts.${definition.key}`,
      label: definition.label,
      description: `Adds or removes the ${definition.label.toLowerCase()} on the selected rule draft.`,
      entity: "selectedRule",
      valueType: "boolean",
      currentValue: Boolean(getConditionValue(input.inventoryRuleSortOptions, input.conditionSortEnums, definition.key)),
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabled: Boolean(selectedRuleDisabledReason) || isCustomerSequenceDisabled,
      disabledReason: selectedRuleDisabledReason || (isCustomerSequenceDisabled ? "Customer sequence sorting is only available when an inventory facility group filter is selected." : ""),
      dependencies: definition.key === "CUSTOMER_SEQ" ? [{
        target: "selectedRule.inventoryFilters.FACILITY_GROUP",
        values: optionSources.brokeringFacilityGroups.map((option) => option.id),
        description: "Select an inventory facility group before changing customer sequence sorting."
      }] : undefined
    }));
  });

  const isPromiseDateApplied = Boolean(getConditionValue(input.orderRoutingFilterOptions, input.ruleEnums, "PROMISE_DATE"));
  const isPartialAllocationEnabled = input.selectedRoutingRule?.assignmentEnumId === "ORA_MULTI";
  const isGroupedPartialDisabled = !isPartialAllocationEnabled && !isPromiseDateApplied;
  const clearAutoCancelDays = parseBooleanAction(input.inventoryRuleActions[input.actionEnums.RM_AUTO_CANCEL_DATE.id]?.actionValue);
  const moveToQueueActionId = input.actionEnums.MOVE_TO_QUEUE.id;
  targets.push(
    buildDraftTarget({
      target: "selectedRule.partialAllocation",
      label: "Partial allocation",
      description: "Controls whether partial allocation is allowed for the selected rule.",
      entity: "selectedRule",
      valueType: "boolean",
      currentValue: isPartialAllocationEnabled,
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabled: Boolean(selectedRuleDisabledReason) || isPromiseDateApplied,
      disabledReason: selectedRuleDisabledReason || (isPromiseDateApplied ? "Partial allocation is locked because a promise date filter is applied." : ""),
    }),
    buildDraftTarget({
      target: "selectedRule.partialGroupItemsAllocation",
      label: "Grouped item partial allocation",
      description: "Controls whether grouped items can be partially allocated for the selected rule.",
      entity: "selectedRule",
      valueType: "boolean",
      currentValue: getConditionValue(input.inventoryRuleFilterOptions, input.conditionFilterEnums, "SPLIT_ITEM_GROUP") === "Y",
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabled: Boolean(selectedRuleDisabledReason) || isGroupedPartialDisabled,
      disabledReason: selectedRuleDisabledReason || (isGroupedPartialDisabled ? "Grouped item partial allocation requires partial allocation to be enabled." : ""),
      dependencies: [{
        target: "selectedRule.partialAllocation",
        values: [true],
        description: "Enable partial allocation before changing grouped item partial allocation."
      }]
    }),
    buildDraftTarget({
      target: "selectedRule.unavailableItemsAction",
      label: "Unavailable items action",
      description: "Controls whether unavailable items move to the next rule or to a queue.",
      entity: "selectedRule",
      valueType: "enum",
      currentValue: input.ruleActionType,
      options: unavailableActionOptions(input.actionEnums),
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabledReason: selectedRuleDisabledReason
    }),
    buildDraftTarget({
      target: "selectedRule.unavailableItemsQueueId",
      label: "Unavailable items queue",
      description: "Selects the queue used when unavailable items are moved to a queue.",
      entity: "selectedRule",
      valueType: "enum",
      currentValue: input.inventoryRuleActions[input.ruleActionType]?.actionValue,
      options: optionSources.queues,
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabled: Boolean(selectedRuleDisabledReason) || input.ruleActionType !== moveToQueueActionId,
      disabledReason: selectedRuleDisabledReason || "Queue selection is only available when unavailable items are moved to a queue.",
      dependencies: [{
        target: "selectedRule.unavailableItemsAction",
        values: [moveToQueueActionId],
        description: "Move unavailable items to a queue before selecting the queue."
      }]
    }),
    buildDraftTarget({
      target: "selectedRule.clearAutoCancelDays",
      label: "Clear auto cancel days",
      description: "Controls whether auto cancel days should be cleared for unavailable items.",
      entity: "selectedRule",
      valueType: "boolean",
      currentValue: clearAutoCancelDays,
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabledReason: selectedRuleDisabledReason
    }),
    buildDraftTarget({
      target: "selectedRule.autoCancelDays",
      label: "Auto cancel days",
      description: "Sets the number of auto cancel days for unavailable items.",
      entity: "selectedRule",
      valueType: "number",
      currentValue: Number(input.inventoryRuleActions[input.actionEnums.AUTO_CANCEL_DAYS.id]?.actionValue || 0),
      staticDisabled: Boolean(selectedRuleDisabledReason),
      disabled: Boolean(selectedRuleDisabledReason) || clearAutoCancelDays,
      disabledReason: selectedRuleDisabledReason || "Auto cancel days are hidden while clear auto cancel days is enabled.",
      dependencies: [{
        target: "selectedRule.clearAutoCancelDays",
        values: [false],
        description: "Turn off clear auto cancel days before setting auto cancel days."
      }]
    })
  );

  return {
    pageId: "order-routing.rules",
    route: input.pageRoute,
    visibleEntities: {
      brokeringRun: {
        routingGroupId: input.brokeringRun?.routingGroupId || "",
        groupName: input.brokeringRun?.groupName || "",
        productStoreId: input.brokeringRun?.productStoreId || "",
        schedule: input.brokeringRun?.schedule || null,
        availableSiblingRoutings: (input.brokeringRun?.routings || []).map((r) => ({
          orderRoutingId: r.orderRoutingId,
          routingName: r.routingName,
          statusId: r.statusId,
          sequenceNum: r.sequenceNum
        })),
        note: "This is the currently open Circuit brokering run/routing group. Use this groupName when answering questions about the current brokering run."
      },
      route: {
        orderRoutingId: input.orderRoutingId,
        routingName: input.routingName,
        statusId: input.routingStatus,
        currentOrderFilters: summarizeConditionValues(input.orderRoutingFilterOptions, input.ruleEnums, routeFilterDefinitions, "route.orderFilters", optionSources),
        currentOrderSorts: summarizeSortValues(input.orderRoutingSortOptions, input.ruleEnums, routeSortDefinitions, "route.orderSorts"),
        activeOrderFilterTargets: activeTargets(input.orderRoutingFilterOptions, input.ruleEnums, "route.orderFilters"),
        activeOrderSortTargets: activeTargets(input.orderRoutingSortOptions, input.ruleEnums, "route.orderSorts"),
        availableInventoryRules: summarizeInventoryRules(input, optionSources),
        draftLimitations: {
          selectedRuleOnly: false,
          canCreateInventoryRules: true,
          canCreateSiblingRoutings: true,
          canRenameInventoryRules: false,
          note: "Circuit can draft changes across existing inventory rules and can create new local draft inventory rules. New rules and edits are persisted only when the user saves the route."
        }
      },
      selectedRule: hasSelectedRule ? {
        routingRuleId: input.selectedRoutingRule.routingRuleId,
        ruleName: input.selectedRoutingRule.ruleName,
        statusId: input.selectedRoutingRule.statusId,
        assignmentEnumId: input.selectedRoutingRule.assignmentEnumId,
        activeInventoryFilterTargets: activeTargets(input.inventoryRuleFilterOptions, input.conditionFilterEnums, "selectedRule.inventoryFilters"),
        activeInventorySortTargets: activeTargets(input.inventoryRuleSortOptions, input.conditionSortEnums, "selectedRule.inventorySorts"),
        activeActionIds: Object.keys(input.inventoryRuleActions),
        currentValues: summarizeInventoryRuleCurrentValues({
          ...input.selectedRoutingRule,
          inventoryFilters: {
            ENTCT_FILTER: input.inventoryRuleFilterOptions,
            ENTCT_SORT_BY: input.inventoryRuleSortOptions
          },
          actions: input.inventoryRuleActions
        }, input, optionSources)
      } : null
    },
    editableTargets: targets,
    outputContract: createDraftOutputContract()
  };
}

export function buildBrokeringRulesBindings(draft: BrokeringRulesDraftRefs): DraftTargetBindings {
  const targets = [
    "route.statusId",
    "selectedRule.statusId",
    ...routeFilterDefinitions.map((definition) => `route.orderFilters.${definition.key}`),
    ...routeSortDefinitions.map((definition) => `route.orderSorts.${definition.key}`),
    ...inventoryFilterDefinitions.map((definition) => `selectedRule.inventoryFilters.${definition.key}`),
    ...inventorySortDefinitions.map((definition) => `selectedRule.inventorySorts.${definition.key}`),
    "selectedRule.partialAllocation",
    "selectedRule.partialGroupItemsAllocation",
    "selectedRule.unavailableItemsAction",
    "selectedRule.unavailableItemsQueueId",
    "selectedRule.clearAutoCancelDays",
    "selectedRule.autoCancelDays"
  ];

  return createDraftTargetBindings(targets.map((target) => ({
    target,
    setValue: (value, operation) => applyBrokeringRulesOperation({ ...operation, op: "set", target, value }, draft),
    afterApply: () => {
      draft.hasUnsavedChanges.value = true;
      refreshDraftRefs(draft);
    }
  })));
}

function applyBrokeringRulesOperation(operation: DraftOperation, draft: BrokeringRulesDraftRefs): boolean {
  if (operation.ruleKey && operation.target.startsWith("selectedRule.")) {
    return applyScopedRuleOperation(operation, draft);
  }

  return applyActiveRuleOperation(operation, draft);
}

function applyScopedRuleOperation(operation: DraftOperation, draft: BrokeringRulesDraftRefs): boolean {
  const previousRuleId = draft.selectedRoutingRule.value?.routingRuleId || "";
  if (previousRuleId) {
    updateCurrentRuleDraft(draft);
  }

  const ruleId = ensureLocalRuleDraft(operation, draft);
  if (!ruleId) {
    return false;
  }

  loadRuleDraft(ruleId, draft);

  try {
    return applyActiveRuleOperation({ ...operation, ruleKey: undefined }, draft);
  } finally {
    if (previousRuleId && previousRuleId !== ruleId) {
      loadRuleDraft(previousRuleId, draft);
    } else if (!previousRuleId) {
      clearActiveRuleDraft(draft);
    }
  }
}

function applyActiveRuleOperation(operation: DraftOperation, draft: BrokeringRulesDraftRefs): boolean {
  if (operation.target === "route.statusId") {
    draft.routingStatus.value = String(operation.value);
    return true;
  }

  if (!draft.selectedRoutingRule.value?.routingRuleId && operation.target.startsWith("selectedRule.")) {
    return false;
  }

  if (operation.target === "selectedRule.statusId") {
    setSelectedRuleStatus(String(operation.value), draft);
    return true;
  }

  const routeFilterKey = getTargetKey(operation.target, "route.orderFilters.");
  if (routeFilterKey) {
    setConditionOption(draft.orderRoutingFilterOptions.value, draft.ruleEnums, routeFilterKey, operation.value as DraftValue, "ENTCT_FILTER", draft.orderRoutingId, "orderRoutingId");
    applyPromiseDatePartialAllocation(routeFilterKey, draft);
    return true;
  }

  const routeSortKey = getTargetKey(operation.target, "route.orderSorts.");
  if (routeSortKey) {
    setSortOption(draft.orderRoutingSortOptions.value, draft.ruleEnums, routeSortKey, Boolean(operation.value), draft.orderRoutingId, "orderRoutingId");
    return true;
  }

  const inventoryFilterKey = getTargetKey(operation.target, "selectedRule.inventoryFilters.");
  if (inventoryFilterKey) {
    setConditionOption(draft.inventoryRuleFilterOptions.value, draft.conditionFilterEnums, inventoryFilterKey, operation.value as DraftValue, "ENTCT_FILTER", draft.selectedRoutingRule.value.routingRuleId, "routingRuleId");
    if (inventoryFilterKey === "PROXIMITY" && !draft.inventoryRuleFilterOptions.value[draft.conditionFilterEnums.MEASUREMENT_SYSTEM.code]) {
      setConditionOption(draft.inventoryRuleFilterOptions.value, draft.conditionFilterEnums, "MEASUREMENT_SYSTEM", "IMPERIAL", "ENTCT_FILTER", draft.selectedRoutingRule.value.routingRuleId, "routingRuleId");
    }
    updateCurrentRuleDraft(draft);
    return true;
  }

  const inventorySortKey = getTargetKey(operation.target, "selectedRule.inventorySorts.");
  if (inventorySortKey) {
    setSortOption(draft.inventoryRuleSortOptions.value, draft.conditionSortEnums, inventorySortKey, Boolean(operation.value), draft.selectedRoutingRule.value.routingRuleId, "routingRuleId");
    updateCurrentRuleDraft(draft);
    return true;
  }

  if (operation.target === "selectedRule.partialAllocation") {
    setPartialAllocation(Boolean(operation.value), draft);
    return true;
  }

  if (operation.target === "selectedRule.partialGroupItemsAllocation") {
    setGroupedItemPartialAllocation(Boolean(operation.value), draft);
    return true;
  }

  if (operation.target === "selectedRule.unavailableItemsAction") {
    setUnavailableItemsAction(String(operation.value), draft);
    updateCurrentRuleDraft(draft);
    return true;
  }

  if (operation.target === "selectedRule.unavailableItemsQueueId") {
    setUnavailableItemsQueue(String(operation.value), draft);
    updateCurrentRuleDraft(draft);
    return true;
  }

  if (operation.target === "selectedRule.clearAutoCancelDays") {
    setRuleAction(draft, "RM_AUTO_CANCEL_DATE", Boolean(operation.value));
    updateCurrentRuleDraft(draft);
    return true;
  }

  if (operation.target === "selectedRule.autoCancelDays") {
    setRuleAction(draft, "RM_AUTO_CANCEL_DATE", false);
    setRuleAction(draft, "AUTO_CANCEL_DAYS", Number(operation.value));
    updateCurrentRuleDraft(draft);
    return true;
  }

  return false;
}

function ensureLocalRuleDraft(operation: DraftOperation, draft: BrokeringRulesDraftRefs) {
  const ruleId = String(operation.ruleKey || "").trim();
  if (!ruleId) {
    return "";
  }

  let rule = draft.inventoryRules.value.find((candidate: any) => candidate.routingRuleId === ruleId);
  if (!rule) {
    rule = {
      routingRuleId: ruleId,
      orderRoutingId: draft.orderRoutingId,
      ruleName: operation.ruleName || humanizeRuleKey(ruleId),
      statusId: "RULE_DRAFT",
      sequenceNum: operation.ruleSequence ?? nextRuleSequence(draft.inventoryRules.value),
      assignmentEnumId: "ORA_SINGLE",
      createdDate: Date.now()
    };
    draft.inventoryRules.value.push(rule);
  }

  if (!draft.rulesInformation.value[ruleId]) {
    draft.rulesInformation.value[ruleId] = {
      ...rule,
      inventoryFilters: {
        ENTCT_FILTER: {},
        ENTCT_SORT_BY: {}
      },
      actions: defaultRuleActions(ruleId, draft)
    };
  }

  return ruleId;
}

function loadRuleDraft(ruleId: string, draft: BrokeringRulesDraftRefs) {
  const ruleInfo = draft.rulesInformation.value[ruleId] || draft.inventoryRules.value.find((rule: any) => rule.routingRuleId === ruleId);
  if (!ruleInfo) {
    clearActiveRuleDraft(draft);
    return;
  }

  const inventoryFilters = ruleInfo.inventoryFilters || {};
  const actions = ruleInfo.actions || {};
  draft.selectedRoutingRule.value = { ...ruleInfo };
  draft.inventoryRuleFilterOptions.value = { ...(inventoryFilters.ENTCT_FILTER || {}) };
  draft.inventoryRuleSortOptions.value = { ...(inventoryFilters.ENTCT_SORT_BY || {}) };
  draft.inventoryRuleActions.value = { ...actions };
  draft.ruleActionType && (draft.ruleActionType.value = findRuleActionType(actions, draft));
}

function clearActiveRuleDraft(draft: BrokeringRulesDraftRefs) {
  draft.selectedRoutingRule.value = {};
  draft.inventoryRuleFilterOptions.value = {};
  draft.inventoryRuleSortOptions.value = {};
  draft.inventoryRuleActions.value = {};
  draft.ruleActionType && (draft.ruleActionType.value = "");
}

function defaultRuleActions(ruleId: string, draft: BrokeringRulesDraftRefs) {
  const nextRuleActionId = draft.actionEnums.NEXT_RULE?.id;
  if (!nextRuleActionId) {
    return {};
  }

  return {
    [nextRuleActionId]: {
      routingRuleId: ruleId,
      actionTypeEnumId: nextRuleActionId,
      actionValue: "",
      createdDate: Date.now()
    }
  };
}

function findRuleActionType(actions: Record<string, any>, draft: BrokeringRulesDraftRefs) {
  const actionTypes = [draft.actionEnums.NEXT_RULE?.id, draft.actionEnums.MOVE_TO_QUEUE?.id].filter(Boolean);
  return Object.keys(actions || {}).find((actionId) => actionTypes.includes(actionId)) || "";
}

function nextRuleSequence(rules: any[]) {
  const sequenceNums = rules.map((rule) => Number(rule.sequenceNum)).filter((sequenceNum) => !Number.isNaN(sequenceNum));
  return sequenceNums.length ? Math.max(...sequenceNums) + 5 : 0;
}

function humanizeRuleKey(ruleKey: string) {
  const name = ruleKey.replace(/^new:/, "").replace(/[-_]+/g, " ").trim();
  return name ? name.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "New rule";
}

function getTargetKey(target: string, prefix: string) {
  return target.startsWith(prefix) ? target.slice(prefix.length) : "";
}

function setSortOption(options: Record<string, ConditionOption>, enums: Record<string, EnumInfo>, key: string, enabled: boolean, ownerId: string, ownerIdField: "orderRoutingId" | "routingRuleId") {
  const enumInfo = enums[key];
  if (!enumInfo?.code) {
    throw new Error(`Unsupported draft key: ${key}`);
  }

  if (!enabled) {
    delete options[enumInfo.code];
    return;
  }

  setConditionOption(options, enums, key, "", "ENTCT_SORT_BY", ownerId, ownerIdField);
}

function setConditionOption(options: Record<string, ConditionOption>, enums: Record<string, EnumInfo>, key: string, value: DraftValue, conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY", ownerId: string, ownerIdField: "orderRoutingId" | "routingRuleId", operator?: string) {
  const enumInfo = enums[key];
  if (!enumInfo?.code) {
    throw new Error(`Unsupported draft key: ${key}`);
  }

  const normalizedValue = normalizeValue(value);
  options[enumInfo.code] = {
    ...(options[enumInfo.code] || {}),
    [ownerIdField]: ownerId,
    conditionTypeEnumId,
    fieldName: enumInfo.code,
    fieldValue: normalizedValue,
    operator: conditionTypeEnumId === "ENTCT_SORT_BY" ? "" : operator || getOperator(enumInfo.code, normalizedValue, conditionTypeEnumId),
    sequenceNum: options[enumInfo.code]?.sequenceNum ?? nextSequenceNum(options),
    createdDate: options[enumInfo.code]?.createdDate || Date.now()
  };
}

function normalizeValue(value: DraftValue): string | number | boolean {
  if (Array.isArray(value)) {
    return value.join(",");
  }

  if (typeof value === "boolean") {
    return value ? "Y" : "N";
  }

  return value;
}

function getOperator(fieldName: string, value: string | number | boolean, conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY"): string {
  if (conditionTypeEnumId === "ENTCT_SORT_BY") {
    return "";
  }

  if (fieldName.includes("_excluded")) {
    return typeof value === "string" && value.includes(",") ? "not-in" : "not-equals";
  }

  if (fieldName === "promiseDaysCutoff" || fieldName === "promiseDaysCutoff_excluded") {
    return "less-equals";
  }

  return typeof value === "string" && value.includes(",") ? "in" : "equals";
}

function nextSequenceNum(options: Record<string, ConditionOption>): number {
  const sequenceNums = Object.values(options)
    .map((option) => Number(option.sequenceNum))
    .filter((sequenceNum) => !Number.isNaN(sequenceNum));

  return sequenceNums.length ? Math.max(...sequenceNums) + 5 : 0;
}

function setSelectedRuleStatus(statusId: string, draft: BrokeringRulesDraftRefs) {
  const routingRuleId = draft.selectedRoutingRule.value.routingRuleId;
  draft.selectedRoutingRule.value.statusId = statusId;
  draft.inventoryRules.value.forEach((rule) => {
    if (rule.routingRuleId === routingRuleId) {
      rule.statusId = statusId;
    }
  });

  if (draft.rulesInformation.value[routingRuleId]) {
    draft.rulesInformation.value[routingRuleId].statusId = statusId;
  }

  refreshRuleList(draft);
}

function applyPromiseDatePartialAllocation(key: string, draft: BrokeringRulesDraftRefs) {
  if (key === "PROMISE_DATE" || key === "PROMISE_DATE_EXCLUDED") {
    setPartialAllocation(true, draft);
  }
}

function setPartialAllocation(enabled: boolean, draft: BrokeringRulesDraftRefs) {
  const assignmentEnumId = enabled ? "ORA_MULTI" : "ORA_SINGLE";
  const routingRuleId = draft.selectedRoutingRule.value.routingRuleId;
  draft.selectedRoutingRule.value.assignmentEnumId = assignmentEnumId;
  draft.inventoryRules.value.forEach((rule) => {
    if (rule.routingRuleId === routingRuleId) {
      rule.assignmentEnumId = assignmentEnumId;
    }
  });

  setGroupedItemPartialAllocation(enabled, draft);
  updateCurrentRuleDraft(draft);
}

function setGroupedItemPartialAllocation(enabled: boolean, draft: BrokeringRulesDraftRefs) {
  setConditionOption(draft.inventoryRuleFilterOptions.value, draft.conditionFilterEnums, "SPLIT_ITEM_GROUP", enabled, "ENTCT_FILTER", draft.selectedRoutingRule.value.routingRuleId, "routingRuleId");
  updateCurrentRuleDraft(draft);
}

function setUnavailableItemsAction(actionTypeEnumId: string, draft: BrokeringRulesDraftRefs) {
  const nextRuleId = draft.actionEnums.NEXT_RULE.id;
  const moveToQueueId = draft.actionEnums.MOVE_TO_QUEUE.id;
  const routingRuleId = draft.selectedRoutingRule.value.routingRuleId;
  const previousMoveToQueueValue = draft.inventoryRuleActions.value[moveToQueueId]?.actionValue || "";

  delete draft.inventoryRuleActions.value[actionTypeEnumId === nextRuleId ? moveToQueueId : nextRuleId];
  if (draft.ruleActionType) {
    draft.ruleActionType.value = actionTypeEnumId;
  }

  draft.inventoryRuleActions.value[actionTypeEnumId] = {
    ...(draft.inventoryRuleActions.value[actionTypeEnumId] || {}),
    routingRuleId,
    actionTypeEnumId,
    actionValue: actionTypeEnumId === moveToQueueId ? previousMoveToQueueValue : "",
    createdDate: draft.inventoryRuleActions.value[actionTypeEnumId]?.createdDate || Date.now()
  };
}

function setUnavailableItemsQueue(queueId: string, draft: BrokeringRulesDraftRefs) {
  const moveToQueueId = draft.actionEnums.MOVE_TO_QUEUE.id;
  if (draft.ruleActionType?.value !== moveToQueueId) {
    setUnavailableItemsAction(moveToQueueId, draft);
  }

  draft.inventoryRuleActions.value[moveToQueueId] = {
    ...(draft.inventoryRuleActions.value[moveToQueueId] || {}),
    routingRuleId: draft.selectedRoutingRule.value.routingRuleId,
    actionTypeEnumId: moveToQueueId,
    actionValue: queueId,
    createdDate: draft.inventoryRuleActions.value[moveToQueueId]?.createdDate || Date.now()
  };
}

function setRuleAction(draft: BrokeringRulesDraftRefs, actionKey: "RM_AUTO_CANCEL_DATE" | "AUTO_CANCEL_DAYS", actionValue: string | number | boolean) {
  const actionTypeEnumId = draft.actionEnums[actionKey].id;
  draft.inventoryRuleActions.value[actionTypeEnumId] = {
    ...(draft.inventoryRuleActions.value[actionTypeEnumId] || {}),
    routingRuleId: draft.selectedRoutingRule.value.routingRuleId,
    actionTypeEnumId,
    actionValue,
    createdDate: draft.inventoryRuleActions.value[actionTypeEnumId]?.createdDate || Date.now()
  };
}

function updateCurrentRuleDraft(draft: BrokeringRulesDraftRefs) {
  const routingRuleId = draft.selectedRoutingRule.value.routingRuleId;
  if (!routingRuleId) {
    return;
  }

  draft.rulesInformation.value[routingRuleId] = {
    ...(draft.rulesInformation.value[routingRuleId] || draft.selectedRoutingRule.value),
    ...draft.selectedRoutingRule.value,
    inventoryFilters: {
      ENTCT_FILTER: draft.inventoryRuleFilterOptions.value,
      ENTCT_SORT_BY: draft.inventoryRuleSortOptions.value
    },
    actions: draft.inventoryRuleActions.value
  };
}

function refreshDraftRefs(draft: BrokeringRulesDraftRefs) {
  draft.orderRoutingFilterOptions.value = { ...draft.orderRoutingFilterOptions.value };
  draft.orderRoutingSortOptions.value = { ...draft.orderRoutingSortOptions.value };
  draft.inventoryRuleFilterOptions.value = { ...draft.inventoryRuleFilterOptions.value };
  draft.inventoryRuleSortOptions.value = { ...draft.inventoryRuleSortOptions.value };
  draft.inventoryRuleActions.value = { ...draft.inventoryRuleActions.value };
  draft.inventoryRules.value = [...draft.inventoryRules.value];
  draft.rulesInformation.value = { ...draft.rulesInformation.value };

  if (draft.selectedRoutingRule.value?.routingRuleId) {
    draft.selectedRoutingRule.value = { ...draft.selectedRoutingRule.value };
  }

  refreshRuleList(draft);
}

function refreshRuleList(draft: BrokeringRulesDraftRefs) {
  if (!draft.rulesForReorder) {
    return;
  }

  draft.rulesForReorder.value = draft.inventoryRules.value
    .filter((rule) => rule.statusId !== "RULE_ARCHIVED")
    .sort((left, right) => Number(left.sequenceNum || 0) - Number(right.sequenceNum || 0));
}

function summarizeInventoryRules(input: ManifestInput, optionSources: Record<string, DraftOption[]>) {
  const rulesInformation = input.rulesInformation || {};
  return (input.inventoryRules || []).map((rule) => {
    const ruleInfo = {
      ...rule,
      ...(rulesInformation[rule.routingRuleId] || {})
    };

    return {
      routingRuleId: ruleInfo.routingRuleId,
      ruleName: ruleInfo.ruleName,
      statusId: ruleInfo.statusId,
      sequenceNum: ruleInfo.sequenceNum,
      currentValues: summarizeInventoryRuleCurrentValues(ruleInfo, input, optionSources)
    };
  });
}

function summarizeInventoryRuleCurrentValues(ruleInfo: any, input: ManifestInput, optionSources: Record<string, DraftOption[]>) {
  const inventoryFilters = ruleInfo?.inventoryFilters?.ENTCT_FILTER || {};
  const inventorySorts = ruleInfo?.inventoryFilters?.ENTCT_SORT_BY || {};
  const actions = ruleInfo?.actions || {};
  const partialGroupedItemAllocation = getConditionValue(inventoryFilters, input.conditionFilterEnums, "SPLIT_ITEM_GROUP") === "Y";

  return {
    assignmentEnumId: ruleInfo?.assignmentEnumId || "",
    partialAllocation: ruleInfo?.assignmentEnumId === "ORA_MULTI",
    partialGroupedItemAllocation,
    inventoryFilters: [
      ...summarizeConditionValues(inventoryFilters, input.conditionFilterEnums, inventoryFilterDefinitions, "selectedRule.inventoryFilters", optionSources),
      ...summarizePartialGroupedItemAllocation(inventoryFilters, input)
    ],
    inventorySorts: summarizeSortValues(inventorySorts, input.conditionSortEnums, inventorySortDefinitions, "selectedRule.inventorySorts"),
    unavailableItems: summarizeUnavailableItems(actions, input.actionEnums, optionSources.queues)
  };
}

function summarizePartialGroupedItemAllocation(inventoryFilters: Record<string, ConditionOption>, input: ManifestInput) {
  const value = getConditionValue(inventoryFilters, input.conditionFilterEnums, "SPLIT_ITEM_GROUP");
  if (value === undefined) {
    return [];
  }

  const enabled = value === "Y";
  const condition = inventoryFilters[input.conditionFilterEnums.SPLIT_ITEM_GROUP?.code];
  return [{
    target: "selectedRule.partialGroupItemsAllocation",
    label: "Grouped item partial allocation",
    value: enabled,
    valueLabel: enabled ? "Allowed" : "Not allowed",
    operator: condition?.operator || "equals",
    sequenceNum: condition?.sequenceNum
  }];
}

function summarizeUnavailableItems(actions: Record<string, any>, actionEnums: Record<string, EnumInfo>, queueOptions: DraftOption[]) {
  const nextRuleActionId = actionEnums.NEXT_RULE?.id;
  const moveToQueueActionId = actionEnums.MOVE_TO_QUEUE?.id;
  const clearAutoCancelActionId = actionEnums.RM_AUTO_CANCEL_DATE?.id;
  const autoCancelDaysActionId = actionEnums.AUTO_CANCEL_DAYS?.id;
  const actionTypeEnumId = actions[moveToQueueActionId]?.actionTypeEnumId
    || actions[nextRuleActionId]?.actionTypeEnumId
    || "";
  const queueId = actionTypeEnumId === moveToQueueActionId ? actions[moveToQueueActionId]?.actionValue || "" : "";
  const queueOption = queueOptions.find((option) => option.id === queueId);
  const clearAutoCancelDays = parseBooleanAction(actions[clearAutoCancelActionId]?.actionValue);
  const autoCancelDaysValue = actions[autoCancelDaysActionId]?.actionValue;

  return {
    actionTypeEnumId,
    actionLabel: actionTypeEnumId === moveToQueueActionId ? "Queue" : actionTypeEnumId === nextRuleActionId ? "Next rule" : "",
    queueId,
    queueLabel: queueOption?.label || queueId,
    clearAutoCancelDays,
    autoCancelDays: autoCancelDaysValue === undefined || autoCancelDaysValue === "" ? null : Number(autoCancelDaysValue)
  };
}

function summarizeConditionValues(
  options: Record<string, ConditionOption>,
  enums: Record<string, EnumInfo>,
  definitions: FilterDefinition[],
  targetPrefix: string,
  optionSources: Record<string, DraftOption[]>
) {
  const codeToKey = enumCodeToKey(enums);
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  return Object.entries(options || {})
    .map(([code, condition]) => {
      const key = codeToKey[code];
      const definition = definitionsByKey.get(key);
      if (!definition) {
        return null;
      }

      const value = getTypedConditionValue(options, enums, definition);
      return {
        target: `${targetPrefix}.${key}`,
        label: definition.label,
        value,
        valueLabel: summarizeValueLabel(value, definition.options || optionSourceOptions(definition, optionSources)),
        operator: condition.operator || getOperator(code, value as any, "ENTCT_FILTER"),
        sequenceNum: condition.sequenceNum
      };
    })
    .filter(Boolean)
    .sort(sortBySequence) as Array<Record<string, unknown>>;
}

function summarizeSortValues(
  options: Record<string, ConditionOption>,
  enums: Record<string, EnumInfo>,
  definitions: SortDefinition[],
  targetPrefix: string
) {
  const codeToKey = enumCodeToKey(enums);
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  return Object.entries(options || {})
    .map(([code, condition]) => {
      const key = codeToKey[code];
      const definition = definitionsByKey.get(key);
      if (!definition) {
        return null;
      }

      return {
        target: `${targetPrefix}.${key}`,
        label: definition.label,
        sequenceNum: condition.sequenceNum
      };
    })
    .filter(Boolean)
    .sort(sortBySequence) as Array<Record<string, unknown>>;
}

function optionSourceOptions(definition: FilterDefinition, optionSources: Record<string, DraftOption[]>) {
  return definition.optionSource ? optionSources[definition.optionSource] || [] : [];
}

function summarizeValueLabel(value: DraftValue | undefined, options: DraftOption[]) {
  if (value === undefined) {
    return "";
  }

  if (!options.length) {
    if (typeof value === "boolean") {
      return value ? "Allowed" : "Not allowed";
    }
    return Array.isArray(value) ? value.join(", ") : String(value);
  }

  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item) => options.find((option) => String(option.id) === String(item))?.label || String(item))
    .join(", ");
}

function enumCodeToKey(enums: Record<string, EnumInfo>) {
  return Object.entries(enums).reduce((result: Record<string, string>, [key, enumInfo]) => {
    result[enumInfo.code] = key;
    return result;
  }, {});
}

function sortBySequence(left: any, right: any) {
  return Number(left?.sequenceNum ?? 0) - Number(right?.sequenceNum ?? 0);
}

function buildOptionSources(input: ManifestInput): Record<string, DraftOption[]> {
  return {
    queues: toQueueDraftOptions(input.facilities),
    shippingMethods: toDraftOptions(input.shippingMethods, ["description"]),
    salesChannels: toDraftOptions(input.salesChannels, ["description", "enumName"]),
    facilityGroups: toFacilityGroupDraftOptions(input.facilityGroups),
    brokeringFacilityGroups: toFacilityGroupDraftOptions(input.brokeringFacilityGroups),
    priorities: [
      { id: "HIGH", label: "High" },
      { id: "MEDIUM", label: "Medium" },
      { id: "Low", label: "Low" }
    ],
    measurementSystems: [
      { id: "METRIC", label: "Kilometers", aliases: ["kms", "kilometers"] },
      { id: "IMPERIAL", label: "Miles", aliases: ["miles"] }
    ]
  };
}

function facilityOrderLimitOptions(): DraftOption[] {
  return [
    {
      id: "false",
      label: "Respect facility order limits",
      aliases: [
        "cap store usage",
        "cap stores",
        "protect stores",
        "protect store capacity",
        "enforce facility order limits",
        "enforce store caps",
        "respect store caps",
        "use facility order limits",
        "do not bypass facility order limits"
      ]
    },
    {
      id: "true",
      label: "Bypass facility order limits",
      aliases: [
        "turn off facility order limit check",
        "ignore facility order limit",
        "ignore facility order limits",
        "bypass facility order limit",
        "bypass facility order limits",
        "disable store caps",
        "turn off store caps"
      ]
    }
  ];
}

function toQueueDraftOptions(options: Record<string, any>): DraftOption[] {
  return toDraftOptions(options, ["facilityName"]).map((option) => ({
    ...option,
    aliases: queueAliases(option)
  }));
}

function toFacilityGroupDraftOptions(options: Record<string, any>): DraftOption[] {
  return toDraftOptions(options, ["facilityGroupName"]).map((option) => ({
    ...option,
    aliases: facilityGroupAliases(option)
  }));
}

function queueAliases(option: DraftOption): string[] {
  const normalizedLabel = normalizeAlias(option.label);
  const aliases = new Set((option.aliases || []).map(normalizeAlias).filter(Boolean));

  if (normalizedLabel.endsWith(" parking")) {
    const baseLabel = normalizedLabel.replace(/\s+parking$/, "").trim();
    if (baseLabel) {
      aliases.add(baseLabel);
      aliases.add(`${baseLabel} queue`);
      aliases.add(`${baseLabel} orders`);
    }
  }

  aliases.delete(normalizedLabel);
  return Array.from(aliases);
}

function facilityGroupAliases(option: DraftOption): string[] {
  const normalizedLabel = normalizeAlias(option.label);
  const normalizedId = normalizeAlias(option.id);
  const aliases = new Set((option.aliases || []).map(normalizeAlias).filter(Boolean));
  const genericLocationWords = new Set(["store", "stores", "location", "locations", "facility", "facilities"]);

  [normalizedLabel, normalizedId].forEach((value) => {
    if (!value) {
      return;
    }

    aliases.add(`${value} group`);
    aliases.add(`${value} facility group`);

    const compactValue = value
      .split(" ")
      .filter((word) => !genericLocationWords.has(word))
      .join(" ")
      .trim();

    if (compactValue && compactValue !== value) {
      aliases.add(compactValue);
      aliases.add(`${compactValue} group`);
      aliases.add(`${compactValue} facility group`);
    }
  });

  aliases.delete(normalizedLabel);
  aliases.delete(normalizedId);
  return Array.from(aliases);
}

function normalizeAlias(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function routeStatusOptions(): DraftOption[] {
  return [
    { id: "ROUTING_ACTIVE", label: "Active", aliases: ["activate", "active"] },
    { id: "ROUTING_DRAFT", label: "Draft", aliases: ["draft"] },
    { id: "ROUTING_ARCHIVED", label: "Archived", aliases: ["archive", "archived"] }
  ];
}

function ruleStatusOptions(): DraftOption[] {
  return [
    { id: "RULE_ACTIVE", label: "Active", aliases: ["activate", "active"] },
    { id: "RULE_DRAFT", label: "Draft", aliases: ["draft"] },
    { id: "RULE_ARCHIVED", label: "Archived", aliases: ["archive", "archived"] }
  ];
}

function unavailableActionOptions(actionEnums: Record<string, EnumInfo>): DraftOption[] {
  return [
    { id: actionEnums.NEXT_RULE.id, label: "Next rule", aliases: ["next", "next rule", "ora next rule"] },
    { id: actionEnums.MOVE_TO_QUEUE.id, label: "Queue", aliases: ["queue", "move to queue", "ora move to queue"] }
  ];
}

function getConditionValue(options: Record<string, ConditionOption>, enums: Record<string, EnumInfo>, key: string): DraftValue | undefined {
  const enumInfo = enums[key];
  const value = enumInfo?.code ? options?.[enumInfo.code]?.fieldValue : undefined;
  if (typeof value === "string" && value.includes(",")) {
    return value.split(",").filter(Boolean);
  }

  return value as DraftValue | undefined;
}

function getTypedConditionValue(options: Record<string, ConditionOption>, enums: Record<string, EnumInfo>, definition: FilterDefinition): DraftValue | undefined {
  const value = getConditionValue(options, enums, definition.key);
  if (definition.valueType !== "boolean" || value === undefined) {
    return value;
  }

  return parseBooleanOption(value);
}

function parseBooleanOption(value: DraftValue) {
  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "y", "yes", "on"].includes(String(value).toLowerCase());
}

function activeTargets(options: Record<string, ConditionOption>, enums: Record<string, EnumInfo>, targetPrefix: string) {
  const codeToKey = Object.entries(enums).reduce((result: Record<string, string>, [key, enumInfo]) => {
    result[enumInfo.code] = key;
    return result;
  }, {});

  return Object.keys(options || {})
    .map((code) => codeToKey[code])
    .filter(Boolean)
    .map((key) => `${targetPrefix}.${key}`);
}

function parseBooleanAction(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return false;
  }

  return String(value).toLowerCase() === "true";
}
