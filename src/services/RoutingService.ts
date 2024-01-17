import api from "@/api"

const fetchRoutingGroups = async (payload: any): Promise<any> => {
  return api({
    url: "groups", 
    method: "GET",
    query: payload
  });
}

const createRoutingGroup = async (payload: any): Promise<any> => {
  return api({
    url: "groups",
    method: "POST",
    data: payload
  })
}

const fetchOrderRoutings = async (payload: any): Promise<any> => {
  return api({
    url: `groups/${payload.routingGroupId}/routings`,
    method: "GET",
    query: payload
  });
}

const fetchRoutingRules = async (payload: any): Promise<any> => {
  return api({
    url: `routings/${payload.orderRoutingId}/rules`,
    method: "GET",
    query: payload
  });
}

const fetchRoutingFilters = async (payload: any): Promise<any> => {
  return api({
    url: `routings/${payload.orderRoutingId}/filter-conditions`,
    method: "GET",
    query: payload
  });
}

const fetchRuleConditions = async (payload: any): Promise<any> => {
  return api({
    url: `rules/${payload.routingRuleId}/condition`,
    method: "GET",
    query: payload
  });
}

const fetchRuleActions = async (payload: any): Promise<any> => {
  return api({
    url: `rules/${payload.orderRoutingId}/actions`,
    method: "GET",
    query: payload
  });
}

export const OrderRoutingService = {
  createRoutingGroup,
  fetchOrderRoutings,
  fetchRoutingFilters,
  fetchRoutingGroups,
  fetchRoutingRules,
  fetchRuleActions,
  fetchRuleConditions
}