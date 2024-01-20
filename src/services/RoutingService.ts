import api from "@/api"
import logger from "@/logger";
import { hasError, showToast } from "@/utils";

const fetchRoutingGroups = async (payload: any): Promise<any> => {
  return api({
    url: "groups", 
    method: "GET",
    query: payload
  });
}

const fetchRoutingGroup = async (routingGroupId: string): Promise<any> => {
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

const fetchOrderRoutings = async (payload: any): Promise<any> => {
  return api({
    url: `groups/${payload.routingGroupId}/routings`,
    method: "GET",
    query: payload
  });
}

const fetchOrderRouting = async (orderRoutingId: string): Promise<any> => {
  return api({
    url: `routings/${orderRoutingId}`,
    method: "GET"
  })
}

const updateOrderRouting = async (payload: any): Promise<any> => {
  return api({
    url: `routings/${payload.orderRoutingId}`,
    method: "POST",
    data: payload
  })
}

const createRoutingRule = async (payload: any): Promise<any> => {
  let routingRuleId = '';
  try {
    const resp = await api({
      url: "rules",
      method: "POST",
      data: payload
    })

    if(!hasError(resp) && resp?.data.routingRuleId) {
      routingRuleId = resp.data.routingRuleId
    }
  } catch(err) {
    showToast("Failed to create new rule")
    logger.error(err)
  }

  return routingRuleId
}

const createOrderRouting = async (payload: any): Promise<any> => {
  return await api({
    url: "routings",
    method: "POST",
    data: payload
  })
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
    url: `rules/${payload.routingRuleId}/actions`,
    method: "GET",
    query: payload
  });
}

export const OrderRoutingService = {
  createOrderRouting,
  createRoutingGroup,
  createRoutingRule,
  fetchOrderRouting,
  fetchOrderRoutings,
  fetchRoutingFilters,
  fetchRoutingGroup,
  fetchRoutingGroups,
  fetchRoutingRules,
  fetchRuleActions,
  fetchRuleConditions,
  updateOrderRouting,
  updateRoutingGroup
}