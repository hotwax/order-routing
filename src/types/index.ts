type Enumeration = {
  enumId: string,
  enumTypeId: string,
  enumCode: string,
  sequenceId: string,
  description: string,
  enumName: string,
  sequenceNum: number
}

type EnumerationAndType = Enumeration & {
  typeDescription: string,
  parentTypeId: string,
  hasTable: string
}

type Group = {
  routingGroupId: string,
  productStoreId: string,
  groupName: string,
  sequenceNum: number,
  description: string,
  createdByUser: string,
  createdDate: string,
  lastUpdatedStamp: string,
}

type Route = {
  orderRoutingId: string,
  routingGroupId: string,
  statusId: string,
  routingName: string,
  sequenceNum: number,
  description: string,
  createdByUser: string,
  createdDate: string,
  lastUpdatedStamp: string,
  [key: string]: string | number
}

type Rule = {
  routingRuleId: string,
  orderRoutingId: string,
  ruleName: string,
  statusId: string,
  sequenceNum: number,
  assignmentEnumId: string,
  fulfillEntireShipGroup: string,
  createdDate: string,
  createdByUser: string,
  lastUpdatedStamp: string
}

type RouteFilter = {
  orderRoutingId: string,
  conditionSeqId: string,
  conditionTypeEnumId: string,
  fieldName: string,
  operator: string,
  fieldValue: string,
  sequenceNum: number,
  createdDate: string,
  lastUpdatedStamp: string
}

/** Function type for making routing API requests. Accepts the same axios-style config as api()/simApi().
 *  OMS path passes api(); the simulate path passes simApi() so the two backends never share a request path. */
export type RoutingRequest = (config: any) => Promise<any>;

export {
  Enumeration,
  EnumerationAndType,
  Group,
  Route,
  RouteFilter,
  Rule
}