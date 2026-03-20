import { defineStore } from 'pinia'
import { UtilService } from "@/services/UtilService"
import { logger, commonUtil } from '@common'
import { EnumerationAndType } from "@/types"
import { orderRoutingStore } from './orderRoutingStore'

export const useUtilStore = defineStore('util', {
  state: () => {
    return {
      enums: {} as any,
      categories: {} as any,
      statuses: {} as any
    }
  },
  getters: {
    getEnums(state) {
      return state.enums
    },
    getCatalogCategories(state) {
      return Object.values(state.categories).reduce((catalogCategories: any, category: any) => {
        if(category.prodCatalogCategoryTypeId === "PCCT_ORD_ROUTING") {
          catalogCategories[category.productCategoryId] = category
        }
        return catalogCategories;
      }, {})
    },
    getStatusDesc: (state) => (id: any) => {
      return state.statuses[id]?.description ? state.statuses[id]?.description : id
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

    async fetchCategories() {
      let categories = JSON.parse(JSON.stringify(this.categories))
      if(Object.keys(categories).length) return;
  
      let pageIndex = 0
      const pageSize = 500
      const basePayload = {
        productStoreId: orderRoutingStore().currentGroup.productStoreId,
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

    async clearUtilState() {
        this.enums = {};
        this.categories = {};
        this.statuses = {};
    },
    async updateProductCategories(payload: any) {
      this.categories = payload;
    }
  },
  persist: true
})
