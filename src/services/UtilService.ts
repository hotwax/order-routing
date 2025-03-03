import api, { client } from "@/api"
import store from "@/store";

const fetchEnums = async (payload: any): Promise<any> => {
  return api({
    url: "enums", 
    method: "GET",
    params: payload
  });
}

const fetchOmsEnums = async (payload: any): Promise<any> => {
  return api({
    url: "omsenums",
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

const getCarrierInformation = async (payload: any): Promise<any> => {
  const omsRedirectionInfo = store.getters["user/getOmsRedirectionInfo"];
  let baseURL = omsRedirectionInfo.url;
  baseURL = baseURL && baseURL.startsWith("http") ? baseURL : `https://${baseURL}.hotwax.io/api/`;
  return client({
    url: "performFind",
    method: "post",
    baseURL: baseURL,
    data: payload,
    headers: {
      Authorization:  'Bearer ' + omsRedirectionInfo.token,
      'Content-Type': 'application/json'
    }
  });
}

const getCarrierDeliveryDays = async (payload: any): Promise<any> => {
  const omsRedirectionInfo = store.getters["user/getOmsRedirectionInfo"];
  let baseURL = omsRedirectionInfo.url;
  baseURL = baseURL && baseURL.startsWith("http") ? baseURL : `https://${baseURL}.hotwax.io/api/`;
  return client({
    url: "performFind",
    method: "post",
    baseURL: baseURL,
    data: payload,
    headers: {
      Authorization:  'Bearer ' + omsRedirectionInfo.token,
      'Content-Type': 'application/json'
    }
  });
}

export const UtilService = {
  checkOmsConnection,
  fetchEnums,
  fetchFacilities,
  fetchFacilityGroups,
  fetchOmsEnums,
  fetchShippingMethods,
  fetchStatusInformation,
  getCarrierInformation,
  getCarrierDeliveryDays
}