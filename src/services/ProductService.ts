import { client } from "@common";
import { cookieHelper, getOmsURL } from "@common";

const fetchProducts = async (payload: any): Promise <any>  => {
  return client({
    url: "searchProducts",
    method: "post",
    baseURL: getOmsURL(),
    data: payload,
    headers: {
      Authorization:  'Bearer ' + cookieHelper().get("token"),
      'Content-Type': 'application/json'
    }
  });
}

const getInventoryAvailableByFacility = async (payload: any): Promise <any> => {
  return client({
    url: "service/getInventoryAvailableByFacility",
    method: "post",
    baseURL: getOmsURL(),
    data: payload,
    headers: {
      Authorization:  'Bearer ' + cookieHelper().get("token"),
      'Content-Type': 'application/json'
    }
  });
}

export const ProductService = {
  fetchProducts,
  getInventoryAvailableByFacility
}