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
  lastUpdatedStamp: string
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

export {
  Enumeration,
  EnumerationAndType,
  Group,
  Route,
  Rule
}