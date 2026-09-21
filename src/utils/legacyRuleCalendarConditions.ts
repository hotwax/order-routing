import { isProductStoreProductDateCondition } from "@/utils/productCalendarDateConditions";

type RuleCondition = Record<string, any>;

function sameConditionDefinition(first: RuleCondition, second: RuleCondition) {
  return first.conditionTypeEnumId === second.conditionTypeEnumId
    && first.fieldName === second.fieldName
    && first.operator === second.operator;
}

function sameCalendarCondition(first: RuleCondition, second: RuleCondition) {
  return first.conditionTypeEnumId === second.conditionTypeEnumId
    && first.fieldName === second.fieldName;
}

function conditionWithIdentity(
  condition: RuleCondition,
  existingCondition: RuleCondition | undefined,
  ruleId: string,
) {
  return {
    ...condition,
    ruleId,
    ...(condition.conditionSeqId || !existingCondition?.conditionSeqId
      ? {}
      : { conditionSeqId: existingCondition.conditionSeqId }),
  };
}

export function getProductStoreProductDateConditions(ruleConditions: RuleCondition[] = []) {
  return ruleConditions.filter(isProductStoreProductDateCondition);
}

export function buildLegacyRuleConditions({
  ruleId,
  generatedConditions,
  calendarConditions,
  currentConditions,
}: {
  ruleId: string;
  generatedConditions: RuleCondition[];
  calendarConditions: RuleCondition[];
  currentConditions: RuleCondition[];
}) {
  const generatedWithExistingIdentity = generatedConditions.map((condition) => conditionWithIdentity(
    condition,
    currentConditions.find((currentCondition) => sameConditionDefinition(currentCondition, condition)),
    ruleId,
  ));

  const calendarWithExistingIdentity = calendarConditions.map((condition) => conditionWithIdentity(
    condition,
    currentConditions.find((currentCondition) => (
      isProductStoreProductDateCondition(currentCondition)
      && sameCalendarCondition(currentCondition, condition)
    )),
    ruleId,
  ));

  return [...generatedWithExistingIdentity, ...calendarWithExistingIdentity];
}

export function getRuleConditionsToRemove(
  currentConditions: RuleCondition[],
  updatedConditions: RuleCondition[],
) {
  return currentConditions.filter((condition) => !updatedConditions.some((updatedCondition) => {
    if (condition.conditionSeqId && updatedCondition.conditionSeqId) {
      return condition.conditionSeqId === updatedCondition.conditionSeqId;
    }
    return sameConditionDefinition(condition, updatedCondition);
  }));
}
