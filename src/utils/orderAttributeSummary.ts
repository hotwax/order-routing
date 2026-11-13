import type { OrderAttributeCondition } from '@/store/orderAttributeConditions';

export const ATTRIBUTE_OPERATOR_LABELS: Record<OrderAttributeCondition['operator'], string> = {
  is: 'is one of',
  isNot: 'is not one of',
  exists: 'exists',
  missing: 'is missing'
};

export function conditionNeedsValues(operator: OrderAttributeCondition['operator']) {
  return operator === 'is' || operator === 'isNot';
}

export function isConditionComplete(condition: OrderAttributeCondition) {
  if (!condition.name.trim()) return false;
  if (!conditionNeedsValues(condition.operator)) return true;
  return condition.values.split(',').some(value => value.trim());
}

/** One readable line per condition, for the compact card on the canvas. */
export function summarizeCondition(condition: OrderAttributeCondition) {
  const name = condition.name.trim();
  const operator = ATTRIBUTE_OPERATOR_LABELS[condition.operator];
  if (!name) return '';
  if (!conditionNeedsValues(condition.operator)) return `${name} ${operator}`;
  const values = condition.values.split(',').map(value => value.trim()).filter(Boolean).join(', ');
  return values ? `${name} ${operator} ${values}` : `${name} ${operator} …`;
}
