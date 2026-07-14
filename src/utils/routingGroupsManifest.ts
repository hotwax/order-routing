import type { PageCapabilityManifest } from "@/types/draft";

type EnumInfo = { id: string; code: string };
type ConditionRow = {
  conditionSeqId?: string;
  conditionTypeEnumId?: string;
  fieldName?: string;
  fieldValue?: string | number | boolean | null;
  operator?: string;
  sequenceNum?: number;
  [key: string]: unknown;
};
type ActionRow = {
  actionSeqId?: string;
  actionTypeEnumId?: string;
  actionValue?: string | number | boolean | null;
  [key: string]: unknown;
};
type RuleNode = {
  routingRuleId?: string;
  ruleName?: string;
  statusId?: string;
  sequenceNum?: number;
  assignmentEnumId?: string;
  inventoryFilters?: ConditionRow[];
  actions?: ActionRow[];
  [key: string]: unknown;
};
type RoutingNode = {
  orderRoutingId?: string;
  routingName?: string;
  statusId?: string;
  sequenceNum?: number;
  orderFilters?: ConditionRow[];
  rules?: RuleNode[];
  [key: string]: unknown;
};
type ScheduleNode = {
  cronExpression?: string;
  cronDescription?: string;
  nextExecutionDateTime?: number;
  paused?: string;
  timeZone?: string;
  jobName?: string;
  [key: string]: unknown;
} | null | undefined;
type GroupNode = {
  routingGroupId: string;
  groupName?: string;
  description?: string;
  productStoreId?: string;
  createdDate?: number | string;
  lastUpdatedStamp?: number | string;
  schedule?: ScheduleNode;
  routings?: RoutingNode[];
  [key: string]: unknown;
};

type ReferenceData = {
  facilities: Record<string, any>;
  shippingMethods: Record<string, any>;
  salesChannels: Record<string, any>;
  facilityGroups: Record<string, any>;
};

export type RunsListManifestInput = {
  pageRoute: string;
  productStoreId: string;
  groups: GroupNode[];
  ruleEnums: Record<string, EnumInfo>;
  conditionFilterEnums: Record<string, EnumInfo>;
  conditionSortEnums: Record<string, EnumInfo>;
  actionEnums: Record<string, EnumInfo>;
  referenceData: ReferenceData;
  cronExpressions?: Record<string, string>;
};

// Inquiry-only manifest. No editableTargets are populated — the page is read-only
// for the assistant, and the validator schema still requires the field, so we
// pass an empty array plus a minimal output contract describing the response shape.
export function buildRoutingGroupsListManifest(input: RunsListManifestInput): PageCapabilityManifest {
  const codeToKey = {
    orderFilter: invertEnums(input.ruleEnums),
    inventoryFilter: invertEnums(input.conditionFilterEnums),
    inventorySort: invertEnums(input.conditionSortEnums),
    action: invertEnums(input.actionEnums)
  };

  const brokeringRuns = (input.groups || [])
    .filter((group) => group && group.routingGroupId)
    .map((group) => summarizeGroup(group, codeToKey, input));

  return {
    pageId: "order-routing.brokering-runs",
    route: input.pageRoute,
    visibleEntities: {
      productStoreId: input.productStoreId,
      brokeringRuns,
      counts: {
        totalRuns: brokeringRuns.length,
        activeRuns: brokeringRuns.filter((run: any) => run.schedule?.paused === "N").length,
        draftRuns: brokeringRuns.filter((run: any) => run.schedule?.paused !== "N").length
      },
      note: "These are all routing groups visible on the Routing groups list page for the current product store. Read-only inquiry context — do not propose edits."
    },
    editableTargets: [],
    outputContract: {
      responseShape: {
        answer: "concise natural-language answer to the user's question",
        questions: "array of follow-up questions only when manifest data is missing or ambiguous",
        summary: "short user-facing summary"
      }
    }
  };
}

function summarizeGroup(group: GroupNode, codeToKey: Record<string, Record<string, string>>, input: RunsListManifestInput) {
  const schedule = group.schedule || null;
  const cronExpression = schedule?.cronExpression || "";
  const cronExpressions = input.cronExpressions || {};
  return {
    routingGroupId: group.routingGroupId,
    groupName: group.groupName || "",
    description: group.description || "",
    productStoreId: group.productStoreId || input.productStoreId || "",
    createdDate: group.createdDate ?? null,
    lastUpdatedStamp: group.lastUpdatedStamp ?? null,
    schedule: schedule ? {
      cronExpression,
      cronDescription: schedule.cronDescription
        || Object.keys(cronExpressions).find((key) => cronExpressions[key] === cronExpression)
        || "",
      nextExecutionDateTime: schedule.nextExecutionDateTime ?? null,
      paused: schedule.paused || "Y",
      timeZone: schedule.timeZone || "",
      jobName: schedule.jobName || ""
    } : null,
    routings: (group.routings || [])
      .slice()
      .sort((left, right) => Number(left.sequenceNum ?? 0) - Number(right.sequenceNum ?? 0))
      .map((routing) => summarizeRouting(routing, codeToKey, input))
  };
}

function summarizeRouting(routing: RoutingNode, codeToKey: Record<string, Record<string, string>>, input: RunsListManifestInput) {
  const orderFilters = (routing.orderFilters || []).filter((row) => row.conditionTypeEnumId === "ENTCT_FILTER" || !row.conditionTypeEnumId);
  const orderSorts = (routing.orderFilters || []).filter((row) => row.conditionTypeEnumId === "ENTCT_SORT_BY");

  return {
    orderRoutingId: routing.orderRoutingId || "",
    routingName: routing.routingName || "",
    statusId: routing.statusId || "",
    sequenceNum: routing.sequenceNum ?? null,
    orderFilters: orderFilters.map((row) => summarizeCondition(row, codeToKey.orderFilter, "orderFilter", input)),
    orderSorts: orderSorts.map((row) => summarizeSort(row, codeToKey.orderFilter)),
    inventoryRules: (routing.rules || [])
      .slice()
      .sort((left, right) => Number(left.sequenceNum ?? 0) - Number(right.sequenceNum ?? 0))
      .map((rule) => summarizeRule(rule, codeToKey, input))
  };
}

function summarizeRule(rule: RuleNode, codeToKey: Record<string, Record<string, string>>, input: RunsListManifestInput) {
  const inventoryFilters = (rule.inventoryFilters || []).filter((row) => row.conditionTypeEnumId === "ENTCT_FILTER" || !row.conditionTypeEnumId);
  const inventorySorts = (rule.inventoryFilters || []).filter((row) => row.conditionTypeEnumId === "ENTCT_SORT_BY");
  const actions = rule.actions || [];
  const splitGroupRow = inventoryFilters.find((row) => row.fieldName === input.conditionFilterEnums.SPLIT_ITEM_GROUP?.code);
  const partialAllocation = rule.assignmentEnumId === "ORA_MULTI";

  return {
    routingRuleId: rule.routingRuleId || "",
    ruleName: rule.ruleName || "",
    statusId: rule.statusId || "",
    sequenceNum: rule.sequenceNum ?? null,
    assignmentEnumId: rule.assignmentEnumId || "",
    partialAllocation,
    partialGroupedItemAllocation: splitGroupRow?.fieldValue === "Y",
    inventoryFilters: inventoryFilters
      .filter((row) => row.fieldName !== input.conditionFilterEnums.SPLIT_ITEM_GROUP?.code)
      .map((row) => summarizeCondition(row, codeToKey.inventoryFilter, "inventoryFilter", input)),
    inventorySorts: inventorySorts.map((row) => summarizeSort(row, codeToKey.inventorySort)),
    unavailableItems: summarizeUnavailableItems(actions, codeToKey.action, input)
  };
}

function summarizeCondition(
  row: ConditionRow,
  codeToKey: Record<string, string>,
  kind: "orderFilter" | "inventoryFilter",
  input: RunsListManifestInput
) {
  const key = codeToKey[String(row.fieldName || "")] || "";
  const value = row.fieldValue;
  const arrayValue = typeof value === "string" && value.includes(",") ? value.split(",").filter(Boolean) : null;
  return {
    key,
    fieldName: row.fieldName || "",
    operator: row.operator || "",
    value: arrayValue ?? (value ?? null),
    valueLabel: humanizeConditionValue(arrayValue ?? value ?? null, key, kind, input)
  };
}

function summarizeSort(row: ConditionRow, codeToKey: Record<string, string>) {
  const key = codeToKey[String(row.fieldName || "")] || "";
  return {
    key,
    fieldName: row.fieldName || "",
    sequenceNum: row.sequenceNum ?? null
  };
}

function summarizeUnavailableItems(actions: ActionRow[], codeToKey: Record<string, string>, input: RunsListManifestInput) {
  const actionByType: Record<string, ActionRow> = {};
  actions.forEach((row) => {
    if (row.actionTypeEnumId) {
      actionByType[String(row.actionTypeEnumId)] = row;
    }
  });

  const nextRuleId = input.actionEnums.NEXT_RULE?.id;
  const moveToQueueId = input.actionEnums.MOVE_TO_QUEUE?.id;
  const clearAutoCancelId = input.actionEnums.RM_AUTO_CANCEL_DATE?.id;
  const autoCancelDaysId = input.actionEnums.AUTO_CANCEL_DAYS?.id;

  const moveToQueueRow = moveToQueueId ? actionByType[moveToQueueId] : undefined;
  const nextRuleRow = nextRuleId ? actionByType[nextRuleId] : undefined;
  const clearAutoCancelValue = clearAutoCancelId ? actionByType[clearAutoCancelId]?.actionValue : undefined;
  const autoCancelDaysValue = autoCancelDaysId ? actionByType[autoCancelDaysId]?.actionValue : undefined;

  let action: "moveToQueue" | "nextRule" | "" = "";
  let queueId = "";
  if (moveToQueueRow) {
    action = "moveToQueue";
    queueId = String(moveToQueueRow.actionValue || "");
  } else if (nextRuleRow) {
    action = "nextRule";
  }

  const queueLabel = queueId && input.referenceData.facilities[queueId]
    ? input.referenceData.facilities[queueId]?.facilityName || queueId
    : queueId;

  return {
    action,
    actionLabel: action === "moveToQueue" ? "Queue" : action === "nextRule" ? "Next rule" : "",
    queueId,
    queueLabel,
    clearAutoCancelDays: clearAutoCancelValue === undefined || clearAutoCancelValue === null || clearAutoCancelValue === ""
      ? false
      : String(clearAutoCancelValue).toLowerCase() === "true",
    autoCancelDays: autoCancelDaysValue === undefined || autoCancelDaysValue === null || autoCancelDaysValue === ""
      ? null
      : Number(autoCancelDaysValue)
  };
}

function humanizeConditionValue(
  value: string | number | boolean | string[] | null | undefined,
  key: string,
  kind: "orderFilter" | "inventoryFilter",
  input: RunsListManifestInput
) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (kind === "orderFilter") {
    if (key === "QUEUE" || key === "QUEUE_EXCLUDED") {
      return joinLabels(value, input.referenceData.facilities, "facilityName");
    }
    if (key === "SHIPPING_METHOD" || key === "SHIPPING_METHOD_EXCLUDED") {
      return joinLabels(value, input.referenceData.shippingMethods, "description");
    }
    if (key === "SALES_CHANNEL" || key === "SALES_CHANNEL_EXCLUDED") {
      return joinLabels(value, input.referenceData.salesChannels, "description", "enumName");
    }
    if (key === "ORIGIN_FACILITY_GROUP" || key === "ORIGIN_FACILITY_GROUP_EXCLUDED") {
      return joinLabels(value, input.referenceData.facilityGroups, "facilityGroupName");
    }
  }

  if (kind === "inventoryFilter") {
    if (key === "FACILITY_GROUP" || key === "FACILITY_GROUP_EXCLUDED") {
      return joinLabels(value, input.referenceData.facilityGroups, "facilityGroupName");
    }
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function joinLabels(value: string | number | boolean | string[], source: Record<string, any>, ...labelFields: string[]) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item) => {
      const record = source?.[String(item)];
      const label = labelFields.map((field) => record?.[field]).find(Boolean);
      return label || String(item);
    })
    .join(", ");
}

function invertEnums(enums: Record<string, EnumInfo>): Record<string, string> {
  return Object.entries(enums || {}).reduce((result: Record<string, string>, [key, info]) => {
    if (info?.code) {
      result[info.code] = key;
    }
    return result;
  }, {});
}
