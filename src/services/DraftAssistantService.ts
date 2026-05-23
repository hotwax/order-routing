export type DraftValue = string | number | boolean | string[];

export type DraftOperationReason = {
  kind: "explicit_user_request" | "manifest_dependency";
  promptText: string;
  explanation: string;
  dependencyTarget?: string;
};

export type DraftOperation = {
  op: "set";
  target: string;
  value?: DraftValue;
  reason?: DraftOperationReason;
  ruleKey?: string;
  ruleName?: string;
  ruleSequence?: number;
};

export type DraftConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type DraftOperationSet = {
  operations: DraftOperation[];
  unansweredQuestions: string[];
  summary: string;
  intent?: "edit" | "inquiry";
  targetRouting?: {
    action: "edit" | "create";
    routingKey?: string;
    name?: string;
  };
};

export type BrokeringRouteDraft = {
  schemaVersion: "brokering-route-draft.v1";
  applyMode: "merge" | "replace";
  targetRouting?: {
    action: "edit" | "create";
    routingKey?: string;
    name?: string;
  };
  route: {
    statusId: "ROUTING_DRAFT" | "ROUTING_ACTIVE" | "ROUTING_ARCHIVED";
    orderSelection: {
      filters: {
        queues: OptionSelection;
        shippingMethods: OptionSelection;
        priorities: OptionSelection;
        promiseDateDays: {
          max: number | null;
          excludeMax: number | null;
        };
        salesChannels: OptionSelection;
        originFacilityGroups: OptionSelection;
      };
      sorts: Array<{
        field: "shipByDate" | "shipAfterDate" | "orderDate" | "shippingMethod" | "priority";
        direction: "asc" | "desc";
      }>;
    };
    inventoryRules: BrokeringRouteDraftRule[];
  };
  questions: string[];
  summary: string;
};

type BrokeringRouteDraftRule = {
  ruleKey: string;
  name: string;
  statusId: "RULE_DRAFT" | "RULE_ACTIVE" | "RULE_ARCHIVED";
  sequence: number;
  inventorySelection: {
    filters: {
      facilityGroups: OptionSelection;
      proximity: {
        maxDistance: number | null;
        unit: "METRIC" | "IMPERIAL" | null;
      };
      safetyStock: {
        minimum: number | null;
      };
      facilityOrderLimit: "respect" | "bypass" | "unchanged";
      shipmentThreshold: number | null;
    };
    sorts: Array<{
      field: "proximity" | "inventoryBalance" | "customerSequence";
      direction: "asc" | "desc";
    }>;
  };
  allocation: {
    partialOrderAllocation: boolean;
    partialGroupedItemAllocation: boolean;
  };
  unavailableItems: {
    action: "nextRule" | "moveToQueue";
    queueId: string | null;
    autoCancel: {
      mode: "none" | "clear" | "days";
      days: number | null;
    };
  };
};

type OptionSelection = {
  include: string[];
  exclude: string[];
};

export type DraftProposal = {
  operations: DraftOperation[];
  unansweredQuestions: string[];
  summary: string;
  providerSummary: string;
  intent?: "edit" | "inquiry";
};

export type DraftValueType = "string" | "number" | "boolean" | "enum" | "string[]";

export type DraftOption = {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  disabled?: boolean;
  disabledReason?: string;
};

export type DraftTargetDependency = {
  target: string;
  values: DraftValue[];
  description?: string;
};

export type DraftTargetCapability = {
  target: string;
  label: string;
  description?: string;
  aliases?: string[];
  entity?: string;
  valueType: DraftValueType;
  currentValue?: DraftValue;
  options?: DraftOption[];
  multiple?: boolean;
  editable: boolean;
  disabled?: boolean;
  disabledReason?: string;
  staticDisabled?: boolean;
  dependencies?: DraftTargetDependency[];
};

export type PageCapabilityManifest = {
  pageId: string;
  route: string;
  visibleEntities: Record<string, unknown>;
  editableTargets: DraftTargetCapability[];
  outputContract: {
    operations: DraftOperation["op"][];
    operationShape: Record<string, string>;
    responseShape: Record<string, string>;
  };
};

export type DraftValidationResult = {
  operations: DraftOperation[];
  unansweredQuestions: string[];
};

export type DraftApplyResult = {
  appliedCount: number;
  skipped: string[];
  unansweredQuestions: string[];
};

export type DraftTargetBinding = {
  target: string;
  setValue: (value: DraftValue, operation: DraftOperation) => void | boolean;
  afterApply?: (operation: DraftOperation) => void;
};

export type DraftTargetBindings = Record<string, DraftTargetBinding>;

type ValueValidationResult =
  | { valid: true; value: DraftValue }
  | { valid: false; question: string };

type TargetDraft = Omit<DraftTargetCapability, "editable"> & {
  editable?: boolean;
};

type DraftRequestOptions = {
  conversationHistory?: DraftConversationMessage[];
};

type OperationCandidateOptions = {
  skipEmpty?: boolean;
  skipUnchanged?: boolean;
  ruleKey?: string;
  ruleName?: string;
  ruleSequence?: number;
};

const ROUTE_ASSISTANT_ENDPOINT = "/brokering-route-assistant";

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

export function buildDraftTarget(target: TargetDraft): DraftTargetCapability {
  return {
    ...target,
    editable: target.editable ?? true,
    disabled: Boolean(target.staticDisabled || target.disabled)
  };
}

export function createDraftOutputContract(): PageCapabilityManifest["outputContract"] {
  return {
    operations: ["set"],
    operationShape: {
      op: "set",
      target: "one target path from editableTargets",
      value: "value matching the target valueType and options",
      ruleKey: "optional inventory rule key for rule-scoped operations; existing routingRuleId or new:* local draft key",
      ruleName: "optional inventory rule name for new local draft rules",
      ruleSequence: "optional inventory rule sequence for new local draft rules",
      reason: "{ kind: 'explicit_user_request' | 'manifest_dependency', promptText: exact latest-user phrase or dependency phrase, explanation: short reason, dependencyTarget?: target that requires this operation }"
    },
    responseShape: {
      operations: "array of draft operations",
      unansweredQuestions: "array of questions when a request is ambiguous or unavailable",
      summary: "short user-facing summary"
    }
  };
}

export function toDraftOptions(options: Record<string, any>, labelFields: string[]): DraftOption[] {
  return Object.entries(options || {}).map(([id, value]) => ({
    id,
    label: labelFields.map((field) => value?.[field]).find(Boolean) || id
  }));
}

export function createDraftTargetBindings(bindings: DraftTargetBinding[]): DraftTargetBindings {
  return bindings.reduce((result: DraftTargetBindings, binding) => {
    result[binding.target] = binding;
    return result;
  }, {});
}

export async function requestBrokeringRouteDraftOperations(prompt: string, manifest: PageCapabilityManifest, options: DraftRequestOptions = {}): Promise<DraftOperationSet> {
  const conversationHistory = normalizeConversationHistory(options.conversationHistory || []);
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const mastraUrl = (env.VITE_VUE_APP_MASTRA_URL || "http://localhost:4111").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${mastraUrl}${ROUTE_ASSISTANT_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        conversationHistory,
        pageCapabilityManifest: manifest,
        outputContract: manifest.outputContract
      })
    });
  } catch {
    throw new Error(`Mastra is not reachable at ${mastraUrl}. Start it with npm run mastra:dev.`);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: string; issues?: string[] } | null;
    const issues = errorBody?.issues?.length ? ` ${errorBody.issues.join(" ")}` : "";
    throw new Error(errorBody?.error ? `${errorBody.error}${issues}` : `Draft assistant failed with ${response.status}`);
  }

  const providerPlan = await response.json();
  if (providerPlan?.schemaVersion === "brokering-route-assistant.v1") {
    if (providerPlan.intent === "inquiry") {
      return {
        operations: [],
        unansweredQuestions: Array.isArray(providerPlan.questions) ? providerPlan.questions.map(String).filter(Boolean) : [],
        summary: String(providerPlan.message || providerPlan.summary || "Answered routing question."),
        intent: "inquiry"
      };
    }

    return {
      ...convertBrokeringRouteDraftToOperations(providerPlan.draft, manifest),
      intent: "edit"
    };
  }

  return {
    ...convertBrokeringRouteDraftToOperations(providerPlan, manifest),
    intent: "edit"
  };
}

export function convertBrokeringRouteDraftToOperations(draft: BrokeringRouteDraft, manifest: PageCapabilityManifest): DraftOperationSet {
  const operations: DraftOperation[] = [];

  addOperation(operations, manifest, "route.statusId", draft.route.statusId, { skipUnchanged: true });
  addOptionSelectionOperations(operations, manifest, draft.route.orderSelection.filters.queues, orderFilterTargets.queues);
  addOptionSelectionOperations(operations, manifest, draft.route.orderSelection.filters.shippingMethods, orderFilterTargets.shippingMethods);
  addOptionSelectionOperations(operations, manifest, draft.route.orderSelection.filters.priorities, orderFilterTargets.priorities);
  addOperation(operations, manifest, "route.orderFilters.PROMISE_DATE", draft.route.orderSelection.filters.promiseDateDays.max, { skipEmpty: true });
  addOperation(operations, manifest, "route.orderFilters.PROMISE_DATE_EXCLUDED", draft.route.orderSelection.filters.promiseDateDays.excludeMax, { skipEmpty: true });
  addOptionSelectionOperations(operations, manifest, draft.route.orderSelection.filters.salesChannels, orderFilterTargets.salesChannels);
  addOptionSelectionOperations(operations, manifest, draft.route.orderSelection.filters.originFacilityGroups, orderFilterTargets.originFacilityGroups);
  draft.route.orderSelection.sorts.forEach((sort) => addOperation(operations, manifest, orderSortTargets[sort.field], true, { skipUnchanged: true }));

  draft.route.inventoryRules.forEach((rule) => addSelectedRuleOperations(operations, manifest, rule));

  return {
    operations,
    unansweredQuestions: [...(draft.questions || [])],
    summary: draft.summary || "Draft updated",
    targetRouting: draft.targetRouting
  };
}

export function createDraftProposal(plan: DraftOperationSet, manifest: PageCapabilityManifest): DraftProposal {
  const validation = validateDraftOperations(plan.operations || [], manifest);
  const unansweredProviderQuestions = plan.intent === "inquiry"
    ? filterAnsweredInquiryQuestions(plan.unansweredQuestions || [], plan.summary || "", manifest)
    : filterAnsweredQuestions(plan.unansweredQuestions || [], validation.operations, manifest);
  return {
    operations: validation.operations,
    unansweredQuestions: [...unansweredProviderQuestions, ...validation.unansweredQuestions],
    summary: summarizeDraftOperations(validation.operations, manifest) || plan.summary || "Draft updated",
    providerSummary: plan.summary || "",
    intent: plan.intent
  };
}

function filterAnsweredQuestions(questions: string[], operations: DraftOperation[], manifest: PageCapabilityManifest) {
  const targetCapabilities = new Map(manifest.editableTargets.map((target) => [target.target, target]));
  return questions.filter((question) => {
    const normalizedQuestion = normalizeQuestionText(question);
    return !operations.some((operation) => {
      const target = targetCapabilities.get(operation.target);
      return target ? questionIsAnsweredByOperation(normalizedQuestion, operation, target) : false;
    });
  });
}

function filterAnsweredInquiryQuestions(questions: string[], answer: string, manifest: PageCapabilityManifest) {
  const normalizedAnswer = normalizeQuestionText(answer);
  const hints = buildInquiryAnswerHints(manifest);

  return questions.filter((question) => {
    const normalizedQuestion = normalizeQuestionText(question);
    if (isOptionalFollowUpQuestion(normalizedQuestion)) {
      return false;
    }

    const categoryHints = inquiryQuestionHints(normalizedQuestion, hints);
    return !categoryHints.some((hint) => normalizedAnswer.includes(hint));
  });
}

function isOptionalFollowUpQuestion(question: string) {
  return [
    "would you like",
    "do you want",
    "should i",
    "can i provide",
    "can i show",
    "would you want",
    "do you need",
    "want me to"
  ].some((phrase) => question.startsWith(phrase));
}

function inquiryQuestionHints(question: string, hints: Record<string, string[]>) {
  const categories = new Set<string>();

  if (question.includes("status") || question.includes("paused") || question.includes("active")) {
    categories.add("status");
  }

  if (question.includes("queue") || question.includes("parking")) {
    categories.add("queues");
  }

  if (question.includes("shipping method") || question.includes("ship method") || question.includes("shipment method")) {
    categories.add("shippingMethods");
  }

  if (question.includes("schedule") || question.includes("cron") || question.includes("execute") || question.includes("time zone") || question.includes("timezone")) {
    categories.add("schedule");
  }

  if (question.includes("filter")) {
    categories.add("orderFilters");
  }

  if (question.includes("sort")) {
    categories.add("orderSorts");
  }

  if (question.includes("rule") || question.includes("allocation") || question.includes("unavailable")) {
    categories.add("inventoryRules");
  }

  return Array.from(categories).flatMap((category) => hints[category] || []);
}

function buildInquiryAnswerHints(manifest: PageCapabilityManifest) {
  const visibleEntities = manifest.visibleEntities as Record<string, any>;
  const brokeringRun = visibleEntities.brokeringRun || {};
  const route = visibleEntities.route || {};
  const hints: Record<string, Set<string>> = {
    status: new Set(),
    queues: new Set(),
    shippingMethods: new Set(),
    schedule: new Set(),
    orderFilters: new Set(),
    orderSorts: new Set(),
    inventoryRules: new Set()
  };

  addInquiryHint(hints.schedule, brokeringRun.schedule?.cronExpression || brokeringRun.schedule?.cron || brokeringRun.schedule?.cronString);
  addInquiryHint(hints.schedule, brokeringRun.schedule?.timeZone || brokeringRun.schedule?.timezone);
  addInquiryHint(hints.schedule, brokeringRun.schedule?.paused);
  if (brokeringRun.schedule?.paused === "Y") {
    addInquiryHint(hints.status, "paused");
  } else if (brokeringRun.schedule?.paused === "N") {
    addInquiryHint(hints.status, "unpaused");
  }

  addInquiryHint(hints.status, route.statusId);
  addInquiryHint(hints.status, humanizeStatus(route.statusId));
  addInquiryHint(hints.orderFilters, route.routingName);

  (route.currentOrderFilters || []).forEach((filter: any) => {
    const target = String(filter.target || "");
    const targetHints = target.includes(".QUEUE")
      ? hints.queues
      : target.includes(".SHIPPING_METHOD")
        ? hints.shippingMethods
        : hints.orderFilters;
    addInquiryHint(targetHints, filter.label);
    addInquiryHint(targetHints, filter.valueLabel);
    addInquiryValueHints(targetHints, filter.value);
  });

  (route.currentOrderSorts || []).forEach((sort: any) => {
    addInquiryHint(hints.orderSorts, sort.label);
    addInquiryHint(hints.orderSorts, sort.target);
  });

  (route.availableInventoryRules || []).forEach((rule: any) => {
    addInquiryHint(hints.inventoryRules, rule.ruleName);
    addInquiryHint(hints.inventoryRules, rule.statusId);
    addInquiryHint(hints.inventoryRules, humanizeStatus(rule.statusId));
    addRuleCurrentValueHints(hints.inventoryRules, rule.currentValues);
  });

  return Object.fromEntries(Object.entries(hints).map(([key, values]) => [key, Array.from(values)]));
}

function addRuleCurrentValueHints(hints: Set<string>, currentValues: any) {
  if (!currentValues) {
    return;
  }

  addInquiryHint(hints, currentValues.assignmentEnumId);
  addInquiryHint(hints, currentValues.partialAllocation ? "partial allocation" : "no partial allocation");
  addInquiryHint(hints, currentValues.partialGroupedItemAllocation ? "grouped item partial allocation" : "no grouped item partial allocation");

  (currentValues.inventoryFilters || []).forEach((filter: any) => {
    addInquiryHint(hints, filter.label);
    addInquiryHint(hints, filter.valueLabel);
    addInquiryValueHints(hints, filter.value);
  });

  (currentValues.inventorySorts || []).forEach((sort: any) => {
    addInquiryHint(hints, sort.label);
    addInquiryHint(hints, sort.target);
  });

  addInquiryHint(hints, currentValues.unavailableItems?.actionLabel);
  addInquiryHint(hints, currentValues.unavailableItems?.queueLabel);
}

function addInquiryValueHints(hints: Set<string>, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach((item) => addInquiryHint(hints, item));
    return;
  }

  addInquiryHint(hints, value);
}

function addInquiryHint(hints: Set<string>, value: unknown) {
  const hint = normalizeQuestionText(String(value || ""));
  if (hint.length >= 2) {
    hints.add(hint);
  }
}

function humanizeStatus(value: unknown) {
  return String(value || "")
    .replace(/^ROUTING_/, "")
    .replace(/^RULE_/, "")
    .replace(/_/g, " ")
    .toLowerCase();
}

function questionIsAnsweredByOperation(question: string, operation: DraftOperation, target: DraftTargetCapability) {
  return answeredQuestionHints(operation, target).some((hint) => question.includes(hint));
}

function answeredQuestionHints(operation: DraftOperation, target: DraftTargetCapability) {
  const hints = new Set<string>();
  const targetLabel = normalizeQuestionText(target.label);
  const targetLabelWithoutUiWords = removeQuestionUiWords(targetLabel);
  const values = Array.isArray(operation.value) ? operation.value : [operation.value];
  const optionsById = new Map((target.options || []).map((option) => [String(option.id), option]));

  [targetLabel, targetLabelWithoutUiWords, ...(target.aliases || [])].forEach((hint) => {
    addQuestionHint(hints, hint);
  });

  values.forEach((value) => {
    if (value === undefined) {
      return;
    }

    const option = optionsById.get(String(value));
    addQuestionHint(hints, String(value));
    addQuestionHint(hints, option?.label);
    (option?.aliases || []).forEach((alias) => addQuestionHint(hints, alias));
  });

  targetSpecificAnsweredQuestionHints(target.target).forEach((hint) => addQuestionHint(hints, hint));

  return Array.from(hints);
}

function addQuestionHint(hints: Set<string>, value?: string) {
  const hint = normalizeQuestionText(value || "");
  if (hint.length >= 4) {
    hints.add(hint);
  }
}

function targetSpecificAnsweredQuestionHints(target: string) {
  if (target === "selectedRule.inventoryFilters.FACILITY_GROUP" || target === "selectedRule.inventoryFilters.FACILITY_GROUP_EXCLUDED") {
    return [
      "inventory facility group",
      "facility group",
      "brokering facility group",
      "inventory location",
      "brokering location"
    ];
  }

  return [];
}

function removeQuestionUiWords(value: string) {
  return value
    .split(" ")
    .filter((word) => !["filter", "sort", "check", "selected", "excluded"].includes(word))
    .join(" ")
    .trim();
}

function normalizeQuestionText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function addSelectedRuleOperations(operations: DraftOperation[], manifest: PageCapabilityManifest, rule: BrokeringRouteDraftRule) {
  const ruleMetadata = {
    ruleKey: rule.ruleKey,
    ruleName: rule.name,
    ruleSequence: rule.sequence
  };
  if (rule.statusId !== "RULE_DRAFT") {
    addOperation(operations, manifest, "selectedRule.statusId", rule.statusId, { skipUnchanged: true, ...ruleMetadata });
  }
  addOptionSelectionOperations(operations, manifest, rule.inventorySelection.filters.facilityGroups, {
    include: "selectedRule.inventoryFilters.FACILITY_GROUP",
    exclude: "selectedRule.inventoryFilters.FACILITY_GROUP_EXCLUDED"
  }, ruleMetadata);
  addOperation(operations, manifest, "selectedRule.inventoryFilters.PROXIMITY", rule.inventorySelection.filters.proximity.maxDistance, { skipEmpty: true, skipUnchanged: true, ...ruleMetadata });
  addOperation(operations, manifest, "selectedRule.inventoryFilters.MEASUREMENT_SYSTEM", rule.inventorySelection.filters.proximity.unit, { skipEmpty: true, skipUnchanged: true, ...ruleMetadata });
  if ((rule.inventorySelection.filters.safetyStock.minimum || 0) > 0) {
    addOperation(operations, manifest, "selectedRule.inventoryFilters.BRK_SAFETY_STOCK", rule.inventorySelection.filters.safetyStock.minimum, { skipEmpty: true, skipUnchanged: true, ...ruleMetadata });
  }
  addFacilityOrderLimitOperation(operations, manifest, rule.inventorySelection.filters.facilityOrderLimit, ruleMetadata);
  addOperation(operations, manifest, "selectedRule.inventoryFilters.SHIP_THRESHOLD", rule.inventorySelection.filters.shipmentThreshold, { skipEmpty: true, skipUnchanged: true, ...ruleMetadata });
  rule.inventorySelection.sorts.forEach((sort) => addOperation(operations, manifest, inventorySortTargets[sort.field], true, { skipUnchanged: true, ...ruleMetadata }));
  if (rule.allocation.partialOrderAllocation) {
    addOperation(operations, manifest, "selectedRule.partialAllocation", true, { skipUnchanged: true, ...ruleMetadata });
  }
  if (rule.allocation.partialGroupedItemAllocation) {
    addOperation(operations, manifest, "selectedRule.partialGroupItemsAllocation", true, { skipUnchanged: true, ...ruleMetadata });
  }
  addUnavailableItemOperations(operations, manifest, rule.unavailableItems, ruleMetadata);
}

function addOptionSelectionOperations(
  operations: DraftOperation[],
  manifest: PageCapabilityManifest,
  selection: OptionSelection,
  targets: { include: string; exclude: string },
  metadata: Pick<OperationCandidateOptions, "ruleKey" | "ruleName" | "ruleSequence"> = {}
) {
  addOperation(operations, manifest, targets.include, selection.include, { skipEmpty: true, skipUnchanged: true, ...metadata });
  addOperation(operations, manifest, targets.exclude, selection.exclude, { skipEmpty: true, skipUnchanged: true, ...metadata });
}

function addFacilityOrderLimitOperation(
  operations: DraftOperation[],
  manifest: PageCapabilityManifest,
  value: "respect" | "bypass" | "unchanged",
  metadata: Pick<OperationCandidateOptions, "ruleKey" | "ruleName" | "ruleSequence"> = {}
) {
  if (value === "unchanged") {
    return;
  }

  addOperation(operations, manifest, "selectedRule.inventoryFilters.FACILITY_ORDER_LIMIT", value === "respect" ? false : true, { skipUnchanged: true, ...metadata });
}

function addUnavailableItemOperations(
  operations: DraftOperation[],
  manifest: PageCapabilityManifest,
  unavailableItems: BrokeringRouteDraftRule["unavailableItems"],
  metadata: Pick<OperationCandidateOptions, "ruleKey" | "ruleName" | "ruleSequence"> = {}
) {
  if (
    unavailableItems.action === "nextRule"
    && unavailableItems.queueId === null
    && unavailableItems.autoCancel.mode === "none"
    && unavailableItems.autoCancel.days === null
  ) {
    return;
  }

  const actionValue = unavailableItems.action === "moveToQueue" ? "ORA_MV_TO_QUEUE" : "ORA_NEXT_RULE";
  addOperation(operations, manifest, "selectedRule.unavailableItemsAction", actionValue, {
    skipUnchanged: true,
    ...metadata
  });

  addOperation(operations, manifest, "selectedRule.unavailableItemsQueueId", unavailableItems.queueId, { skipEmpty: true, skipUnchanged: true, ...metadata });

  if (unavailableItems.autoCancel.mode === "clear") {
    addOperation(operations, manifest, "selectedRule.clearAutoCancelDays", true, { skipUnchanged: true, ...metadata });
  }

  if (unavailableItems.autoCancel.mode === "days") {
    addOperation(operations, manifest, "selectedRule.clearAutoCancelDays", false, { skipUnchanged: true, ...metadata });
    addOperation(operations, manifest, "selectedRule.autoCancelDays", unavailableItems.autoCancel.days, { skipEmpty: true, skipUnchanged: true, ...metadata });
  }
}

function addOperation(
  operations: DraftOperation[],
  manifest: PageCapabilityManifest,
  targetName: string,
  value: DraftValue | null,
  options: OperationCandidateOptions = {}
) {
  if (options.skipEmpty && isEmptyDraftValue(value)) {
    return;
  }

  const target = manifest.editableTargets.find((candidate) => candidate.target === targetName);
  if (!target) {
    return;
  }

  const operationValue = valueForTarget(value as DraftValue, target);
  if (operationValue === undefined) {
    return;
  }

  if (options.skipUnchanged) {
    const currentValue = options.ruleKey
      ? getRuleCurrentValue(manifest, options.ruleKey, targetName)
      : target.currentValue;
    if (currentValue !== undefined && valuesEqual(operationValue, currentValue)) {
      return;
    }
  }

  operations.push({
    op: "set",
    target: targetName,
    value: operationValue,
    ...buildOperationMetadata(options)
  });
}

// For rule-scoped operations, target.currentValue reflects the currently selected
// rule — not necessarily the rule the operation targets. Look up the target's
// current value on the specific rule named by ruleKey so skipUnchanged can drop
// operations that don't actually change anything on that rule. Returns undefined
// for new:* rules (no current state to compare against) and for any target whose
// shape isn't represented in the rule's currentValues snapshot.
function getRuleCurrentValue(manifest: PageCapabilityManifest, ruleKey: string, target: string): DraftValue | undefined {
  if (ruleKey.startsWith("new:")) {
    return undefined;
  }

  const rules = (manifest.visibleEntities as any)?.route?.availableInventoryRules;
  if (!Array.isArray(rules)) {
    return undefined;
  }

  const rule = rules.find((candidate: any) => candidate.routingRuleId === ruleKey);
  if (!rule) {
    return undefined;
  }

  if (target === "selectedRule.statusId") {
    return rule.statusId;
  }

  const currentValues = rule.currentValues || {};

  if (target === "selectedRule.partialAllocation") {
    return Boolean(currentValues.partialAllocation);
  }
  if (target === "selectedRule.partialGroupItemsAllocation") {
    return Boolean(currentValues.partialGroupedItemAllocation);
  }

  const unavailableItems = currentValues.unavailableItems || {};
  if (target === "selectedRule.unavailableItemsAction") {
    return unavailableItems.actionTypeEnumId || undefined;
  }
  if (target === "selectedRule.unavailableItemsQueueId") {
    return unavailableItems.queueId || undefined;
  }
  if (target === "selectedRule.clearAutoCancelDays") {
    return Boolean(unavailableItems.clearAutoCancelDays);
  }
  if (target === "selectedRule.autoCancelDays") {
    return unavailableItems.autoCancelDays ?? undefined;
  }

  if (target.startsWith("selectedRule.inventoryFilters.")) {
    const filter = (currentValues.inventoryFilters || []).find((entry: any) => entry?.target === target);
    return filter ? (filter.value as DraftValue) : undefined;
  }

  if (target.startsWith("selectedRule.inventorySorts.")) {
    const sort = (currentValues.inventorySorts || []).find((entry: any) => entry?.target === target);
    return Boolean(sort);
  }

  return undefined;
}

function buildOperationMetadata(options: OperationCandidateOptions) {
  return {
    ...(options.ruleKey ? { ruleKey: options.ruleKey } : {}),
    ...(options.ruleName ? { ruleName: options.ruleName } : {}),
    ...(options.ruleSequence !== undefined ? { ruleSequence: options.ruleSequence } : {})
  };
}

function valueForTarget(value: DraftValue, target?: DraftTargetCapability): DraftValue | undefined {
  if (!target || !Array.isArray(value) || target.multiple) {
    return value;
  }

  return value[0];
}

function isEmptyDraftValue(value: DraftValue | null) {
  return value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function normalizeConversationHistory(history: DraftConversationMessage[]): DraftConversationMessage[] {
  return history
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").trim()
    }))
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.content)
    .slice(-12);
}

export function validateDraftOperations(operations: DraftOperation[], manifest: PageCapabilityManifest): DraftValidationResult {
  const targetCapabilities = new Map(manifest.editableTargets.map((target) => [target.target, target]));
  const supportedOperations = new Set(manifest.outputContract.operations);
  const currentValues = manifest.editableTargets.reduce((values: Record<string, DraftValue | undefined>, target) => {
    values[target.target] = target.currentValue;
    return values;
  }, {});

  return operations.reduce((result: DraftValidationResult, operation) => {
    if (!operation || !supportedOperations.has(operation.op)) {
      result.unansweredQuestions.push("The draft assistant returned an unsupported operation.");
      return result;
    }

    const target = targetCapabilities.get(operation.target);
    if (!target) {
      result.unansweredQuestions.push(`The target '${operation.target}' is not available on this page.`);
      return result;
    }

    if (!target.editable) {
      result.unansweredQuestions.push(`${target.label} cannot be edited from this page.`);
      return result;
    }

    const disabledReason = getDisabledReason(target, currentValues);
    if (disabledReason) {
      result.unansweredQuestions.push(`${target.label} cannot be changed. ${disabledReason}`);
      return result;
    }

    const valueResult = normalizeValueForTarget(operation.value, target);
    if (valueResult.valid) {
      const normalizedOperation = {
        ...operation,
        op: operation.op,
        target: operation.target,
        value: valueResult.value
      };
      result.operations.push(normalizedOperation);
      currentValues[operation.target] = normalizedOperation.value;
      return result;
    }

    result.unansweredQuestions.push("question" in valueResult ? valueResult.question : `${target.label} has an invalid value.`);
    return result;
  }, { operations: [], unansweredQuestions: [] });
}

export function applyDraftOperations(operations: DraftOperation[], manifest: PageCapabilityManifest, bindings: DraftTargetBindings): DraftApplyResult {
  const validation = validateDraftOperations(operations, manifest);
  const result: DraftApplyResult = {
    appliedCount: 0,
    skipped: [],
    unansweredQuestions: validation.unansweredQuestions
  };

  validation.operations.forEach((operation) => {
    const binding = bindings[operation.target];
    if (!binding) {
      result.skipped.push(`Skipped ${operation.target}; no local draft binding is registered.`);
      return;
    }

    try {
      const applied = binding.setValue(operation.value as DraftValue, operation);
      if (applied === false) {
        result.skipped.push(`Skipped ${operation.target}; the local draft binding rejected it.`);
        return;
      }

      binding.afterApply?.(operation);
      result.appliedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.skipped.push(`Skipped ${operation.target}; ${message}`);
    }
  });

  return result;
}

export function summarizeDraftOperations(operations: DraftOperation[], manifest: PageCapabilityManifest) {
  const validation = validateDraftOperations(operations, manifest);
  const targetCapabilities = new Map(manifest.editableTargets.map((target) => [target.target, target]));

  return validation.operations
    .map((operation) => {
      const target = targetCapabilities.get(operation.target);
      if (!target) {
        return "";
      }

      const valueLabel = summarizeDraftValue(operation.value, target);
      return valueLabel ? `${target.label}: ${valueLabel}` : target.label;
    })
    .filter(Boolean)
    .join("; ");
}

export function formatDraftProposalSections(operations: DraftOperation[], manifest: PageCapabilityManifest) {
  const validation = validateDraftOperations(operations, manifest);
  const targetCapabilities = new Map(manifest.editableTargets.map((target) => [target.target, target]));
  const sections: Array<{ key: string; title: string; lines: string[] }> = [];
  const sectionIndexes = new Map<string, number>();

  validation.operations.forEach((operation) => {
    const target = targetCapabilities.get(operation.target);
    if (!target) {
      return;
    }

    const line = formatDraftOperationLine(operation, target);
    if (!line) {
      return;
    }

    const section = getDraftOperationSection(operation);
    let sectionIndex = sectionIndexes.get(section.key);
    if (sectionIndex === undefined) {
      sectionIndex = sections.length;
      sectionIndexes.set(section.key, sectionIndex);
      sections.push({
        ...section,
        lines: []
      });
    }

    sections[sectionIndex].lines.push(line);
  });

  return sections
    .filter((section) => section.lines.length)
    .map((section) => [section.title, ...section.lines].join("\n"))
    .join("\n\n");
}

function formatDraftOperationLine(operation: DraftOperation, target: DraftTargetCapability) {
  const valueLabel = summarizeDraftValue(operation.value, target);
  return valueLabel ? `- ${target.label}: ${valueLabel}` : `- ${target.label}`;
}

function getDraftOperationSection(operation: DraftOperation) {
  if (operation.target.startsWith("route.orderFilters.")) {
    return {
      key: "route.orderFilters",
      title: "Order filters"
    };
  }

  if (operation.target.startsWith("route.orderSorts.")) {
    return {
      key: "route.orderSorts",
      title: "Order sorting"
    };
  }

  if (operation.target.startsWith("route.")) {
    return {
      key: "route",
      title: "Route settings"
    };
  }

  if (operation.ruleKey) {
    return {
      key: `inventoryRule.${operation.ruleKey}`,
      title: `Inventory rule: ${operation.ruleName || operation.ruleKey}`
    };
  }

  if (operation.target.startsWith("selectedRule.")) {
    return {
      key: "selectedRule",
      title: "Selected inventory rule"
    };
  }

  return {
    key: "other",
    title: "Other changes"
  };
}

function getDisabledReason(target: DraftTargetCapability, currentValues: Record<string, DraftValue | undefined>) {
  if (target.staticDisabled) {
    return target.disabledReason || "The control is currently disabled.";
  }

  const unmetDependency = target.dependencies?.find((dependency) => {
    const currentValue = currentValues[dependency.target];
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

function normalizeValueForTarget(value: DraftValue | undefined, target: DraftTargetCapability): ValueValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, question: `${target.label} needs a value.` };
  }

  if (target.options?.length) {
    return normalizeOptionValue(value, target);
  }

  if (target.valueType === "boolean") {
    const booleanValue = normalizeBoolean(value);
    return booleanValue === undefined
      ? { valid: false, question: `${target.label} needs a true or false value.` }
      : { valid: true, value: booleanValue };
  }

  if (target.valueType === "number") {
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue)
      ? { valid: true, value: numberValue }
      : { valid: false, question: `${target.label} needs a numeric value.` };
  }

  if (target.valueType === "string[]") {
    return { valid: true, value: normalizeStringArray(value) };
  }

  return { valid: true, value: String(value) };
}

function normalizeOptionValue(value: DraftValue, target: DraftTargetCapability): ValueValidationResult {
  const requestedValues = target.multiple ? normalizeStringArray(value) : [String(value)];
  if (!target.multiple && Array.isArray(value) && value.length > 1) {
    return { valid: false, question: `${target.label} only accepts one value.` };
  }

  const normalizedValues: string[] = [];
  for (const requestedValue of requestedValues) {
    const optionResult = findMatchingOption(requestedValue, target);
    if (!optionResult.valid) {
      return optionResult;
    }
    normalizedValues.push(String(optionResult.value));
  }

  if (target.valueType === "boolean") {
    const booleanValue = normalizeBoolean(normalizedValues[0]);
    return booleanValue === undefined
      ? { valid: false, question: `${target.label} needs a true or false value.` }
      : { valid: true, value: booleanValue };
  }

  return {
    valid: true,
    value: target.multiple ? normalizedValues : normalizedValues[0]
  };
}

function findMatchingOption(value: string, target: DraftTargetCapability): ValueValidationResult {
  const normalizedValue = normalizeSearchText(value);
  const exactIdMatch = target.options?.find((option) => option.id === value);
  if (exactIdMatch) {
    if (exactIdMatch.disabled) {
      return { valid: false, question: `${exactIdMatch.label} is disabled. ${exactIdMatch.disabledReason || ""}`.trim() };
    }
    return { valid: true, value: exactIdMatch.id };
  }

  const matchingOptions = (target.options || []).filter((option) => {
    const searchableValues = [option.id, option.label, ...(option.aliases || [])].map(normalizeSearchText);
    return searchableValues.some((candidate) => candidate === normalizedValue);
  });

  if (matchingOptions.length > 1) {
    return { valid: false, question: `${value} is ambiguous for ${target.label}. Choose one: ${formatOptionChoices(matchingOptions)}.` };
  }

  if (matchingOptions.length === 1) {
    const option = matchingOptions[0];
    if (option.disabled) {
      return { valid: false, question: `${option.label} is disabled. ${option.disabledReason || ""}`.trim() };
    }
    return { valid: true, value: option.id };
  }

  return {
    valid: false,
    question: `${value} is not valid for ${target.label}. Choose one of: ${formatValidOptions(target)}.`
  };
}

function formatValidOptions(target: DraftTargetCapability) {
  return formatOptionChoices(target.options || []);
}

function formatOptionChoices(options: DraftOption[], limit = 8) {
  const visibleOptions = options.slice(0, limit).map(formatOptionChoice);
  const hiddenCount = options.length - visibleOptions.length;
  return [
    visibleOptions.join("; "),
    hiddenCount > 0 ? `${hiddenCount} more available` : ""
  ].filter(Boolean).join("; ");
}

function formatOptionChoice(option: DraftOption) {
  return option.label && option.label !== option.id
    ? `${option.label} (${option.id})`
    : option.id;
}

function summarizeDraftValue(value: DraftValue | undefined, target: DraftTargetCapability) {
  if (value === undefined || value === null) {
    return "";
  }

  if (!target.options?.length) {
    return Array.isArray(value) ? value.join(", ") : String(value);
  }

  const values = Array.isArray(value) ? value : [value];
  const optionLabels = values.map((optionId) => {
    const option = target.options?.find((candidate) => String(candidate.id) === String(optionId));
    return option?.label || String(optionId);
  });
  return optionLabels.join(", ");
}

function normalizeStringArray(value: DraftValue) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  if (typeof value === "string" && value.includes(",")) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [String(value)].filter(Boolean);
}

function normalizeBoolean(value: DraftValue) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = normalizeSearchText(String(value));
  if (["true", "yes", "y", "allow", "allowed", "enable", "enabled", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "no", "n", "disallow", "disable", "disabled", "off"].includes(normalizedValue)) {
    return false;
  }

  return undefined;
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function valuesEqual(expected: DraftValue, actual: DraftValue | undefined) {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  return String(expected) === String(actual);
}
