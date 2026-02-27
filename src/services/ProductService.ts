import { client } from "@/api";
import { useUserStore } from "@/store/useUserStore";
import { commonUtil } from "@/utils/commonUtil";

const fetchProducts = async (payload: any): Promise <any>  => {
  const omsRedirectionInfo = useUserStore().getOmsRedirectionInfo;
  return client({
    url: "searchProducts",
    method: "post",
    baseURL: commonUtil.getOmsRedirectionUrl(omsRedirectionInfo),
    data: payload,
    headers: {
      Authorization:  'Bearer ' + omsRedirectionInfo.token,
      'Content-Type': 'application/json'
    }
  });
}

const getInventoryAvailableByFacility = async (payload: any): Promise <any> => {
  const omsRedirectionInfo = useUserStore().getOmsRedirectionInfo;
  return client({
    url: "service/getInventoryAvailableByFacility",
    method: "post",
    baseURL: commonUtil.getOmsRedirectionUrl(omsRedirectionInfo),
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