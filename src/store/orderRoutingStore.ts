import { defineStore } from 'pinia'
import { logger, translate, commonUtil, api } from "@common"
import { DateTime } from "luxon"
import { productStore } from './productStore'
import { productStore as useProduct } from './product'

export const orderRoutingStore = defineStore('orderRouting', {
  state: () => {
    return {
      groups: [] as Array<any>,
      rules: {} as any,
      currentGroup: {} as any,
      currentRoute: {} as any,
      routingHistory: {} as any,
      currentRuleId: "",
      testRouting: {
        currentOrderId: "",
        currentOrder: {},
        currentShipGroupId: "",
        errorMessage: "",
        brokeringDesicionReason: "",
        isOrderBrokered: false,
        hasUnmatchedFilters: false,
        isOrderAlreadyBrokered: false,
        brokeringRoute: "",
        brokeringRule: "",
        eligibleOrderRoutings: [],
        selectedRuleId: "",
        unmatchedOrderFilters: [],
        isRoutingTestEnabled: false,
        isRuleTestEnabled: false
      } as any
    }
  },
  getters: {
    getRoutingGroups(state) {
      return state.groups
    },
    getRulesInformation(state) {
      return state.rules
    },
    getCurrentRoutingGroup(state) {
      return JSON.parse(JSON.stringify(state.currentGroup))
    },
    getCurrentOrderRouting(state) {
      return JSON.parse(JSON.stringify(state.currentRoute))
    },
    getRoutingHistory(state) {
      return JSON.parse(JSON.stringify(state.routingHistory))
    },
    getCurrentRuleId(state) {
      return state.currentRuleId
    },
    getTestRoutingInfo(state) {
      return state.testRouting
    }
  },
  actions: {
    async fetchOrderRoutingGroups() {
      let routingGroups = [] as any;
      const payload = {
        productStoreId: productStore().currentEComStore.productStoreId,
        pageSize: 200
      }
      try {
        const resp = await api({
          url: "order-routing/groups", 
          method: "GET",
          params: payload
        });
        if(!commonUtil.hasError(resp) && resp.data.length) {
          routingGroups = resp.data
        } else {
          throw resp.data
        }
      } catch(err) {
        logger.error(err);
      }
  
      if(routingGroups.length) {
        const groupScheduleInfoPayload = routingGroups.map((group: any) => group.routingGroupId)
        const resp = await Promise.allSettled(groupScheduleInfoPayload.map((routingGroupId: any) => api({
          url: `order-routing/groups/${routingGroupId}/schedule`,
          method: "GET"
        })))
        
        const schedules = resp.filter((response: any) => response.status === "fulfilled").reduce((schedules: any, response: any) => {
          if(response.value.data.schedule) {
            schedules[response.value.data.schedule.jobName] = response.value.data.schedule
          }
          return schedules;
        }, {})
  
        routingGroups = routingGroups.map((group: any) => ({
          ...group,
          runTime: schedules[group.jobName]?.nextExecutionDateTime,
          schedule: schedules[group.jobName]
        }))
        routingGroups = commonUtil.sortSequence(routingGroups, "runTime")
      }
      this.groups = routingGroups;
    },
    async createRoutingGroup(groupName: string) {
      const payload = {
        groupName,
        productStoreId: productStore().currentEComStore.productStoreId,
        createdDate: DateTime.now().toMillis()
      }
      try {
        const resp = await api({
          url: "order-routing/groups",
          method: "POST",
          data: payload
        })
        if(!commonUtil.hasError(resp)) {
          commonUtil.showToast(translate("Brokering run created"))
          await this.fetchOrderRoutingGroups()
        } else {
          throw resp.data
        }
      } catch(err) {
        commonUtil.showToast(translate("Failed to create brokering run"))
        logger.error(err)
      }
    },
    async fetchCurrentGroupSchedule(payload: any) {
      const currentGroup = payload.currentGroup as any
      try {
        const resp = await api({
          url: `order-routing/groups/${payload.routingGroupId}/schedule`,
          method: "GET"
        });
        if(!commonUtil.hasError(resp) && resp.data?.schedule) {
          currentGroup["schedule"] = resp.data.schedule
        } else {
          throw resp.data
        }
      } catch(err) {
        logger.error(err);
      }
      this.currentGroup = currentGroup;
    },
    async fetchCurrentRoutingGroup(routingGroupId: any) {
      let currentGroup = {} as any
      try {
        const resp = await api({
          url: `order-routing/groups/${routingGroupId}`,
          method: "GET"
        });
        if(!commonUtil.hasError(resp) && resp.data) {
          currentGroup = resp.data
        } else {
          throw resp.data
        }
      } catch(err) {
        logger.error(err);
      }
      if(currentGroup.routings?.length) {
        currentGroup.routings = commonUtil.sortSequence(currentGroup.routings)
      }
      await this.fetchCurrentGroupSchedule({ routingGroupId, currentGroup })
    },
    async setCurrentGroup(currentGroup: any) {
      this.currentGroup = currentGroup;
    },
    async createOrderRouting(payload: any) {
      const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
      let orderRoutingId = ""
      try {
        const resp = await api({
          url: "order-routing/routings",
          method: "POST",
          data: payload
        })
        if(!commonUtil.hasError(resp) && resp?.data.orderRoutingId) {
          orderRoutingId = resp.data.orderRoutingId
          if(currentGroup["routings"]) {
            currentGroup["routings"].push({
              ...payload,
              orderRoutingId
            })
          } else {
            currentGroup["routings"] = [{
              ...payload,
              orderRoutingId
            }]
          }
          commonUtil.showToast(translate("New routing created"))
        }
        if(currentGroup["routings"]?.length) {
          currentGroup["routings"] = commonUtil.sortSequence(currentGroup["routings"])
        }
        await this.setCurrentGroup(currentGroup)
      } catch(err) {
        commonUtil.showToast(translate("Failed to create order routing"))
        logger.error(err)
      }
      return orderRoutingId;
    },
    async cloneOrderRouting(payload: any) {
      let orderRoutingId = ""
      try {
        const resp = await api({
          url: `order-routing/routings/${payload.orderRoutingId}/clone`,
          method: "POST",
          data: {
            orderRoutingId: payload.orderRoutingId,
            newRoutingName: `${payload.orderRoutingName} copy`,
            newRoutingGroupId: payload.routingGroupId
          }
        })
        if(!commonUtil.hasError(resp) && resp?.data.newOrderRoutingId) {
          orderRoutingId = resp.data.newOrderRoutingId
          commonUtil.showToast(translate("Routing cloned"))
          await this.fetchCurrentRoutingGroup(payload.routingGroupId)
        }
      } catch(err) {
        commonUtil.showToast(translate("Failed to clone order routing"))
        logger.error(err)
      }
      return orderRoutingId;
    },
    async setCurrentOrderRouting(payload: any) {
      this.currentRoute = payload;
    },
    async fetchCurrentOrderRouting(orderRoutingId: string) {
      let currentRoute = {} as any
      try {
        const resp = await api({
          url: `order-routing/routings/${orderRoutingId}`,
          method: "GET"
        });
        if(!commonUtil.hasError(resp) && resp.data) {
          currentRoute = resp.data
          if(currentRoute["orderFilters"]?.length) {
            currentRoute["orderFilters"].map((filter: any) => {
              if(filter.operator === "not-equals" || filter.operator === "not-in") {
                filter.fieldName += "_excluded"
              }
            })
          }
          currentRoute["rules"] = currentRoute["rules"]?.length ? commonUtil.sortSequence(currentRoute["rules"]) : []
        } else {
          throw resp.data
        }
      } catch(err) {
        logger.error(err);
      }
      this.setCurrentOrderRouting(currentRoute)
    },
    async fetchRoutingHistory(routingGroupId: any) {
      let routingHistory = {}
      try {
        const resp = await api({
          url: `order-routing/groups/${routingGroupId}/routingRuns`,
          method: "GET",
          params: { orderByField: "startDate DESC", pageSize: 500 }
        })
        if(!commonUtil.hasError(resp)) {
          const sortedRoutingHistory = resp.data.sort((a: any, b: any) => b.startDate - a.startDate)
          routingHistory = sortedRoutingHistory.reduce((routings: any, routing: any) => {
            if(routings[routing.orderRoutingId]) {
              routings[routing.orderRoutingId].push(routing)
            } else {
              routings = {
                ...routings,
                [routing.orderRoutingId]: [routing]
              }
            }
            return routings
          }, {})
        } else {
          throw resp.data;
        }
      } catch(err) {
        logger.error(err)
      }
      this.routingHistory = routingHistory;
    },
    async deleteRoutingFilters(payload: any) {
      let hasAllFiltersDeletedSuccessfully = true;
      try {
        for(const filter of payload.filters) {
          const resp = await api({
            url: `order-routing/routings/${payload.orderRoutingId}/orderFilters`,
            method: "DELETE",
            data: {
              orderRoutingId: payload.orderRoutingId,
              conditionSeqId: filter.conditionSeqId
            }
          });
          if(commonUtil.hasError(resp) || !resp.data.orderRoutingId) {
            hasAllFiltersDeletedSuccessfully = false
          }
        }
      } catch(err) {
        logger.error(err);
      }
      return hasAllFiltersDeletedSuccessfully
    },
    async updateRouting(payload: any) {
      let orderRoutingId = ''
      try {
        const resp = await api({
          url: `order-routing/routings/${payload.orderRoutingId}`,
          method: "POST",
          data: payload
        })
        if(!commonUtil.hasError(resp) && resp.data?.orderRoutingId) {
          orderRoutingId = resp.data.orderRoutingId
        }
      } catch(err) {
        logger.error(err);
        commonUtil.showToast(translate("Failed to update routing information"))
      }
      return orderRoutingId
    },
    async updateRoutingRuleId(payload: string) {
      this.currentRuleId = payload;
    },
    async createRoutingRule(payload: any) {
      const currentRoute = JSON.parse(JSON.stringify(this.currentRoute))
      let routingRules = currentRoute.rules?.length ? JSON.parse(JSON.stringify(currentRoute.rules)) : []
      let routingRuleId = ''
      try {
        const resp = await api({
          url: "order-routing/rules",
          method: "POST",
          data: payload
        })
        if(!commonUtil.hasError(resp) && resp?.data.routingRuleId) {
          routingRuleId = resp.data.routingRuleId
          routingRules.push({
            ...payload,
            routingRuleId
          })
          commonUtil.showToast(translate("Inventory rule created successfully"))
          if(routingRules.length) {
            routingRules = commonUtil.sortSequence(routingRules)
          }
          currentRoute["rules"] = routingRules
          this.currentRoute = currentRoute;
        }
      } catch(err) {
        commonUtil.showToast(translate("Failed to create inventory rule"))
        logger.error(err)
      }
      return routingRuleId;
    },
    async deleteRuleConditions(payload: any) {
      let hasAllConditionsDeletedSuccessfully = true;
      try {
        for(const condition of payload.conditions) {
          const resp = await api({
            url: `order-routing/rules/${payload.routingRuleId}/inventoryFilters`,
            method: "DELETE",
            data: {
              routingRuleId: payload.routingRuleId,
              conditionSeqId: condition.conditionSeqId
            }
          })
          if(commonUtil.hasError(resp) || !resp.data.conditionSeqId) {
            hasAllConditionsDeletedSuccessfully = false
          }
        }
      } catch(err) {
        logger.error(err);
      }
      return hasAllConditionsDeletedSuccessfully
    },
    async deleteRuleActions(payload: any) {
      let hasAllActionsDeletedSuccessfully = true;
      try {
        for(const action of payload.actions) {
          const resp = await api({
            url: `order-routing/rules/${payload.routingRuleId}/actions`,
            method: "DELETE",
            data: {
              routingRuleId: payload.routingRuleId,
              actionSeqId: action.actionSeqId
            }
          })
          if(commonUtil.hasError(resp) || !resp.data.actionSeqId) {
            hasAllActionsDeletedSuccessfully = false
          }
        }
      } catch(err) {
        logger.error(err)
      }
      return hasAllActionsDeletedSuccessfully
    },
    async fetchInventoryRuleInformation(routingRuleId: string) {
      const rulesInformation = JSON.parse(JSON.stringify(this.rules))
      const filterSortDesc = import.meta.env.VITE_VUE_APP_FILTER_SORT_DESC || ""
      try {
        const resp = await api({
          url: `order-routing/rules/${routingRuleId}`,
          method: "GET"
        });
        if(!commonUtil.hasError(resp) && resp.data.routingRuleId) {
          rulesInformation[routingRuleId] = resp.data
          if(rulesInformation[routingRuleId]["inventoryFilters"]?.length) {
            rulesInformation[routingRuleId]["inventoryFilters"] = commonUtil.sortSequence(rulesInformation[routingRuleId]["inventoryFilters"]).reduce((filters: any, filter: any) => {
              if(filterSortDesc.includes(filter.fieldName)) {
                filter.fieldName = filter.fieldName.replace(" desc", "").replace(" DESC", "")
              }
              if(filter.operator === "not-equals") {
                filter.fieldName += "_excluded"
              }
              if(filters[filter.conditionTypeEnumId]) {
                filters[filter.conditionTypeEnumId][filter.fieldName] = filter
              } else {
                filters[filter.conditionTypeEnumId] = {
                  [filter.fieldName]: filter
                }
              }
              return filters
            }, {})
          }
          if(rulesInformation[routingRuleId]["actions"]?.length) {
            rulesInformation[routingRuleId]["actions"] = rulesInformation[routingRuleId]["actions"].reduce((actions: any, action: any) => {
              actions[action.actionTypeEnumId] = action
              return actions
            }, {})
          }
        }
      } catch(err) {
        logger.error(err)
      }
      this.rules = rulesInformation;
      return rulesInformation[routingRuleId] ? JSON.parse(JSON.stringify(rulesInformation[routingRuleId])) : {}
    },
    async updateRule(payload: any) {
      let routingRuleId = ''
      try {
        const resp = await api({
          url: `order-routing/rules/${payload.routingRuleId}`,
          method: "POST",
          data: payload
        });
        if(!commonUtil.hasError(resp) && resp.data.routingRuleId) {
          routingRuleId = resp.data.routingRuleId
        }
      } catch(err) {
        logger.error("Failed to update rule conditions and actions")
      }
      return routingRuleId;
    },
    async clearRouting() {
      this.groups = []
      this.rules = {}
      this.currentGroup = {}
      this.currentRoute = {}
      this.routingHistory = {}
    },
    async clearRules() {
      this.rules = {};
    },
    async updateGroupStatus(payload: any) {
      const routingGroups = JSON.parse(JSON.stringify(this.groups))
      const routingGroup = routingGroups.find((routingGroup: any) => routingGroup.routingGroupId === payload.routingGroupId)
      if (routingGroup?.schedule) {
        routingGroup.schedule.paused = payload.value
      }
      this.groups = routingGroups;
      return routingGroups
    },
    updateRoutingTestInfo(payload: Array<any>) {
      payload.forEach((testInfo: any) => {
        this.testRouting[testInfo.key] = testInfo.value
      })
    },
    clearRoutingTestInfo(payload?: any) {
      this.testRouting = {
        currentOrderId: "",
        currentOrder: {},
        currentShipGroupId: "",
        errorMessage: "",
        brokeringDesicionReason: "",
        isOrderBrokered: false,
        hasUnmatchedFilters: false,
        isOrderAlreadyBrokered: false,
        brokeringRoute: "",
        brokeringRule: "",
        eligibleOrderRoutings: [],
        selectedRuleId: "",
        unmatchedOrderFilters: [],
        isRoutingTestEnabled: false,
        isRuleTestEnabled: false,
        ...(payload || {})
      }
    },
    async runNow(routingGroupId: string): Promise<any> {
      return api({
        url: `order-routing/groups/${routingGroupId}/runNow`,
        method: "POST"
      });
    },
    async scheduleBrokering(payload: any): Promise<any> {
      return api({
        url: `order-routing/groups/${payload.routingGroupId}/schedule`,
        method: "POST",
        data: payload
      });
    },
    async cloneRule(payload: any): Promise<any> {
      return await api({
        url: `order-routing/rules/${payload.routingRuleId}/clone`,
        method: "POST",
        data: payload
      })
    },
    async fetchGroupHistory(jobName: string, params: any): Promise<any> {
      return api({
        url: `order-routing/serviceJobRuns/${jobName}`,
        method: "GET",
        params
      });
    },
    async updateRoutingGroup(payload: any): Promise<any> {
      return api({
        url: `order-routing/groups/${payload.routingGroupId}`,
        method: "POST",
        data: payload
      })
    },
    async cloneGroup(payload: any): Promise<any> {
      return api({
        url: `order-routing/groups/${payload.routingGroupId}/clone`,
        method: "POST",
        data: payload
      })
    },
    async findOrder(queryString: string, orderId: string): Promise<any> {
      let orders = []
      let errorMessage = "";
      const orderCarrierPartyIds: Array<string> = [];
      const payload = {
        "json": {
          "params": {
            "rows": "10",
            "group": true,
            "group.field": "orderId",
            "group.limit": 1000,
            "group.ngroups": true,
            "q.op": "AND",
            "start": 0,
            "qf": "orderId^10 search_orderIdentifications search_goodIdentifications orderNotes^5 externalOrderId^5 customerPartyName^20  productId^3 productName parentProductName internalName parentProductId",
            "defType": "edismax"
          },
          "query": `(*${queryString.trim()}*) OR "${queryString.trim()}"^100`,
          "filter": `docType: ORDER AND orderTypeId: SALES_ORDER AND orderStatusId: ORDER_APPROVED AND productStoreId: ${productStore().getCurrentEComStore?.productStoreId} AND -shipmentMethodTypeId: STOREPICKUP`
        }
      }

      // If having orderId, then perform searching on the same
      if(orderId) {
        payload.json.filter += `AND orderId: ${orderId}`
      }

      try {
        const resp = await api({
          url: "solr-query",
          method: "post",
          baseURL: commonUtil.getOmsURL(),
          data: payload
        });

        if(!commonUtil.hasError(resp) && resp.data.grouped?.orderId?.groups.length) {
          const productIds: Array<string> = [];
          orders = resp.data.grouped?.orderId?.groups.map((group: any) => {
            const groups = group.doclist.docs.reduce((shipGroups: any, item: any) => {
              productIds.push(item.productId)
              orderCarrierPartyIds.push(item.carrierPartyId)
              shipGroups[item.shipGroupSeqId] ? shipGroups[item.shipGroupSeqId].push(item) : shipGroups[item.shipGroupSeqId] = [item]
              return shipGroups
            }, {})

            return {
              orderId: group.doclist.docs[0].orderId,
              orderName: group.doclist.docs[0].orderName,
              orderStatusDesc: group.doclist.docs[0].orderStatusDesc,
              groups
            }
          })

          productStore().fetchCarrierInformation( [...new Set(orderCarrierPartyIds)])

          if(productIds.length) {
            await useProduct().fetchProducts( productIds)
          }
        } else {
          throw resp
        }
      } catch(error) {
        logger.error(error)
        errorMessage = "Unable to find order"
      }

      return {
        orders,
        errorMessage
      }
    },
    async brokerOrder(payload: any): Promise<any> {
      return api({
        url: `order-routing/groups/${payload.routingGroupId}/run`,
        method: "POST",
        data: payload
      })
    },
    async resetOrder(payload: any): Promise<any> {
      return api({
        url: `order-routing/orders/${payload.orderId}/reject`,
        method: "POST",
        data: payload
      })
    },
    async getRecentOrderFacilityChangeInfo(payload: any): Promise<any> {
      return api({
        url: `order-routing/orders/${payload.orderId}/routing-history/recent`,
        method: "GET",
        data: payload
      })
    }
  },
  persist: true
})
