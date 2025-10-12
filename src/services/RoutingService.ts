import { api } from '@/adapter'


const fetchRoutingGroups = async (payload: any): Promise<any> => {
  return api({
    url: "service/getOrderRoutingGroups", 
    method: "POST",
    data: payload
  });
}

const fetchRoutingGroupInformation = async (routingGroupId: string): Promise<any> => {
  return api({
    url: `service/getOrderRoutingGroup`,
    method: "POST",
    data: { routingGroupId }
  });
}

const fetchRoutingScheduleInformation = async (routingGroupId: string): Promise<any> => {
  return api({
    url: `groups/${routingGroupId}/schedule`,
    method: "GET"
  });
}

const fetchRoutingHistory = async (payload: any): Promise<any> => {
  return api({
    url: `service/getOrderRoutingRuns`,
    method: "POST",
    data: payload
  });
}

const fetchGroupHistory = async (jobName: string, params: any): Promise<any> => {
  return api({
    url: `serviceJobRuns/${jobName}`,
    method: "GET",
    params
  });
}

const createRoutingGroup = async (payload: any): Promise<any> => {
  return api({
    url: "service/createOrderRoutingGroup",
    method: "POST",
    data: payload
  })
}

const updateRoutingGroup = async (payload: any): Promise<any> => {
  return api({
    url: `service/updateOrderRoutingGroup`,
    method: "POST",
    data: payload
  })
}

const cloneGroup = async (payload: any): Promise<any> => {
  return api({
    url: `groups/${payload.routingGroupId}/clone`,
    method: "POST",
    data: payload
  })
}

const fetchOrderRouting = async (orderRoutingId: string): Promise<any> => {
  return api({
    url: `service/getOrderRouting`,
    method: "POST",
    data: { orderRoutingId }
  })
}

const createRoutingRule = async (payload: any): Promise<any> => {
  return await api({
    url: "service/createOrderRoutingRule",
    method: "POST",
    data: payload
  })
}

const createOrderRouting = async (payload: any): Promise<any> => {
  return await api({
    url: "service/createOrderRouting",
    method: "POST",
    data: payload
  })
}

const cloneRouting = async (payload: any): Promise<any> => {
  return await api({
    url: `routings/${payload.orderRoutingId}/clone`,
    method: "POST",
    data: payload
  })
}

const updateRouting = async (payload: any): Promise<any> => {
  return api({
    url: `service/updateOrderRouting`,
    method: "POST",
    data: payload
  });
}

const deleteRoutingFilter = async (payload: any): Promise<any> => {
  return api({
    url: `service/deleteOrderFilterCondition`,
    method: "DELETE",
    data: payload
  });
}

const deleteRuleCondition = async (payload: any): Promise<any> => {
  return api({
    url: `service/deleteOrderRoutingRuleInvCond`,
    method: "DELETE",
    data: payload
  });
}

const deleteRuleAction = async (payload: any): Promise<any> => {
  return api({
    url: `service/deleteOrderRoutingRuleAction`,
    method: "DELETE",
    data: payload
  });
}

const fetchRule = async (routingRuleId: string): Promise<any> => {
  return api({
    url: `service/getOrderRoutingRule`,
    method: "POST",
    data: { routingRuleId }
  });
}

const cloneRule = async (payload: any): Promise<any> => {
  return await api({
    url: `rules/${payload.routingRuleId}/clone`,
    method: "POST",
    data: payload
  })
}

const updateRule = async (payload: any): Promise<any> => {
  return api({
    url: `service/updateOrderRoutingRule`,
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

const runNow = async (routingGroupId: string): Promise<any> => {
  return api({
    url: `groups/${routingGroupId}/runNow`,
    method: "POST"
  });
}

export const OrderRoutingService = {
  cloneGroup,
  createOrderRouting,
  cloneRouting,
  cloneRule,
  createRoutingGroup,
  createRoutingRule,
  deleteRoutingFilter,
  deleteRuleAction,
  deleteRuleCondition,
  fetchGroupHistory,
  fetchOrderRouting,
  fetchRoutingGroupInformation,
  fetchRoutingGroups,
  fetchRoutingHistory,
  fetchRoutingScheduleInformation,
  fetchRule,
  runNow,
  scheduleBrokering,
  updateRouting,
  updateRoutingGroup,
  updateRule
}