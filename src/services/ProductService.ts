import { client } from "@/api";
import store from "@/store";

const fetchProducts = async (payload: any): Promise <any>  => {
  const omsRedirectionInfo = store.getters["user/getOmsRedirectionInfo"];
  let baseURL = omsRedirectionInfo.url;
  baseURL = baseURL && baseURL.startsWith("http") ? baseURL : `https://${baseURL}.hotwax.io/api/`;
  return client({
    url: "searchProducts",
    method: "post",
    baseURL: baseURL,
    data: payload,
    headers: {
      Authorization:  'Bearer ' + omsRedirectionInfo.token,
      'Content-Type': 'application/json'
    }
  });
}

const getInventoryAvailableByFacility = async (payload: any): Promise <any> => {
  const omsRedirectionInfo = store.getters["user/getOmsRedirectionInfo"];
  let baseURL = omsRedirectionInfo.url;
  baseURL = baseURL && baseURL.startsWith("http") ? baseURL : `https://${baseURL}.hotwax.io/api/`;
  return client({
    url: "service/getInventoryAvailableByFacility",
    method: "post",
    baseURL: baseURL,
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