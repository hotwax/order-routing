import { defineStore } from 'pinia'
import { OrderRoutingService } from "@/services/RoutingService"
import { commonUtil } from "@/utils/commonUtil"
import logger from "@/logger"
import { DateTime } from "luxon"
import { translate } from "@/i18n"
import { useUserStore } from './useUserStore'

export const useOrderRoutingStore = defineStore('orderRouting', {
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
        productStoreId: useUserStore().currentEComStore.productStoreId,
        pageSize: 200
      }
      try {
        const resp = await OrderRoutingService.fetchRoutingGroups(payload);
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
        const resp = await Promise.allSettled(groupScheduleInfoPayload.map((routingGroupId: any) => OrderRoutingService.fetchRoutingScheduleInformation(routingGroupId)))
        
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
        productStoreId: useUserStore().currentEComStore.productStoreId,
        createdDate: DateTime.now().toMillis()
      }
      try {
        const resp = await OrderRoutingService.createRoutingGroup(payload)
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
        const resp = await OrderRoutingService.fetchRoutingScheduleInformation(payload.routingGroupId);
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
        const resp = await OrderRoutingService.fetchRoutingGroupInformation(routingGroupId);
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
        const resp = await OrderRoutingService.createOrderRouting(payload)
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
        const resp = await OrderRoutingService.cloneRouting({
          orderRoutingId: payload.orderRoutingId,
          newRoutingName: `${payload.orderRoutingName} copy`,
          newRoutingGroupId: payload.routingGroupId
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
        const resp = await OrderRoutingService.fetchOrderRouting(orderRoutingId);
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
        const resp = await OrderRoutingService.fetchRoutingHistory(routingGroupId, { orderByField: "startDate DESC", pageSize: 500 })
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
          const resp = await OrderRoutingService.deleteRoutingFilter({
            orderRoutingId: payload.orderRoutingId,
            conditionSeqId: filter.conditionSeqId
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
        const resp = await OrderRoutingService.updateRouting(payload)
        if(!commonUtil.hasError(resp) && resp.data?.orderRoutingId) {
          orderRoutingId = resp.data.orderRoutingId
        }
      } catch(err) {
        logger.error(err);
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
        const resp = await OrderRoutingService.createRoutingRule(payload)
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
          const resp = await OrderRoutingService.deleteRuleCondition({
            routingRuleId: payload.routingRuleId,
            conditionSeqId: condition.conditionSeqId
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
          const resp = await OrderRoutingService.deleteRuleAction({
            routingRuleId: payload.routingRuleId,
            actionSeqId: action.actionSeqId
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
      const filterSortDesc = process.env.VUE_APP_FILTER_SORT_DESC || ""
      try {
        const resp = await OrderRoutingService.fetchRule(routingRuleId)
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
        const resp = await OrderRoutingService.updateRule(payload)
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
    }
  },
  persist: {
    paths: ["currentGroup", "currentRuleId", "testRouting"]
  }
})
