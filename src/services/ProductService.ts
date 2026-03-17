import { api } from "@common";
import { commonUtil } from "@common";

const fetchProducts = async (payload: any): Promise <any>  => {
  return api({
    url: "searchProducts",
    method: "post",
    baseURL: commonUtil.getOmsURL(),
    data: payload
  });
}

const getInventoryAvailableByFacility = async (payload: any): Promise <any> => {
  return api({
    url: "service/getInventoryAvailableByFacility",
    method: "post",
    baseURL: commonUtil.getOmsURL(),
    data: payload
  });
}

export const ProductService = {
  fetchProducts,
  getInventoryAvailableByFacility
}