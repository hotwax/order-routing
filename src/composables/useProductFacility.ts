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
  inventoryConfig?: {
    atp?: string | number | null;
    qoh?: string | number | null;
    minimumStock?: string | number | null;
    allowPickup?: string | null;
    allowBrokering?: string | null;
  };
}

const productFacility: Ref<ProductFacility[]> = ref([] as ProductFacility[])
const inventoryLogs: Ref<any[]> = ref([])

export function useProductFacility() {
  
  async function fetchProductFacility(payload: any): Promise<number> {
    try {
      const resp = await api({
        url: "oms/productFacilities/search",
        method: "GET",
        params: payload
      }) as any

      productFacility.value = resp.data?.products
      return resp.data?.totalCount ?? 0
    } catch(err) {
      logger.error("Failed to fetch product facility records", err)
      return 0
    }
  }

  async function updateProductFacility(payload: any) {
    try {
      await api({
        url: "oms/productFacilities",
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
          orderByField: "effectiveDate desc"
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
