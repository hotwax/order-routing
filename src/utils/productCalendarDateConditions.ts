export const PRODUCT_STORE_PRODUCT_DATE_CONDITION_TYPES = {
  SINCE: "ENTCT_PSP_DATE_SINCE",
  TILL: "ENTCT_PSP_DATE_TILL"
} as const;

export const PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS = [
  { value: PRODUCT_STORE_PRODUCT_DATE_CONDITION_TYPES.SINCE, label: "Days since" },
  { value: PRODUCT_STORE_PRODUCT_DATE_CONDITION_TYPES.TILL, label: "Days till" }
] as const;

export const PRODUCT_STORE_PRODUCT_DATE_OPERATORS = [
  { value: "less-than", label: "Is less than", symbol: "<" },
  { value: "less-than-equal-to", label: "Is less than or equal to", symbol: "≤" },
  { value: "greater-than", label: "Is greater than", symbol: ">" },
  { value: "greater-than-equal-to", label: "Is greater than or equal to", symbol: "≥" },
  { value: "equals", label: "Equals", symbol: "=" }
] as const;

export function isProductStoreProductDateCondition(condition: any) {
  return PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS.some(({ value }) => value === condition?.conditionTypeEnumId);
}

export function productStoreProductDateConditionKey(condition: any) {
  return `${condition?.conditionTypeEnumId || ""}:${condition?.fieldName || ""}`;
}

export function productStoreProductDateConditionLabel(condition: any) {
  const direction = PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS.find(({ value }) => value === condition?.conditionTypeEnumId)?.label || "Date";
  const operator = PRODUCT_STORE_PRODUCT_DATE_OPERATORS.find(({ value }) => value === condition?.operator)?.symbol || condition?.operator || "";
  return `${direction} ${operator}`.trim();
}
