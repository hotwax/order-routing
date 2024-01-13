type Enumeration = {
  enumId: string,
  enumTypeId: string,
  enumCode: string,
  sequenceId: string,
  description: string,
  enumName: string,
  sequenceNum: string
}

type Group = {
  routingGroupId: string,
  productStoreId: string,
  groupName: string,
  sequenceNum: string,
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
  sequenceNum: string,
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
  sequenceNum: string,
  assignmentEnumId: string,
  fulfillEntireShipGroup: string,
  createdDate: string,
  createdByUser: string,
  lastUpdatedStamp: string
}

export {
  Enumeration,
  Group,
  Route,
  Rule
}