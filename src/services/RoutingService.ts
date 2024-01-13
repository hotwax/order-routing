import api from "@/api"

const fetchRoutingGroups = async (payload: any): Promise<any> => {
  return api({
    url: "groups", 
    method: "GET",
    data: payload
  });
}

export const OrderRoutingService = {
  fetchRoutingGroups
}