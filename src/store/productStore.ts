import { defineStore } from 'pinia'
import { logger, commonUtil, api, translate } from '@common'
import { orderRoutingStore } from './orderRoutingStore'
import { useUtilStore } from './utilStore'

interface ProductStoreReferenceDataPayload {
  productStoreId?: string;
  force?: boolean;
}

function getProductStoreId(payload?: ProductStoreReferenceDataPayload) {
  return payload?.productStoreId || orderRoutingStore().currentGroup.productStoreId;
}

export const productStore = defineStore('productStore', {
  state: () => {
    return {
      ecomStores: [] as any,
      currentEComStore: {} as any,
      facilities: {} as any,
      shippingMethods: {} as any,
      facilityGroups: {} as any,
      carriers: {} as any,
      productStoreFacilities: [] as any, // TODO: Storing productStore facilities separately to be used on inventory pages
      selectedInventoryFacilityId: '' as string,
      settings: {
        productIdentifier: {
          productIdentificationPref: {
            primaryId: 'SKU',
            secondaryId: 'productId'
          },
          productIdentificationOptions: [] as any[],
          sampleProducts: [] as any[],
          currentSampleProduct: null as any
        }
      } as any
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
    },
    getBrokeringFacilityGroups(state) {
      return Object.values(state.facilityGroups).reduce((result: any, group: any) => {
        if (group.facilityGroupTypeId === "BROKERING_GROUP") {
          result[group.facilityGroupId] = group
        }
        return result
      }, {})
    },
    getProductStoreFacilities(state) {
      return state.productStoreFacilities
    },
    getProductIdentificationPref(state) {
      return state.settings.productIdentifier.productIdentificationPref
    },
    getProductIdentificationOptions(state) {
      return state.settings.productIdentifier.productIdentificationOptions
    },
    getCurrentSampleProduct(state) {
      return state.settings.productIdentifier.currentSampleProduct
    }
  },
  actions: {
    async fetchProductStores(): Promise<any> {
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
          await this.fetchProductStoreSettings(this.currentEComStore.productStoreId);
          return Promise.resolve(resp.data);
        }
      } catch(error: any) {
        return Promise.reject(error)
      }
    },
    async setEcomStore(payload: any) {
      let productStore = payload.productStore;
      if(!productStore) {
        productStore = this.ecomStores.find((store: any) => store.productStoreId === payload.productStoreId);
      }
      this.currentEComStore = productStore;
      this.updateShippingMethods({});
      this.updateFacillityGroups({});
      useUtilStore().updateProductCategories({});
      await this.fetchProductStoreSettings(productStore.productStoreId);
    },
    async fetchProductStoreSettings(productStoreId: string) {
      const productStoreSettings = {} as any

      if (productStoreId) {
        const payload = {
          productStoreId,
          settingTypeEnumId: ["PRDT_IDEN_PREF"],
          settingTypeEnumId_op: "in",
          pageIndex: 0,
          pageSize: 50
        }
        try {
          const resp = await api({
            url: `/oms/dataDocumentView`,
            method: "POST",
            data: {
              dataDocumentId: "ProductStoreSetting",
              customParametersMap: payload
            }
          }) as any

          resp?.data?.entityValueList?.forEach((productSetting: any) => {
            productStoreSettings[productSetting.settingTypeEnumId] = productSetting.settingValue
          })
        } catch (error) {
          logger.error("Failed to fetch settings", error)
        }
      }

      const defaultProductStoreSettings = {
        "PRDT_IDEN_PREF": {
          "stateKey": "productIdentifier.productIdentificationPref",
          "value": {
            "primaryId": "SKU",
            "secondaryId": "productId"
          }
        }
      } as any;

      Object.entries(defaultProductStoreSettings).forEach(([settingTypeEnumId, setting]: any) => {
        const { stateKey, value } = setting;
        const settingValue = productStoreSettings[settingTypeEnumId];
        let finalValue;
        try {
          finalValue = settingValue ? JSON.parse(settingValue) : value;
        } catch (e) {
          finalValue = settingValue; // fallback to raw value
        }

        const keys = stateKey.split('.');
        let current = this.settings;

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];

          if (i === keys.length - 1) {
            current[key] = finalValue;
          } else {
            // ensure object exists at each level
            if (!current[key] || typeof current[key] !== 'object') {
              current[key] = {};
            }
            current = current[key];
          }
        }
      })
    },
    async prepareProductIdentifierOptions() {
      const productIdentificationOptions = [
        { goodIdentificationTypeId: "productId", description: "Product ID" },
        { goodIdentificationTypeId: "internalName", description: "Internal Name" },
        { goodIdentificationTypeId: "parentProductName", description: "Parent Product Name" },
        { goodIdentificationTypeId: "title", description: "Title" }
      ]
      let fetchedGoodIdentificationOptions = []
      try {
        const resp: any = await api({
          url: "oms/goodIdentificationTypes",
          method: "get",
          params: {
            parentTypeId: "HC_GOOD_ID_TYPE",
            pageSize: 50
          }
        });
        if(!commonUtil.hasError(resp) && Array.isArray(resp.data)) {
          fetchedGoodIdentificationOptions = resp.data
        }
      } catch(error) {
        logger.error("Failed to fetch good identification types", error)
      }
      this.settings.productIdentifier.productIdentificationOptions = [...productIdentificationOptions, ...fetchedGoodIdentificationOptions]
    },
    async fetchSampleProducts() {
      try {
        const resp: any = await api({
          url: "searchProducts",
          method: "post",
          baseURL: commonUtil.getOmsURL(),
          data: { viewSize: 10 }
        })
        this.settings.productIdentifier.sampleProducts = resp?.data?.response?.docs || []
        this.shuffleProduct()
      } catch(error) {
        logger.error("Failed to fetch sample products", error)
      }
    },
    shuffleProduct() {
      const sampleProducts = this.settings.productIdentifier.sampleProducts
      if(sampleProducts.length) {
        const randomIndex = Math.floor(Math.random() * sampleProducts.length)
        this.settings.productIdentifier.currentSampleProduct = sampleProducts[randomIndex]
      } else {
        this.settings.productIdentifier.currentSampleProduct = null
      }
    },
    async setProductStoreSetting(productStoreId: string, settingTypeEnumId: string, settingValue: any) {
      if(!productStoreId) {
        logger.error("Product Store ID is missing")
        return;
      }
      try {
        const payloadSettingValue = typeof settingValue === "object" ? JSON.stringify(settingValue) : settingValue;
        const resp = await api({
          url: `admin/productStores/${productStoreId}/settings`,
          method: "POST",
          data: {
            productStoreId,
            settingTypeEnumId,
            settingValue: payloadSettingValue
          }
        })
        if(!commonUtil.hasError(resp)) {
          if(settingTypeEnumId === "PRDT_IDEN_PREF") {
            this.settings.productIdentifier.productIdentificationPref = settingValue
          }
          commonUtil.showToast(translate("Product Store setting updated successfully."))
        } else {
          throw resp
        }
      } catch(err) {
        commonUtil.showToast(translate("Failed to update Product Store setting."))
        logger.error(err)
      }
    },
    async fetchFacilities() {
      let facilities = JSON.parse(JSON.stringify(this.facilities))
  
      if(Object.keys(facilities).length) {
        return;
      }
  
      const payload = { pageSize: 500 }
  
      try {
        const resp = await api({
          url: "admin/facilities",
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
    async fetchRoutingReferenceData(payload: ProductStoreReferenceDataPayload = {}) {
      const productStoreId = getProductStoreId(payload);
      await Promise.all([
        this.fetchFacilities(),
        this.fetchFacilityGroups(payload),
        this.fetchShippingMethods(payload),
        useUtilStore().fetchOmsEnums({ 
          enumTypeId: "ORDER_SALES_CHANNEL",
          productStoreId
        })
      ])
    },
    async fetchShippingMethods(payload: ProductStoreReferenceDataPayload = {}) {
      let shippingMethods = payload.force ? {} : JSON.parse(JSON.stringify(this.shippingMethods))
  
      // Do not fetch shipping methods if already available
      if(Object.keys(shippingMethods).length && !payload.force) {
        return;
      }
  
      const productStoreId = getProductStoreId(payload);
      if(!productStoreId) {
        logger.warn("Skipping shipping method fetch because productStoreId is missing.")
        return;
      }
  
      // Fetching shipping methods for productStore of the currentGroup
      const fetchPayload = {
        productStoreId,
        pageSize: 200
      }
  
      try {
        const resp = await api({
          url: `admin/productStores/${payload.productStoreId}/shippingMethods`,
          method: "GET",
          params: fetchPayload
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
    async fetchFacilityGroups(payload: ProductStoreReferenceDataPayload = {}) {
      let facilityGroups = payload.force ? {} : JSON.parse(JSON.stringify(this.facilityGroups))
  
      // Do not fetch groups again if already available
      if(Object.keys(facilityGroups).length && !payload.force) {
        return;
      }
  
      const productStoreId = getProductStoreId(payload);
      if(!productStoreId) {
        logger.warn("Skipping facility group fetch because productStoreId is missing.")
        return;
      }
  
      const fetchPayload = {
        productStoreId,
        pageSize: 200
      }
  
      try {
        const resp = await api({
          url: `admin/productStores/${payload.productStoreId}/facilityGroups`,
          method: "GET",
          params: fetchPayload
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
    },
    setSelectedInventoryFacilityId(facilityId: string) {
      this.selectedInventoryFacilityId = facilityId;
    },
    async fetchProductStoreFacilities() {
      try {
        const resp = await api({
          url: `admin/productStores/${this.currentEComStore.productStoreId}/facilities`,
          method: "GET",
          params: {
            pageSize: 250,
            parentFacilityTypeId: "VIRTUAL_FACILITY",
            parentFacilityTypeId_op: "equals",
            parentFacilityTypeId_not: "Y",
          }
        });

        if(resp.data?.length) {
          this.productStoreFacilities = resp.data
        }
      } catch(err) {
        logger.error(err)
      }
    }
  },
  persist: true
})
