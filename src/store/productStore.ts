import { defineStore } from 'pinia'
import { logger, commonUtil, api } from '@common'
import { orderRoutingStore } from './orderRoutingStore'
import { useUtilStore } from './utilStore'

export const productStore = defineStore('productStore', {
  state: () => {
    return {
      ecomStores: [] as any,
      currentEComStore: {} as any,
      facilities: {} as any,
      shippingMethods: {} as any,
      facilityGroups: {} as any,
      carriers: {} as any
    }
  },
  getters: {
    getCurrentEComStore(state) {
      return state.currentEComStore
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
    getCarriers(state) {
      return state.carriers
    }
  },
  actions: {
    async fetchEComStores(): Promise<any> {
      try {
        const resp = await api({
          url: "admin/user/productStore",
          method: "GET",
          baseURL : commonUtil.getMaargURL(),
        });
        if (commonUtil.hasError(resp) || resp.data.length === 0) {
          throw resp.data;
        } else {
          this.ecomStores = resp.data;
          this.currentEComStore = resp.data[0];
          return Promise.resolve(resp.data);
        }
      } catch(error: any) {
        return Promise.reject(error)
      }
    },
    setEcomStore(payload: any) {
      let productStore = payload.productStore;
      if(!productStore) {
        productStore = this.ecomStores.find((store: any) => store.productStoreId === payload.productStoreId);
      }
      this.currentEComStore = productStore;
      this.updateShippingMethods({});
      this.updateFacillityGroups({});
      useUtilStore().updateProductCategories({});
    },
    async fetchFacilities() {
      let facilities = JSON.parse(JSON.stringify(this.facilities))
  
      if(Object.keys(facilities).length) {
        return;
      }
  
      const payload = { pageSize: 500 }
  
      try {
        const resp = await api({
          url: "order-routing/facilities", 
          method: "GET",
          params: payload
        });
  
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
    async fetchShippingMethods() {
      let shippingMethods = JSON.parse(JSON.stringify(this.shippingMethods))
      if(Object.keys(shippingMethods).length) return;
  
      const payload = {
        productStoreId: orderRoutingStore().currentGroup.productStoreId,
        pageSize: 200
      }
  
      try {
        const resp = await api({
          url: `order-routing/productStores/${payload.productStoreId}/shippingMethods`,
          method: "GET",
          params: payload
        });
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
        productStoreId: orderRoutingStore().currentGroup.productStoreId,
        pageSize: 200
      }
  
      try {
        const resp = await api({
          url: `order-routing/productStores/${payload.productStoreId}/facilityGroups`, 
          method: "GET",
          params: payload
        });
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
    async fetchCarrierInformation(carrierIds: Array<any>) {
      let carriers = JSON.parse(JSON.stringify(this.carriers))
      const carrierPartyIds = carrierIds.filter((id: any) => !carriers[id])
  
      if(!carrierPartyIds.length) return;

      try {
        const resp = await api({
          url: "/oms/parties",
          method: "GET",
          params: {
            partyId: carrierPartyIds,
            partyId_op: "in",
            fieldsToSelect: ["firstName", "middleName", "lastName", "groupName", "partyId"],
            pageSize: carrierPartyIds.length
          }
        });
        if(resp.data?.length) {
          carriers = resp.data.reduce((carriers: any, carrier: any) => {
            carriers[carrier.partyId] = {
              name: carrier.groupName
            }
            return carriers
          }, carriers)
        }
      } catch(err) {
        logger.error(err)
      }

      try {
        const resp = await api({
          url: "/oms/shippingGateways/carrierShipmentMethods",
          method: "GET",
          params: {
            partyId: carrierPartyIds,
            partyId_op: "in",
            deliveryDays_op: "not-empty",
            roleTypeId: "CARRIER",
            pageIndex: 0,
            pageSize: 250,
            orderByField: "sequenceNumber"
          }
        });

        if(resp.data?.length) {
          carriers = resp.data.reduce((carriers: any, carrier: any) => {
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
    async updateShippingMethods(payload: any) {
      this.shippingMethods = payload;
    },
    async updateFacillityGroups(payload: any) {
      this.facilityGroups = payload;
    },
    async clearProductStoreState() {
      this.ecomStores = [];
      this.currentEComStore = {};
      this.facilities = {};
      this.shippingMethods = {};
      this.facilityGroups = {};
      this.carriers = {};
    }
  },
  persist: true
})
