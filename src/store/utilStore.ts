import { defineStore } from 'pinia'
import { logger, commonUtil, api } from '@common'
import { EnumerationAndType } from "@/types"
import { orderRoutingStore } from './orderRoutingStore'
import { productStore } from './productStore'
import { DateTime } from 'luxon'
import { routingEditorCodeLabel } from '@/utils/routingWorkingCopy'

export const ROUTING_EDITOR_ENUM_TYPE_IDS = [
  "ORD_FILTER_PRM_TYPE",
  "ORD_SORT_PARAM_TYPE",
  "INV_FILTER_PRM_TYPE",
  "INV_SORT_PARAM_TYPE",
  "ORDER_SALES_CHANNEL"
] as const;

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
      return state.statuses[id]?.description || routingEditorCodeLabel(id)
    }
  },
  actions: {
    // The migrated admin endpoint is scoped by enumTypeId. Query the editor's families explicitly
    // and sequentially because fetchEnums merges into the current store snapshot after each request.
    async fetchRoutingEditorEnums() {
      for (const enumTypeId of ROUTING_EDITOR_ENUM_TYPE_IDS) {
        await this.fetchEnums({ enumTypeId });
      }
    },
    async fetchEnums(payload: any) {
      let enums = { ...this.enums };
      let pageIndex = 0;
      const pageSize = 500;
  
      try {
        let resp: any;
        do {
          resp = await api({
            url: "admin/enums",
            method: "GET",
            params: {
              ...payload,
              pageIndex,
              pageSize
            }
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
        const resp = await api({
          url: "admin/enums",
          method: "GET",
          params: {
            ...payload,
            pageSize: 500
          }
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
          resp = await api({
            url: `categories/${basePayload.productStoreId}`,
            method: "GET",
            params: {
              ...basePayload,
              pageIndex
            },
            baseURL: commonUtil.getOmsURL() 
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
        const resp = await api({
          url: "admin/status",
          method: "GET",
          params: payload
        });
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
    },
    async getUserSession(payload: any): Promise<any> {
      let userTestingSession = {}

      try {
        const resp = await api({
          url: "admin/user/sessions",
          method: "GET",
          params: payload
        });

        if(resp.data && resp.data?.length) {
          userTestingSession = resp.data.filter((session: any) => !session.thruDate || session.thruDate > DateTime.now().toMillis())[0]
        }
      } catch(err) {
        logger.error("Failed to get user session", err)
      }

      return userTestingSession;
    },
    async getTestSessions(payload: any): Promise<any> {
      let testingSessions = []

      try {
        const resp = await api({
          url: "admin/user/sessions",
          method: "GET",
          params: payload
        });

        if(resp.data && resp.data.length) {
          testingSessions = resp.data.filter((session: any) => !session.thruDate || session.thruDate > DateTime.now().toMillis())
        }
      } catch(err) {
        logger.error("Failed to get testing sessions", err)
      }

      return testingSessions;
    },
    async createUserSession(payload: any): Promise<any> {
      let userTestingSession = {} as any;
      try {
        const resp = await api({
          url: "admin/user/sessions",
          method: "POST",
          data: payload
        }) as any;

        if(resp.data) {
          userTestingSession = {
            userSessionId: resp.data.userSessionId
          }
        }
      } catch(err) {
        logger.error("Failed to create user session", err)
      }

      return userTestingSession;
    },
    async expireUserSession(payload: any, userTestingSession = {}): Promise<any> {
      try {
        const resp = await api({
          url: `admin/user/sessions/${payload.userSessionId}`,
          method: "PUT",
          data: payload
        }) as any;

        if(resp.data) {
          userTestingSession = {}
        }
      } catch(err) {
        logger.error("Failed to update user session", err)
      }

      return userTestingSession;
    },
    async updateProductStoreInfo(payload: any): Promise<any> {
      return api({
        url: `admin/productStores/${payload.productStoreId}`,
        method: "PUT",
        data: payload
      })
    },
    async getProductStoreInfo(): Promise<any> {
      const productStoreId = productStore().getCurrentEComStore?.productStoreId

      return api({
        url: `admin/productStores/${productStoreId}`,
        method: "GET",
        baseURL: commonUtil.getMaargURL()
      })
    }
  },
  persist: true
})
