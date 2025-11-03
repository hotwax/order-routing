import { client } from "@/api";
import store from "@/store";
import { getOmsRedirectionUrl } from "@/utils";

const fetchProducts = async (payload: any): Promise <any>  => {
  const omsRedirectionInfo = store.getters["user/getOmsRedirectionInfo"];
  return client({
    url: "searchProducts",
    method: "post",
    baseURL: getOmsRedirectionUrl(omsRedirectionInfo),
    data: payload,
    headers: {
      Authorization:  'Bearer ' + omsRedirectionInfo.token,
      'Content-Type': 'application/json'
    }
  });
}

const getInventoryAvailableByFacility = async (payload: any): Promise <any> => {
  const omsRedirectionInfo = store.getters["user/getOmsRedirectionInfo"];
  return client({
    url: "service/getInventoryAvailableByFacility",
    method: "post",
    baseURL: getOmsRedirectionUrl(omsRedirectionInfo),
    data: payload,
    headers: {
      Authorization:  'Bearer ' + omsRedirectionInfo.token,
      'Content-Type': 'application/json'
    }
  });
}

export const ProductService = {
  fetchProducts,
  getInventoryAvailableByFacility
}