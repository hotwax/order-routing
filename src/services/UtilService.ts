import { api } from '@/adapter'


const fetchEnums = async (payload: any): Promise<any> => {
  return api({
    url: "performFind", 
    method: "GET",
    params: payload
  });
}

const fetchOmsEnums = async (payload: any): Promise<any> => {
  return api({
    url: "performFind",
    method: "GET",
    params: payload
  });
}

const fetchFacilities = async (payload: any): Promise<any> => {
  return api({
    url: "performFind", 
    method: "POST",
    data: payload
  });
}

const fetchShippingMethods = async (payload: any): Promise<any> => {
  return api({
    url: "performFind",
    method: "GET",
    params: payload
  });
}

const fetchFacilityGroups = async (payload: any): Promise<any> => {
  return api({
    url: "performFind", 
    method: "GET",
    params: payload
  });
}

const fetchStatusInformation = async (payload: any): Promise<any> => {
  return api({
    url: "performFind",
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
  fetchOmsEnums,
  fetchShippingMethods,
  fetchStatusInformation
}