import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import UtilState from "./UtilState"
import logger from "@/logger"
import { hasError } from "@/utils"
import * as types from "./mutation-types"
import { UtilService } from "@/services/UtilService"
import { EnumerationAndType } from "@/types"
import store from "@/store"

const actions: ActionTree<UtilState, RootState> = {
  async fetchEnums({ commit, state }, payload) {
    let enums = {
      ...state.enums
    }

    try {
      const resp = await UtilService.fetchEnums(payload);

      if(!hasError(resp) && resp.data.length) {
        enums = resp.data.reduce((enumerations: any, data: EnumerationAndType) => {
          if(enumerations[data.enumTypeId]) {
            enumerations[data.enumTypeId][data.enumId] = data
          } else {
            enumerations[data.enumTypeId] = {
              [data.enumId]: data
            }
          }
          return enumerations
        }, enums)
      }
    } catch(err) {
      logger.error(err)
    }

    commit(types.UTIL_ENUMS_UPDATED, enums)
  },

  async fetchFacilities({ commit, state }) {
    let facilities = JSON.parse(JSON.stringify(state.facilities))

    // Do not fetch facilities if already available
    if(Object.keys(facilities).length) {
      return;
    }

    const payload = {
      parentTypeId: "VIRTUAL_FACILITY"
    }

    try {
      const resp = await UtilService.fetchFacilities(payload);

      if(!hasError(resp) && resp.data.length) {
        facilities = resp.data.reduce((facilities: any, facility: any) => {
          facilities[facility.facilityId] = facility
          return facilities
        }, {})
      }
    } catch(err) {
      logger.error(err)
    }

    commit(types.UTIL_FACILITIES_UPDATED, facilities)
  },

  async fetchShippingMethods({ commit, state }) {
    let shippingMethods = JSON.parse(JSON.stringify(state.shippingMethods))

    // Do not fetch shipping methods if already available
    if(Object.keys(shippingMethods).length) {
      return;
    }

    // Fetching shipping methods for productStore of the currentGroup
    const payload = {
      productStoreId: store.state.orderRouting.currentGroup.productStoreId
    }

    try {
      const resp = await UtilService.fetchShippingMethods(payload);

      if(!hasError(resp) && resp.data.length) {
        shippingMethods = resp.data.reduce((shippingMethods: any, shippingMethod: any) => {
          shippingMethods[shippingMethod.shipmentMethodTypeId] = shippingMethod
          return shippingMethods
        }, {})
      }
    } catch(err) {
      logger.error(err)
    }

    commit(types.UTIL_SHIPPING_METHOD_UPDATED, shippingMethods)
  },

  async fetchFacilityGroups({ commit, state }) {
    let facilityGroups = JSON.parse(JSON.stringify(state.facilityGroups))

    // Do not fetch groups again if already available
    if(Object.keys(facilityGroups).length) {
      return;
    }

    const payload = {
      productStoreId: store.state.orderRouting.currentGroup.productStoreId,
      facilityGroupTypeId: "BROKERING_GROUP"
    }

    try {
      const resp = await UtilService.fetchFacilityGroups(payload);

      if(!hasError(resp) && resp.data.length) {
        facilityGroups = resp.data.reduce((facilityGroups: any, facilityGroup: any) => {
          facilityGroups[facilityGroup.facilityGroupId] = facilityGroup
          return facilityGroups
        }, {})
      }
    } catch(err) {
      logger.error(err)
    }

    commit(types.UTIL_FACILITY_GROUP_UPDATED, facilityGroups)
  },

  async checkOmsConnectionStatus({ commit }) {
    let isOmsConnectionExist = false
    try {
      const resp = await UtilService.checkOmsConnection();

      if(!hasError(resp)) {
        isOmsConnectionExist = true
      }
    } catch(err) {
      logger.error('error', err)
    }

    commit(types.UTIL_OMS_CONNECTION_STATUS_UPDATED, isOmsConnectionExist)
  },

  async fetchStatusInformation({ commit, state }) {
    let statuses = JSON.parse(JSON.stringify(state.statuses))

    // Do not fetch statuses again if already available
    if(Object.keys(statuses).length) {
      return;
    }

    const payload = {
      parentTypeId: "ROUTING_STATUS"
    }

    try {
      const resp = await UtilService.fetchStatusInformation(payload);

      if(!hasError(resp)) {
        statuses = resp.data.reduce((statues: any, status: any) => {
          statues[status.statusId] = status
          return statues
        }, {})
      }
    } catch(err) {
      logger.error("Failed to fetch the status information")
    }

    commit(types.UTIL_STATUSES_UPDATED, statuses)
  },

  async clearUtilState({ commit }) {
    commit(types.UTIL_CLEARED)
  },

  async updateShippingMethods({ commit }) {
    commit(types.UTIL_SHIPPING_METHOD_UPDATED, {})
  },

  async updateFacillityGroups({ commit }) {
    commit(types.UTIL_FACILITY_GROUP_UPDATED, {})
  }
}

export default actions;