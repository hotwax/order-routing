import api from "@/api"

const fetchRoutingGroups = async (payload: any): Promise<any> => {
  return api({
    url: "groups", 
    method: "GET",
    query: payload
  });
}

const fetchRoutingGroupInformation = async (routingGroupId: string): Promise<any> => {
  return api({
    url: `groups/${routingGroupId}`,
    method: "GET"
  });
}

const createRoutingGroup = async (payload: any): Promise<any> => {
  return api({
    url: "groups",
    method: "POST",
    data: payload
  })
}

const updateRoutingGroup = async (payload: any): Promise<any> => {
  return api({
    url: `groups/${payload.routingGroupId}`,
    method: "POST",
    data: payload
  })
}

const fetchOrderRouting = async (orderRoutingId: string): Promise<any> => {
  return api({
    url: `routings/${orderRoutingId}`,
    method: "GET"
  })
}

const createRoutingRule = async (payload: any): Promise<any> => {
  return await api({
    url: "rules",
    method: "POST",
    data: payload
  })
}

const createOrderRouting = async (payload: any): Promise<any> => {
  return await api({
    url: "routings",
    method: "POST",
    data: payload
  })
}

const updateRouting = async (payload: any): Promise<any> => {
  return api({
    url: `routings/${payload.orderRoutingId}`,
    method: "POST",
    data: payload
  });
}

const deleteRoutingFilter = async (payload: any): Promise<any> => {
  return api({
    url: `routings/${payload.orderRoutingId}/orderFilters`,
    method: "DELETE",
    data: payload
  });
}

const deleteRuleCondition = async (payload: any): Promise<any> => {
  return api({
    url: `rules/${payload.routingRuleId}/inventoryFilters`,
    method: "DELETE",
    data: payload
  });
}

const deleteRuleAction = async (payload: any): Promise<any> => {
  return api({
    url: `rules/${payload.routingRuleId}/actions`,
    method: "DELETE",
    data: payload
  });
}

const fetchRule = async (routingRuleId: string): Promise<any> => {
  return api({
    url: `rules/${routingRuleId}`,
    method: "GET"
  });
}

const updateRule = async (payload: any): Promise<any> => {
  return api({
    url: `rules/${payload.routingRuleId}`,
    method: "POST",
    data: payload
  });
}

const scheduleBrokering = async (payload: any): Promise<any> => {
  return api({
    url: `groups/${payload.routingGroupId}/schedule`,
    method: "POST",
    data: payload
  });
}

export const OrderRoutingService = {
  createOrderRouting,
  createRoutingGroup,
  createRoutingRule,
  deleteRoutingFilter,
  deleteRuleAction,
  deleteRuleCondition,
  fetchOrderRouting,
  fetchRoutingGroupInformation,
  fetchRoutingGroups,
  fetchRule,
  scheduleBrokering,
  updateRouting,
  updateRoutingGroup,
  updateRule
}