import { defineStore } from 'pinia'
import { api, commonUtil, logger } from '@common'
import { simulationSetupError } from '@/services/SimulationSetupService'

let referenceRequestController: AbortController | null = null

// Sandbox editor reference data comes from the open Sim Routing datastore through Main OMS.
// It stays separate from the live OMS productStore/utilStore data.
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
      if (!force && productStoreId && productStoreId === this.productStoreId && this.loadState === "ready") {
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

      try {
        const response: any = await api({
          url: `order-routing/simulation/references/${encodeURIComponent(productStoreId)}`,
          method: "GET", signal,
        })
        if (generation !== this.loadGeneration) return false
        const data = response?.data
        if (commonUtil.hasError(response) || ![
          data?.facilities, data?.shippingMethods, data?.facilityGroups, data?.salesChannels,
        ].every(Array.isArray)) throw new Error("Sim Routing returned incomplete reference data.")

        const keyed = (items: any[], key: string) => items.reduce((map: Record<string, any>, item: any) => {
          if (item?.[key]) map[item[key]] = item
          return map
        }, {})
        this.facilities = keyed(data.facilities, "facilityId")
        this.shippingMethods = keyed(data.shippingMethods, "shipmentMethodTypeId")
        this.facilityGroups = keyed(data.facilityGroups, "facilityGroupId")
        this.salesChannels = keyed(data.salesChannels, "enumId")
        this.productStoreId = productStoreId
        this.loadState = "ready"
        return true
      } catch (err) {
        if (generation !== this.loadGeneration) return false
        logger.error(err)
        this.productStoreId = ""
        this.facilities = {}
        this.shippingMethods = {}
        this.facilityGroups = {}
        this.salesChannels = {}
        this.loadState = "error"
        this.loadError = simulationSetupError(err)
        return false
      }
    },
  },
})
