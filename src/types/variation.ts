// src/types/variation.ts
// Shapes for saved what-if variations in the open Sim Routing datastore.

/** A scope filter (on a routing) or an inventory condition (on a rule). operator/fieldValue are null
 *  for an unset placeholder row the engine ignores. */
export interface VariationCondition {
  conditionSeqId: string;
  fieldName: string | null;
  operator: string | null;
  fieldValue: string | null;
  sequenceNum: number;
  conditionTypeEnumId?: string; // ENTCT_FILTER (default) | ENTCT_SORT_BY
}

/** A rule action — what the rule does (ORA_NEXT_RULE, ORA_MV_TO_QUEUE, ORA_AUTO_CANCEL_DAYS, ...). */
export interface VariationAction {
  actionSeqId: string;
  actionTypeEnumId: string;
  actionValue: string | null;
}

export interface VariationRule {
  routingRuleId: string;
  ruleName: string;
  statusId: string; // RULE_ACTIVE | RULE_DRAFT | RULE_ARCHIVED
  sequenceNum: number;
  assignmentEnumId?: string;
  inventoryConditions: VariationCondition[];
  actions: VariationAction[];
}

export interface VariationRouting {
  orderRoutingId: string; // re-keyed, e.g. VM100204_100008
  routingName: string;
  statusId: string; // ROUTING_ACTIVE | ROUTING_DRAFT | ROUTING_ARCHIVED
  sequenceNum: number;
  filters: VariationCondition[];
  rules: VariationRule[];
}

export interface VariationTree {
  variationGroupId: string;
  parentRoutingGroupId: string;
  productStoreId: string;
  variationName: string;
  statusId: string; // VAR_DRAFT ...
  routings: VariationRouting[];
}

export interface VariationListItem {
  variationGroupId: string;
  parentRoutingGroupId: string;
  productStoreId: string;
  variationName: string;
  statusId: string;
  createdDate: number;
  createdByUserId?: string;
}
