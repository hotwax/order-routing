import { productStore } from "@/store/product"
import { api, logger } from "@common"
import { Ref, ref } from "vue"

interface ProductFacility {
  productId: string;
  facilityId: string;
  allowBrokering: string;
  allowPickup: string;
  minimumStock: string;
  computedLastInventoryCount: string;
  lastInventoryCount: string;
  maximumStock: string;
  inventoryItemId: string;
  isChecked: boolean;
}

const productFacility: Ref<ProductFacility[]> = ref([] as ProductFacility[])
const inventoryLogs: Ref<any[]> = ref([])

export function useProductFacility() {
  
  async function fetchProductFacility(payload: any) {
    console.log("payload", payload)
    try {
      const resp = await api({
        url: "oms/productFacility",
        method: "GET",
        params: payload
      }) as any

      productFacility.value = resp.data?.products
  
    } catch(err) {
      logger.error("Failed to fetch product facility records", err)
    }
  }

  async function updateProductFacility(payload: any) {
    console.log("payload", payload)
    try {
      await api({
        url: "oms/productFacility",
        method: "POST",
        data: payload
      })
    } catch(err) {
      logger.error("Updated product facility records", err)
    }
  }

  async function fetchInventoryLogs(params: { productId: string, facilityId: string, pageSize: any }) {
    try {
      const resp = await api({
        url: "oms/inventoryItem/detail",
        method: "GET",
        params: {
          ...params,
          orderBy: "effectiveDate desc"
        }
      })

      inventoryLogs.value = resp.data

      console.log('inventoryLogs.value', inventoryLogs.value)
    } catch(err) {
      logger.error("Failed to fetch product facility inventory logs", err)
    }
  }

  return {
    productFacility,
    fetchInventoryLogs,
    fetchProductFacility,
    inventoryLogs,
    updateProductFacility
  }
}