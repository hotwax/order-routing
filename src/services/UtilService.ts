import api from "@/api"

const fetchEnums = async (payload: any): Promise<any> => {
  return api({
    url: "enums", 
    method: "GET",
    params: payload
  });
}

export const UtilService = {
  fetchEnums
}