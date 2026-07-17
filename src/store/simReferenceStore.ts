import { defineStore } from 'pinia'
import { commonUtil, logger } from '@common'
import { simApi } from '@/services/SimApiService'

let referenceRequestController: AbortController | null = null

// Dedicated store for the Simulate tab's editor reference data. The simulation page runs against the
// sim Moqui, separate from the login OMS the rest of the app talks to, so its facilities / facility
// groups / shipping methods / sales channels must come from — and stay scoped to — the sim instance.
// Keeping this data here (instead of the shared productStore/utilStore) is what guarantees the two
// backends never share in-memory state. The sandbox-mode RoutingGroupEditor is the only consumer.
export const useSimReferenceStore = defineStore('simReference', {
  state: () => {
    return {
      // Product store the current data was loaded for. Only committed when every slice fetched
      // cleanly, so a partial failure is retried on the next visit instead of cached for the session.
      productStoreId: "" as string,
      facilities: {} as Record<string, any>,
      facilityGroups: {} as Record<string, any>,
      shippingMethods: {} as Record<string, any>,
      salesChannels: {} as Record<string, any>,
      loadState: "idle" as "idle" | "loading" | "ready" | "error",
      loadError: null as string | null,
      loadGeneration: 0,
    }
  },
  getters: {
    getVirtualFacilities(state) {
      return Object.values(state.facilities).reduce((virtual: any, facility: any) => {
        if (facility.parentTypeId === "VIRTUAL_FACILITY") {
          virtual[facility.facilityId] = facility
        }
        return virtual
      }, {})
    },
    getShippingMethods(state) {
      return state.shippingMethods
    },
    getFacilityGroups(state) {
      return state.facilityGroups
    },
    getSalesChannels(state) {
      return state.salesChannels
    },
  },
  actions: {
    async fetchReferenceData(payload: { productStoreId: string; force?: boolean }): Promise<boolean> {
      const { productStoreId, force } = payload
      // Cache by productStoreId: the same group's data is reused across sim-tab visits.
      if (!force && productStoreId === this.productStoreId && Object.keys(this.facilities).length) {
        return true
      }

      const generation = ++this.loadGeneration
      referenceRequestController?.abort()
      referenceRequestController = new AbortController()
      const signal = referenceRequestController.signal
      this.loadError = null
      // Simulation reference data must always be product-store scoped. An unscoped request can mix
      // stores and is not a safe fallback for a missing deployment/session context.
      if (!productStoreId) {
        this.productStoreId = ""
        this.facilities = {}
        this.shippingMethods = {}
        this.facilityGroups = {}
        this.salesChannels = {}
        this.loadState = "error"
        this.loadError = "A product store is required to load simulation reference data."
        logger.warn(this.loadError)
        return false
      }
      this.loadState = "loading"

      /** Fetch one reference slice from the sim instance, reduced to a map keyed by `keyField`.
       *  Returns {} for an empty/garbage body and null when the request errored. */
      const fetchMap = async (url: string, params: Record<string, any>, keyField: string): Promise<Record<string, any> | null> => {
        try {
          const resp = await simApi({
            url,
            method: "GET",
            params,
            signal,
          })
          if (commonUtil.hasError(resp)) return null
          if (Array.isArray(resp.data) && resp.data.length) {
            return resp.data.reduce((map: any, item: any) => { map[item[keyField]] = item; return map }, {})
          }
          return {}
        } catch (err) {
          logger.error(err)
          return null
        }
      }

      const [facilities, shippingMethods, facilityGroups, salesChannels] = await Promise.all([
        fetchMap(`order-routing/facilities`, { pageSize: 500 }, "facilityId"),
        productStoreId
          ? fetchMap(`order-routing/productStores/${productStoreId}/shippingMethods`, { productStoreId, pageSize: 200 }, "shipmentMethodTypeId")
          : Promise.resolve({}),
        productStoreId
          ? fetchMap(`order-routing/productStores/${productStoreId}/facilityGroups`, { productStoreId, pageSize: 200 }, "facilityGroupId")
          : Promise.resolve({}),
        fetchMap(`order-routing/omsenums`, { enumTypeId: "ORDER_SALES_CHANNEL", ...(productStoreId ? { productStoreId } : {}), pageSize: 500 }, "enumId"),
      ])

      if (generation !== this.loadGeneration) return false
      // null = that slice errored: leave the cache key uncommitted so the next visit refetches.
      const failed = [facilities, shippingMethods, facilityGroups, salesChannels].some((r) => r === null)
      if (failed) {
        this.productStoreId = ""
        this.facilities = {}
        this.shippingMethods = {}
        this.facilityGroups = {}
        this.salesChannels = {}
        this.loadState = "error"
        this.loadError = "Simulation reference data could not be loaded completely."
        return false
      }

      this.facilities = facilities!
      this.shippingMethods = shippingMethods!
      this.facilityGroups = facilityGroups!
      this.salesChannels = salesChannels!
      this.productStoreId = productStoreId
      this.loadState = "ready"
      return true
    },
  },
})
