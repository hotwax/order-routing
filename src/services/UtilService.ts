import api, { client } from "@/api"
import logger from "@/logger";
import store from "@/store";
import { getOmsRedirectionUrl } from "@/utils";

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

const fetchCategories = async (payload: any): Promise<any> => {
  return api({
    url: `categories/${payload.productStoreId}`,
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

const getCarrierInformation = async (payload: any): Promise<any> => {
  const omsRedirectionInfo = store.getters["user/getOmsRedirectionInfo"];
  return client({
    url: "performFind",
    method: "post",
    baseURL: getOmsRedirectionUrl(omsRedirectionInfo),
    data: payload,
    headers: {
      Authorization:  'Bearer ' + omsRedirectionInfo.token,
      'Content-Type': 'application/json'
    }
  });
}

const getCarrierDeliveryDays = async (payload: any): Promise<any> => {
  const omsRedirectionInfo = store.getters["user/getOmsRedirectionInfo"];
  return client({
    url: "performFind",
    method: "post",
    baseURL: getOmsRedirectionUrl(omsRedirectionInfo),
    data: payload,
    headers: {
      Authorization:  'Bearer ' + omsRedirectionInfo.token,
      'Content-Type': 'application/json'
    }
  });
}

const getUserSession = async(payload: any): Promise<any> => {
  let userTestingSession = {}
  const url = store.getters["user/getBaseUrl"]
  const token = store.getters["user/getUserToken"]
  const baseURL = url.startsWith("http") ? url.includes("/rest/s1/order-routing") ? url.replace("/order-routing", "/oms") : `${url}/rest/s1/oms/` : `https://${url}.hotwax.io/rest/s1/oms/`;

  try {
    const resp = await client({
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

    if(resp.data && resp.data.entityValueList?.length) {
      userTestingSession = resp.data.entityValueList[0]
    }
  } catch(err) {
    logger.error("Failed to get user session", err)
  }

  return userTestingSession;
}

const getTestSessions = async(payload: any): Promise<any> => {
  let testingSessions = []
  const url = store.getters["user/getBaseUrl"]
  const token = store.getters["user/getUserToken"]
  const baseURL = url.startsWith("http") ? url.includes("/rest/s1/order-routing") ? url.replace("/order-routing", "/oms") : `${url}/rest/s1/oms/` : `https://${url}.hotwax.io/rest/s1/oms/`;

  try {
    const resp = await client({
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

    if(resp.data && resp.data.entityValueList?.length) {
      testingSessions = resp.data.entityValueList
    }
  } catch(err) {
    logger.error("Failed to get testing sessions", err)
  }

  return testingSessions;
}

const createUserSession = async (payload: any): Promise<any> => {
  let userTestingSession = {} as any;
  try {
    const resp = await api({
      url: "user/sessions",
      method: "POST",
      data: payload
    }) as any;

    if(resp.data) {
      userTestingSession = {
        userSessionId: resp.data.userSessionId
      }
    }
  } catch(err) {
    logger.error("Failed to create user session", err)
  }

  return userTestingSession;
}

const expireUserSession = async(payload: any, userTestingSession = {}): Promise<any> => {
  try {
    const resp = await api({
      url: `user/sessions/${payload.userSessionId}`,
      method: "PUT",
      data: payload
    }) as any;

    if(resp.data) {
      userTestingSession = {}
    }
  } catch(err) {
    logger.error("Failed to update user session", err)
  }

  return userTestingSession;
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
  createUserSession,
  fetchEnums,
  fetchFacilities,
  fetchCategories,
  fetchFacilityGroups,
  fetchOmsEnums,
  fetchShippingMethods,
  fetchStatusInformation,
  getCarrierInformation,
  getCarrierDeliveryDays,
  getProductStoreInfo,
  getUserSession,
  getTestSessions,
  updateProductStoreInfo,
  expireUserSession
}