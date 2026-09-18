export type VariationDiffKind = "added" | "removed" | "changed" | "reordered";

export type VariationDiffSectionKind =
  | "routing"
  | "orderFilters"
  | "orderSort"
  | "routingRules"
  | "inventoryFilters"
  | "inventorySort"
  | "actions";

export interface VariationDiffRow {
  key: string;
  label: string;
  kind: VariationDiffKind;
  before?: string;
  after?: string;
}

export interface VariationDiffTarget {
  kind: VariationDiffSectionKind;
  routingKey: string;
  ruleKey?: string;
}

export interface VariationDiffSection {
  id: string;
  routingName: string;
  title: string;
  target: VariationDiffTarget;
  rows: VariationDiffRow[];
}

export interface VariationConfigDiff {
  sections: VariationDiffSection[];
  total: number;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const same = (left: any, right: any) => JSON.stringify(left) === JSON.stringify(right);
const seq = (value: any) => Number(value?.sequenceNum ?? 0);

function stripVariationPrefix(id: any, variationGroupId: any): string {
  const value = String(id || "");
  const prefix = variationGroupId ? `${variationGroupId}_` : "";
  return prefix && value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function entityKey(entity: any, idField: string, variationGroupId: any, nameField: string): string {
  return stripVariationPrefix(entity?.[idField], variationGroupId)
    || `name:${String(entity?.[nameField] || "").toLowerCase()}`;
}

function routingKey(routing: any, group: any): string {
  return entityKey(routing, "orderRoutingId", group?.variationGroupId, "routingName");
}

function ruleKey(rule: any, group: any): string {
  return entityKey(rule, "routingRuleId", group?.variationGroupId, "ruleName");
}

function humanize(value: any): string {
  const text = String(value ?? "").replace(/_excluded$/i, "");
  if (!text) return "None";
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

function displayValue(value: any): string {
  if (value === null || value === undefined || value === "") return "None";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return humanize(value);
}

function conditionKey(condition: any): string {
  return String(condition?.fieldName || "").replace(/_excluded$/i, "");
}

function conditionText(condition: any): string {
  const value = displayValue(condition?.fieldValue);
  const operator = condition?.operator ? `, ${humanize(condition.operator)}` : "";
  return `${value}${operator}`;
}

function actionKey(action: any): string {
  return String(action?.actionTypeEnumId || action?.actionSeqId || "action");
}

function actionText(action: any): string {
  return displayValue(action?.actionValue ?? "Enabled");
}

function pairByKey(
  baselineItems: any[],
  variationItems: any[],
  baselineKey: (item: any) => string,
  variationKey: (item: any) => string
): Array<{ key: string; baseline?: any; variation?: any }> {
  const baselineMap = new Map((baselineItems || []).map((item) => [baselineKey(item), item]));
  const variationMap = new Map((variationItems || []).map((item) => [variationKey(item), item]));
  const keys = new Set([...baselineMap.keys(), ...variationMap.keys()]);
  return [...keys].map((key) => ({ key, baseline: baselineMap.get(key), variation: variationMap.get(key) }));
}

function pairEntities(
  baselineItems: any[],
  variationItems: any[],
  baselineKey: (item: any) => string,
  variationKey: (item: any) => string,
  nameField: string
): Array<{ key: string; baseline?: any; variation?: any }> {
  const remaining = new Set(variationItems || []);
  const pairs: Array<{ key: string; baseline?: any; variation?: any }> = (baselineItems || []).map((baseline) => {
    const baselineIdentity = baselineKey(baseline);
    const baselineName = String(baseline?.[nameField] || "").toLowerCase();
    let variation = [...remaining].find((candidate) => variationKey(candidate) === baselineIdentity);
    let key = baselineIdentity;
    if (!variation && baselineName) {
      variation = [...remaining].find((candidate) => String(candidate?.[nameField] || "").toLowerCase() === baselineName);
      if (variation) key = `name:${baselineName}`;
    }
    if (!variation && baselineItems.length === variationItems.length) {
      variation = [...remaining].find((candidate) => seq(candidate) === seq(baseline));
      if (variation) key = `sequence:${seq(baseline)}`;
    }
    if (variation) remaining.delete(variation);
    return { key, baseline, variation };
  });
  for (const variation of remaining) pairs.push({ key: variationKey(variation), variation });
  return pairs;
}

function collectionRows(
  baselineItems: any[],
  variationItems: any[],
  keyFor: (item: any) => string,
  labelFor: (item: any) => string,
  textFor: (item: any) => string
): VariationDiffRow[] {
  const rows: VariationDiffRow[] = [];
  const baselinePositions = new Map([...baselineItems].sort((left, right) => seq(left) - seq(right)).map((item, index) => [keyFor(item), index + 1]));
  const variationPositions = new Map([...variationItems].sort((left, right) => seq(left) - seq(right)).map((item, index) => [keyFor(item), index + 1]));
  for (const { key, baseline, variation } of pairByKey(baselineItems, variationItems, keyFor, keyFor)) {
    if (!baseline) {
      rows.push({ key, label: labelFor(variation), kind: "added", after: textFor(variation) });
      continue;
    }
    if (!variation) {
      rows.push({ key, label: labelFor(baseline), kind: "removed", before: textFor(baseline) });
      continue;
    }
    if (textFor(baseline) !== textFor(variation)) {
      rows.push({ key, label: labelFor(variation), kind: "changed", before: textFor(baseline), after: textFor(variation) });
      continue;
    }
    if (baselinePositions.get(key) !== variationPositions.get(key)) {
      rows.push({ key, label: labelFor(variation), kind: "reordered", before: String(baselinePositions.get(key)), after: String(variationPositions.get(key)) });
    }
  }
  return rows;
}

function addSection(
  sections: VariationDiffSection[],
  routingName: string,
  title: string,
  target: VariationDiffTarget,
  rows: VariationDiffRow[]
) {
  if (!rows.length) return;
  sections.push({
    id: `${target.routingKey}:${target.ruleKey || "routing"}:${target.kind}`,
    routingName,
    title,
    target,
    rows
  });
}

function filterByType(conditions: any[], type: "ENTCT_FILTER" | "ENTCT_SORT_BY") {
  return (conditions || []).filter((condition) => (condition.conditionTypeEnumId || "ENTCT_FILTER") === type);
}

export function buildVariationConfigDiff(baselineGroup: any, variationGroup: any): VariationConfigDiff {
  if (!baselineGroup || !variationGroup) return { sections: [], total: 0 };
  const sections: VariationDiffSection[] = [];
  const routingPairs = pairEntities(
    baselineGroup.routings || [],
    variationGroup.routings || [],
    (routing) => routingKey(routing, baselineGroup),
    (routing) => routingKey(routing, variationGroup),
    "routingName"
  );

  for (const pair of routingPairs) {
    const baselineRouting = pair.baseline;
    const variationRouting = pair.variation;
    const routingName = variationRouting?.routingName || baselineRouting?.routingName || "Routing";
    const targetBase = { routingKey: pair.key };

    if (!baselineRouting || !variationRouting) {
      addSection(sections, routingName, "Routing", { ...targetBase, kind: "routing" }, [{
        key: pair.key,
        label: routingName,
        kind: baselineRouting ? "removed" : "added",
        ...(baselineRouting ? { before: "Present in baseline" } : { after: "Added to variation" })
      }]);
      continue;
    }

    const routingRows: VariationDiffRow[] = [];
    if (baselineRouting.routingName !== variationRouting.routingName) routingRows.push({
      key: "routingName", label: "Name", kind: "changed",
      before: baselineRouting.routingName, after: variationRouting.routingName
    });
    if (baselineRouting.statusId !== variationRouting.statusId) routingRows.push({
      key: "statusId", label: "Status", kind: "changed",
      before: humanize(baselineRouting.statusId), after: humanize(variationRouting.statusId)
    });
    const baselineRoutingPosition = [...(baselineGroup.routings || [])].sort((left, right) => seq(left) - seq(right)).indexOf(baselineRouting) + 1;
    const variationRoutingPosition = [...(variationGroup.routings || [])].sort((left, right) => seq(left) - seq(right)).indexOf(variationRouting) + 1;
    if (baselineRoutingPosition !== variationRoutingPosition) routingRows.push({
      key: "sequenceNum", label: "Routing order", kind: "reordered",
      before: String(baselineRoutingPosition), after: String(variationRoutingPosition)
    });
    addSection(sections, routingName, "Routing", { ...targetBase, kind: "routing" }, routingRows);

    const conditionLabel = (condition: any) => humanize(condition?.fieldName);
    addSection(sections, routingName, "Order filters", { ...targetBase, kind: "orderFilters" }, collectionRows(
      filterByType(baselineRouting.orderFilters, "ENTCT_FILTER"),
      filterByType(variationRouting.orderFilters, "ENTCT_FILTER"),
      conditionKey, conditionLabel, conditionText
    ));
    addSection(sections, routingName, "Sort", { ...targetBase, kind: "orderSort" }, collectionRows(
      filterByType(baselineRouting.orderFilters, "ENTCT_SORT_BY"),
      filterByType(variationRouting.orderFilters, "ENTCT_SORT_BY"),
      conditionKey, conditionLabel, conditionText
    ));

    const rulePairs = pairEntities(
      baselineRouting.rules || [],
      variationRouting.rules || [],
      (rule) => ruleKey(rule, baselineGroup),
      (rule) => ruleKey(rule, variationGroup),
      "ruleName"
    );
    const ruleRows: VariationDiffRow[] = [];
    for (const rulePair of rulePairs) {
      const baselineRule = rulePair.baseline;
      const variationRule = rulePair.variation;
      const name = variationRule?.ruleName || baselineRule?.ruleName || "Routing rule";
      if (!baselineRule || !variationRule) {
        ruleRows.push({
          key: rulePair.key,
          label: name,
          kind: baselineRule ? "removed" : "added",
          ...(baselineRule ? { before: "Present in baseline" } : { after: "Added to variation" })
        });
        continue;
      }
      const baselineMeta = {
        ruleName: baselineRule.ruleName,
        statusId: baselineRule.statusId,
        assignmentEnumId: baselineRule.assignmentEnumId
      };
      const variationMeta = {
        ruleName: variationRule.ruleName,
        statusId: variationRule.statusId,
        assignmentEnumId: variationRule.assignmentEnumId
      };
      if (!same(baselineMeta, variationMeta)) ruleRows.push({
        key: rulePair.key,
        label: name,
        kind: "changed",
        before: `${baselineRule.ruleName}, ${humanize(baselineRule.statusId)}, ${humanize(baselineRule.assignmentEnumId)}`,
        after: `${variationRule.ruleName}, ${humanize(variationRule.statusId)}, ${humanize(variationRule.assignmentEnumId)}`
      });
      else {
        const baselineRulePosition = [...(baselineRouting.rules || [])].sort((left, right) => seq(left) - seq(right)).indexOf(baselineRule) + 1;
        const variationRulePosition = [...(variationRouting.rules || [])].sort((left, right) => seq(left) - seq(right)).indexOf(variationRule) + 1;
        if (baselineRulePosition !== variationRulePosition) ruleRows.push({
        key: rulePair.key,
        label: name,
        kind: "reordered",
        before: String(baselineRulePosition),
        after: String(variationRulePosition)
        });
      }

      const ruleTarget = { routingKey: pair.key, ruleKey: rulePair.key };
      addSection(sections, routingName, `${name}: Inventory filters`, { ...ruleTarget, kind: "inventoryFilters" }, collectionRows(
        filterByType(baselineRule.inventoryFilters, "ENTCT_FILTER"),
        filterByType(variationRule.inventoryFilters, "ENTCT_FILTER"),
        conditionKey, conditionLabel, conditionText
      ));
      addSection(sections, routingName, `${name}: Inventory sort`, { ...ruleTarget, kind: "inventorySort" }, collectionRows(
        filterByType(baselineRule.inventoryFilters, "ENTCT_SORT_BY"),
        filterByType(variationRule.inventoryFilters, "ENTCT_SORT_BY"),
        conditionKey, conditionLabel, conditionText
      ));
      addSection(sections, routingName, `${name}: Actions`, { ...ruleTarget, kind: "actions" }, collectionRows(
        baselineRule.actions || [],
        variationRule.actions || [],
        actionKey,
        (action) => humanize(action?.actionTypeEnumId),
        actionText
      ));
    }
    addSection(sections, routingName, "Routing rules", { ...targetBase, kind: "routingRules" }, ruleRows);
  }

  return { sections, total: sections.reduce((total, section) => total + section.rows.length, 0) };
}

function matchesEntityKey(entity: any, group: any, key: string, idField: string, nameField: string) {
  if (entityKey(entity, idField, group?.variationGroupId, nameField) === key) return true;
  if (key.startsWith("name:")) return String(entity?.[nameField] || "").toLowerCase() === key.slice(5);
  if (key.startsWith("sequence:")) return seq(entity) === Number(key.slice(9));
  return false;
}

function findRouting(group: any, key: string) {
  return (group?.routings || []).find((routing: any) => matchesEntityKey(routing, group, key, "orderRoutingId", "routingName"));
}

function findRule(routing: any, group: any, key?: string) {
  return (routing?.rules || []).find((rule: any) => key && matchesEntityKey(rule, group, key, "routingRuleId", "ruleName"));
}

function findMatchingRule(routing: any, group: any, sourceRule: any, sourceGroup: any) {
  const sourceIdentity = ruleKey(sourceRule, sourceGroup);
  const sourceName = String(sourceRule?.ruleName || "").toLowerCase();
  return (routing?.rules || []).find((rule: any) =>
    ruleKey(rule, group) === sourceIdentity
    || (sourceName && String(rule?.ruleName || "").toLowerCase() === sourceName)
    || seq(rule) === seq(sourceRule));
}

function replaceConditionType(current: any[], baseline: any[], type: "ENTCT_FILTER" | "ENTCT_SORT_BY") {
  const retained = (current || []).filter((condition) => (condition.conditionTypeEnumId || "ENTCT_FILTER") !== type);
  return [...retained, ...clone(filterByType(baseline, type))].sort((left, right) => seq(left) - seq(right));
}

export function restoreVariationSection(workingGroup: any, baselineGroup: any, target: VariationDiffTarget): any {
  const next = clone(workingGroup);
  const baselineRouting = findRouting(baselineGroup, target.routingKey);
  let workingRouting = findRouting(next, target.routingKey);

  if (target.kind === "routing") {
    if (!baselineRouting) next.routings = (next.routings || []).filter((routing: any) => !matchesEntityKey(routing, next, target.routingKey, "orderRoutingId", "routingName"));
    else if (!workingRouting) next.routings = [...(next.routings || []), clone(baselineRouting)].sort((left, right) => seq(left) - seq(right));
    else Object.assign(workingRouting, {
      routingName: baselineRouting.routingName,
      statusId: baselineRouting.statusId,
      sequenceNum: baselineRouting.sequenceNum
    });
    return next;
  }
  if (!baselineRouting || !workingRouting) return next;

  if (target.kind === "orderFilters") {
    workingRouting.orderFilters = replaceConditionType(workingRouting.orderFilters, baselineRouting.orderFilters, "ENTCT_FILTER");
    return next;
  }
  if (target.kind === "orderSort") {
    workingRouting.orderFilters = replaceConditionType(workingRouting.orderFilters, baselineRouting.orderFilters, "ENTCT_SORT_BY");
    return next;
  }
  if (target.kind === "routingRules") {
    workingRouting.rules = (baselineRouting.rules || []).map((baselineRule: any) => {
      const existing = findMatchingRule(workingRouting, next, baselineRule, baselineGroup);
      return existing ? {
        ...existing,
        ruleName: baselineRule.ruleName,
        statusId: baselineRule.statusId,
        sequenceNum: baselineRule.sequenceNum,
        assignmentEnumId: baselineRule.assignmentEnumId
      } : clone(baselineRule);
    });
    return next;
  }

  const baselineRule = findRule(baselineRouting, baselineGroup, target.ruleKey);
  const workingRule = findRule(workingRouting, next, target.ruleKey);
  if (!baselineRule || !workingRule) return next;
  if (target.kind === "inventoryFilters") workingRule.inventoryFilters = replaceConditionType(workingRule.inventoryFilters, baselineRule.inventoryFilters, "ENTCT_FILTER");
  if (target.kind === "inventorySort") workingRule.inventoryFilters = replaceConditionType(workingRule.inventoryFilters, baselineRule.inventoryFilters, "ENTCT_SORT_BY");
  if (target.kind === "actions") workingRule.actions = clone(baselineRule.actions || []);
  return next;
}

export function restoreVariationToBaseline(workingGroup: any, baselineGroup: any): any {
  return {
    ...clone(baselineGroup),
    variationGroupId: workingGroup?.variationGroupId
  };
}
