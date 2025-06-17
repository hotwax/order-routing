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

const getUserSessions = async(payload: any): Promise<any> => {
  const url = store.getters["user/getBaseUrl"]
  const token = store.getters["user/getUserToken"]
  const baseURL = url.startsWith("http") ? url.includes("/rest/s1/order-routing") ? url.replace("/order-routing", "/oms") : `${url}/rest/s1/oms/` : `https://${url}.hotwax.io/rest/s1/oms/`;

  return client({
    url: "entityData",
    method: "POST",
    baseURL: baseURL,
    data: payload,
    headers: {
      Api_Key: token,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    }
  });
}

const createUserSession = async(payload: any): Promise<any> => {
  return api({
    url: "user/session",
    method: "POST",
    data: payload
  });
}

const updateUserSession = async(payload: any): Promise<any> => {
  return api({
    url: `user/session/${payload.sessionId}`,
    method: "PUT",
    data: payload
  });
}

const updateProductStoreInfo = async (payload: any): Promise<any> => {
  const url = store.getters["user/getBaseUrl"]
  const token = store.getters["user/getUserToken"]
  const baseURL = url.startsWith("http") ? url.includes("/rest/s1/order-routing") ? url.replace("/order-routing", "/oms") : `${url}/rest/s1/oms/` : `https://${url}.hotwax.io/rest/s1/oms/`;

  return client({
    url: `productStores/${payload.productStoreId}`,
    method: "PUT",
    baseURL: baseURL,
    data: payload,
    headers: {
      Api_Key: token,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    }
  })
}

const getProductStoreInfo = async (): Promise<any> => {
  const url = store.getters["user/getBaseUrl"]
  const token = store.getters["user/getUserToken"]
  const baseURL = url.startsWith('http') ? url.includes('/rest/s1/order-routing') ? url.replace("/order-routing", "/oms") : `${url}/rest/s1/oms/` : `https://${url}.hotwax.io/rest/s1/oms/`;
  const productStoreId = store.getters["user/getCurrentEComStore"]?.productStoreId

  return client({
    url: `productStores/${productStoreId}`,
    method: "GET",
    baseURL: baseURL,
    headers: {
      Api_Key: token,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  })
}

export const UtilService = {
  checkOmsConnection,
  createUserSession,
  fetchEnums,
  fetchFacilities,
  fetchFacilityGroups,
  fetchOmsEnums,
  fetchShippingMethods,
  fetchStatusInformation,
  getCarrierInformation,
  getCarrierDeliveryDays,
  getProductStoreInfo,
  getUserSessions,
  updateProductStoreInfo,
  updateUserSession
}