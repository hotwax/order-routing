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

export const OrderRoutingService = {
  createRoutingGroup,
  fetchOrderRoutings,
  fetchRoutingGroups
}