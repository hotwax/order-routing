import { api } from "@common"
import logger from "@/logger";
import { useUserStore } from "@/store/useUserStore";
import { commonUtil } from "@common";

const fetchEnums = async (payload: any): Promise<any> => {
  return api({
    url: "order-routing/enums", 
    method: "GET",
    params: payload
  });
}

const fetchOmsEnums = async (payload: any): Promise<any> => {
  return api({
    url: "order-routing/omsenums",
    method: "GET",
    params: payload
  });
}

const fetchFacilities = async (payload: any): Promise<any> => {
  return api({
    url: "order-routing/facilities", 
    method: "GET",
    params: payload
  });
}

const fetchCategories = async (payload: any): Promise<any> => {
  return api({
    url: `categories/${payload.productStoreId}`,
    method: "GET",
    params: payload,
    baseURL: commonUtil.getOmsURL() 
  });
}

const fetchShippingMethods = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/productStores/${payload.productStoreId}/shippingMethods`,
    method: "GET",
    params: payload
  });
}

const fetchFacilityGroups = async (payload: any): Promise<any> => {
  return api({
    url: `order-routing/productStores/${payload.productStoreId}/facilityGroups`, 
    method: "GET",
    params: payload
  });
}

const fetchStatusInformation = async (payload: any): Promise<any> => {
  return api({
    url: "admin/status",
    method: "GET",
    params: payload
  });
}

const getCarrierInformation = async (payload: any): Promise<any> => {
  return api({
    url: "performFind",
    method: "post",
    baseURL: commonUtil.getOmsURL(),
    data: payload
  });
}

const getCarrierDeliveryDays = async (payload: any): Promise<any> => {
  return api({
    url: "performFind",
    method: "post",
    baseURL: commonUtil.getOmsURL(),
    data: payload
  });
}

const getUserSession = async(payload: any): Promise<any> => {
  let userTestingSession = {}

  try {
    const resp = await api({
      url: "oms/entityData",
      method: "POST",
      baseURL: commonUtil.getMaargURL(),
      data: payload
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

  try {
    const resp = await api({
      url: "oms/entityData",
      method: "POST",
      baseURL: commonUtil.getMaargURL(),
      data: payload
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
      url: "order-routing/user/sessions",
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
      url: `order-routing/user/sessions/${payload.userSessionId}`,
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

  return api({
    url: `order-routing/productStores/${payload.productStoreId}`,
    method: "PUT",
    baseURL: commonUtil.getMaargURL(),
    data: payload
  })
}

const getProductStoreInfo = async (): Promise<any> => {
  const productStoreId = useUserStore().getCurrentEComStore?.productStoreId

  return api({
    url: `admin/productStores/${productStoreId}`,
    method: "GET",
    baseURL: commonUtil.getMaargURL()
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