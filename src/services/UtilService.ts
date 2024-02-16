import api from "@/api"

const fetchEnums = async (payload: any): Promise<any> => {
  return api({
    url: "enums", 
    method: "GET",
    params: payload
  });
}

const fetchFacilities = async (payload: any): Promise<any> => {
  return api({
    url: "facilities", 
    method: "GET",
    params: payload
  });
}

const fetchShippingMethods = async (payload: any): Promise<any> => {
  return api({
    url: `productStores/${payload.productStoreId}/shippingMethods`,
    method: "GET",
    params: payload
  });
}

const fetchFacilityGroups = async (payload: any): Promise<any> => {
  return api({
    url: `productStores/${payload.productStoreId}/facilityGroups`, 
    method: "GET",
    params: payload
  });
}

const fetchStatusInformation = async (payload: any): Promise<any> => {
  return api({
    url: "status",
    method: "GET",
    params: payload
  });
}

const checkOmsConnection = async (): Promise<any> => {
  return api({
    url: "checkOmsConnection",
    method: "GET"
  });
}

export const UtilService = {
  checkOmsConnection,
  fetchEnums,
  fetchFacilities,
  fetchFacilityGroups,
  fetchShippingMethods,
  fetchStatusInformation
}