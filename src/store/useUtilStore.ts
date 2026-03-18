import { defineStore } from 'pinia'
import { UtilService } from "@/services/UtilService"
import { logger, commonUtil } from '@common'
import { EnumerationAndType } from "@/types"
import { useOrderRoutingStore } from './useOrderRoutingStore'

export const useUtilStore = defineStore('util', {
  state: () => {
    return {
      enums: {} as any,
      facilities: {} as any,
      categories: {} as any,
      shippingMethods: {} as any,
      facilityGroups: {} as any,
      statuses: {} as any,
      carriers: {} as any
    }
  },
  getters: {
    getEnums(state) {
      return state.enums
    },
    getFacilities(state) {
      return state.facilities
    },
    getVirtualFacilities(state) {
      return Object.values(state.facilities).reduce((virtualFacilities: any, facility: any) => {
        if(facility.parentTypeId === "VIRTUAL_FACILITY") {
          virtualFacilities[facility.facilityId] = facility
        }
        return virtualFacilities;
      }, {}) as any
    },
    getCatalogCategories(state) {
      return Object.values(state.categories).reduce((catalogCategories: any, category: any) => {
        if(category.prodCatalogCategoryTypeId === "PCCT_ORD_ROUTING") {
          catalogCategories[category.productCategoryId] = category
        }
        return catalogCategories;
      }, {})
    },
    getPhysicalFacilities(state) {
      return Object.values(state.facilities).reduce((virtualFacilities: any, facility: any) => {
        if(facility.parentTypeId !== "VIRTUAL_FACILITY") {
          virtualFacilities[facility.facilityId] = facility
        }
        return virtualFacilities;
      }, {})
    },
    getShippingMethods(state) {
      return state.shippingMethods
    },
    getFacilityGroups(state) {
      return state.facilityGroups
    },
    getStatusDesc: (state) => (id: any) => {
      return state.statuses[id]?.description ? state.statuses[id]?.description : id
    },
    getCarriers(state) {
      return state.carriers
    }
  },
  actions: {
    async fetchEnums(payload: any) {
      let enums = { ...this.enums };
      let pageIndex = 0;
      const pageSize = 500;
  
      try {
        let resp: any;
        do {
          resp = await UtilService.fetchEnums({
            ...payload,
            pageIndex,
            pageSize
          });
  
          if(!commonUtil.hasError(resp) && resp.data.length) {
            const respEnums: any = resp.data.reduce((enumerations: any, data: EnumerationAndType) => {
              if(enumerations[data.enumTypeId]) {
                enumerations[data.enumTypeId][data.enumId] = data
              } else {
                enumerations[data.enumTypeId] = {
                  [data.enumId]: data
                }
              }
              return enumerations
            }, {})
  
            if(respEnums["ORD_FILTER_PRM_TYPE"]) {
              Object.values(respEnums["ORD_FILTER_PRM_TYPE"]).reduce((filters: any, filter: any) => {
                if (!filter.enumId.includes("_EXCLUDED")) {
                  filters[filter.enumId + "_EXCLUDED"] = {
                    "enumId": filter.enumId + "_EXCLUDED",
                    "enumTypeId": filter.enumTypeId,
                    "enumCode": filter.enumCode + "_excluded",
                    "sequenceNum": 5,
                    "description": filter.description
                  }
                }
                return filters;
              }, respEnums["ORD_FILTER_PRM_TYPE"])
            }
  
            if(respEnums["INV_FILTER_PRM_TYPE"] && respEnums["INV_FILTER_PRM_TYPE"]["IIP_FACILITY_GROUP"]) {
              respEnums["INV_FILTER_PRM_TYPE"]["IIP_FACILITY_GROUP_EXCLUDED"] = {
                "enumId": "IIP_FACILITY_GROUP_EXCLUDED",
                "enumTypeId": "INV_FILTER_PRM_TYPE",
                "enumCode": "facilityGroupId_excluded",
                "sequenceNum": 5,
                "description": "Facility group"
              } as any
            }
            enums = {
              ...enums,
              ...respEnums
            }
          }
          pageIndex++;
        } while(resp.data.length == pageSize)
      } catch(err) {
        logger.error(err)
      }
      this.enums = enums;
    },
    async fetchOmsEnums(payload: any) {
      let enums = { ...this.enums };
  
      try {
        const resp = await UtilService.fetchOmsEnums({
          ...payload,
          pageSize: 500
        });
  
        if(!commonUtil.hasError(resp) && resp.data.length) {
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
      this.enums = enums;
    },
    async fetchFacilities() {
      let facilities = JSON.parse(JSON.stringify(this.facilities))
  
      if(Object.keys(facilities).length) {
        return;
      }
  
      const payload = { pageSize: 500 }
  
      try {
        const resp = await UtilService.fetchFacilities(payload);
  
        if(!commonUtil.hasError(resp) && resp.data.length) {
          facilities = resp.data.reduce((facilities: any, facility: any) => {
            facilities[facility.facilityId] = facility
            return facilities
          }, {})
        }
      } catch(err) {
        logger.error(err)
      }
      this.facilities = facilities;
    },
    async fetchCategories() {
      let categories = JSON.parse(JSON.stringify(this.categories))
      if(Object.keys(categories).length) return;
  
      let pageIndex = 0
      const pageSize = 500
      const basePayload = {
        productStoreId: useOrderRoutingStore().currentGroup.productStoreId,
        pageSize
      }
  
      try {
        let resp: any
        do {
          resp = await UtilService.fetchCategories({
            ...basePayload,
            pageIndex
          })
          if (!commonUtil.hasError(resp) && resp.data.length) {
            categories = resp.data.reduce((acc: any, category: any) => {
              acc[category.productCategoryId] = category
              return acc
            }, categories)
          }
          pageIndex++
        } while (resp?.data?.length === pageSize)
      } catch (err) {
        logger.error(err)
      }
      this.categories = categories;
    },
    async fetchShippingMethods() {
      let shippingMethods = JSON.parse(JSON.stringify(this.shippingMethods))
      if(Object.keys(shippingMethods).length) return;
  
      const payload = {
        productStoreId: useOrderRoutingStore().currentGroup.productStoreId,
        pageSize: 200
      }
  
      try {
        const resp = await UtilService.fetchShippingMethods(payload);
        if(!commonUtil.hasError(resp) && resp.data.length) {
          shippingMethods = resp.data.reduce((shippingMethods: any, shippingMethod: any) => {
            shippingMethods[shippingMethod.shipmentMethodTypeId] = shippingMethod
            return shippingMethods
          }, {})
        }
      } catch(err) {
        logger.error(err)
      }
      this.shippingMethods = shippingMethods;
    },
    async fetchFacilityGroups() {
      let facilityGroups = JSON.parse(JSON.stringify(this.facilityGroups))
      if(Object.keys(facilityGroups).length) return;
  
      const payload = {
        productStoreId: useOrderRoutingStore().currentGroup.productStoreId,
        pageSize: 200
      }
  
      try {
        const resp = await UtilService.fetchFacilityGroups(payload);
        if(!commonUtil.hasError(resp) && resp.data.length) {
          facilityGroups = resp.data.reduce((facilityGroups: any, facilityGroup: any) => {
            facilityGroups[facilityGroup.facilityGroupId] = facilityGroup
            return facilityGroups
          }, {})
        }
      } catch(err) {
        logger.error(err)
      }
      this.facilityGroups = facilityGroups;
    },
    async fetchStatusInformation() {
      let statuses = JSON.parse(JSON.stringify(this.statuses))
      if(Object.keys(statuses).length) return;
  
      const payload = { parentTypeId: "ROUTING_STATUS" }
  
      try {
        const resp = await UtilService.fetchStatusInformation(payload);
        if(!commonUtil.hasError(resp)) {
          statuses = resp.data.reduce((statues: any, status: any) => {
            statues[status.statusId] = status
            return statues
          }, {})
        }
      } catch(err) {
        logger.error("Failed to fetch the status information")
      }
      this.statuses = statuses;
    },
    async fetchCarrierInformation(carrierIds: Array<any>) {
      let carriers = JSON.parse(JSON.stringify(this.carriers))
      const carrierPartyIds = carrierIds.filter((id: any) => !carriers[id])
  
      if(!carrierPartyIds.length) return;
  
      const payload = {
        inputFields: {
          partyId: carrierIds,
          partyId_op: "in"
        },
        distinct: "Y",
        viewSize: carrierIds.length,
        entityName: "PartyNameView",
      }
  
      try {
        const resp = await UtilService.getCarrierInformation(payload);
        if(!commonUtil.hasError(resp) && resp.data.docs?.length) {
          carriers = resp.data.docs.reduce((carriers: any, carrier: any) => {
            carriers[carrier.partyId] = {
              name: carrier.groupName
            }
            return carriers
          }, carriers)
        }
      } catch(err) {
        logger.error(err)
      }
  
      const deliveryDaysPayload = {
        inputFields: {
          partyId: carrierIds,
          partyId_op: "in",
          roleTypeId: "CARRIER",
          deliveryDays_op: "not-empty"
        },
        distinct: "Y",
        viewSize: 200,
        entityName: "CarrierShipmentMethod",
      }
  
      try {
        const resp = await UtilService.getCarrierDeliveryDays(deliveryDaysPayload);
        if(!commonUtil.hasError(resp) && resp.data.docs?.length) {
          carriers = resp.data.docs.reduce((carriers: any, carrier: any) => {
            if(carriers[carrier.partyId]["deliveryDays"]) {
              carriers[carrier.partyId]["deliveryDays"] = {
                ...carriers[carrier.partyId]["deliveryDays"],
                [carrier.shipmentMethodTypeId]: carrier.deliveryDays
              }
            } else {
              carriers[carrier.partyId]["deliveryDays"] = {
                [carrier.shipmentMethodTypeId]: carrier.deliveryDays
              }
            }
            return carriers
          }, carriers)
        }
      } catch(err) {
        logger.error(err)
      }
      this.carriers = carriers;
    },
    async clearUtilState() {
        this.enums = {};
        this.facilities = {};
        this.categories = {};
        this.shippingMethods = {};
        this.facilityGroups = {};
        this.statuses = {};
        this.carriers = {};
    },
    async updateShippingMethods(payload: any) {
      this.shippingMethods = payload;
    },
    async updateFacillityGroups(payload: any) {
      this.facilityGroups = payload;
    },
    async updateProductCategories(payload: any) {
      this.categories = payload;
    }
  },
  persist: true
})
