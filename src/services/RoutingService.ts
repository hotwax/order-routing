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

export const OrderRoutingService = {
  createRoutingGroup,
  fetchRoutingGroups
}