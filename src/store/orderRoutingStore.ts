import { defineStore } from 'pinia'
import { logger, translate, commonUtil, api } from "@common"
import { DateTime } from "luxon"
import { productStore } from './productStore'
import { productStore as useProduct } from './product'
import { v4 as uuidv4, validate } from 'uuid';

export const orderRoutingStore = defineStore('orderRouting', {
  state: () => {
    return {
      groups: [] as Array<any>,
      currentGroup: {} as any,
      currentRouteId: "",
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
      const currentRouting = state.currentGroup?.routings?.find((routing: any) => routing.orderRoutingId === state.currentRouteId);
      const rules = currentRouting?.rules || [];
      return rules.reduce((acc: any, rule: any) => {
        acc[rule.routingRuleId] = rule;
        return acc;
      }, {});
    },
    getCurrentRoutingGroup(state) {
      return state.currentGroup
    },
    getCurrentOrderRouting(state) {
      return state.currentGroup?.routings?.find((routing: any) => routing.orderRoutingId === state.currentRouteId) || {}
    },
    getRoutingHistory(state) {
      return state.routingHistory
    },
    getCurrentRuleId(state) {
      return state.currentRuleId
    },
    getCurrentRule(state) {
      const currentRouting = state.currentGroup?.routings?.find((routing: any) => routing.orderRoutingId === state.currentRouteId);
      return currentRouting?.rules?.find((rule: any) => rule.routingRuleId === state.currentRuleId) || {};
    },
    getTestRoutingInfo(state) {
      return state.testRouting
    },
    hasUnsavedChanges(state) {
      return state.currentGroup?.hasUnsavedChanges || false
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

      routingGroups.forEach((group: any) => {
        const groupIndex = this.groups.findIndex((g: any) => g.routingGroupId === group.routingGroupId);
        if (groupIndex !== -1) {
          this.groups[groupIndex] = { ...this.groups[groupIndex], ...group };
        } else {
          this.groups.push(group);
        }
      });
      this.groups = commonUtil.sortSequence(this.groups, "runTime")
    },
    async createRoutingGroup(groupName: string) {
      const payload = {
        groupName,
        productStoreId: productStore().currentEComStore.productStoreId,
        createdDate: DateTime.now().toMillis(),
        routingGroupId: uuidv4(),
        lastUpdatedStamp: DateTime.now().toMillis(),
        isNew: true,
        hasUnsavedChanges: true
      }
      try {
        // const resp = await api({
        //   url: "order-routing/groups",
        //   method: "POST",
        //   data: payload
        // })
        // if(!commonUtil.hasError(resp)) {
        //   commonUtil.showToast(translate("Brokering run created"))
        //   await this.fetchOrderRoutingGroups()
        // } else {
        //   throw resp.data
        // }

        this.groups.push(payload);
      } catch(err) {
        commonUtil.showToast(translate("Failed to create brokering run"))
        logger.error(err)
      }
    },
    async saveRoutingGroupRaw(payload: any) {
      const transformedPayload = JSON.parse(JSON.stringify(payload));
      const isNewRoutingGroup = transformedPayload.isNew;
      let stateRoutingGroupId = transformedPayload.routingGroupId;
      if (isNewRoutingGroup) {
        delete transformedPayload.routingGroupId;
        transformedPayload.routings?.forEach((routing: any) => {
          delete routing.routingGroupId;
          delete routing.orderRoutingId;
          routing.orderFilters?.forEach((orderFilter: any) => {
            delete orderFilter.orderRoutingId;
          })
          routing.rules?.forEach((rule: any) => {
            delete rule.routingRuleId;
            delete rule.orderRoutingId;
            rule.inventoryFilters?.forEach((filter: any) => {
              delete filter.routingRuleId;
            });
            rule.actions?.forEach((action: any) => {
              delete action.routingRuleId;
            });
          });
        });
      } else {
        transformedPayload.routings.forEach((routing: any) => {
          if(validate(routing.orderRoutingId)) delete routing.orderRoutingId
          routing.rules?.forEach((rule: any) => {
            if(validate(rule.routingRuleId)) delete rule.routingRuleId
          })
        })
      }

      const schedule = transformedPayload.schedule;
      delete transformedPayload.schedule;

      try {
        const resp = await api({
          url: "order-routing/groups",
          method: "POST",
          data: transformedPayload
        });

        if (resp.data?.routingGroupId) {
          const routingGroupId = resp.data.routingGroupId;
          if (schedule) {
            schedule.routingGroupId = routingGroupId;
            const scheduleResp = await this.scheduleBrokering(schedule);
            if (!scheduleResp.data?.jobName) {
              commonUtil.showToast(translate("Failed to schedule brokering run."));
            }
          }

          if (isNewRoutingGroup) {
            // delete temperary group from local storage with temperary routing group uuid
            this.groups = this.groups.filter((group: any) => group.routingGroupId !== stateRoutingGroupId)
          }

          const getResp = await api({
            url: `order-routing/groups/${routingGroupId}/raw`,
            method: "GET"
          });

          if (Object.keys(getResp?.data).length) {
            this.setCurrentGroup(getResp.data, false);
          } else {
            throw "Error getting saved brokering run";
          }
        } else {
          throw "Error saving brokering run"
        }
      } catch (err) {
        logger.error(err);
        throw err;
      }
    },
    setHasUnsavedChanges(value: boolean) {
      this.currentGroup.hasUnsavedChanges = value;
    },
    async fetchCurrentGroupSchedule(payload: any) {
      const currentGroup = payload.currentGroup as any
      if (currentGroup.isNew) return;
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
      this.setCurrentGroup(currentGroup, false);
    },
    async fetchCurrentRoutingGroup(routingGroupId: any) {
      let currentGroup = {} as any
      try {
        // Only skip when we have the FULL hierarchy cached. Metadata-only currentGroup
        // (just the groups[] shape with no routings) means we still need to fetch /raw.
        if (this.currentGroup && this.currentGroup.routingGroupId === routingGroupId && Array.isArray(this.currentGroup.routings)) {
          return;
        }
        currentGroup = this.groups.find(group => group.routingGroupId === routingGroupId)
        if (!currentGroup?.isNew) {
          const resp = await api({
            url: `order-routing/groups/${routingGroupId}/raw`,
            method: "GET"
          });
          // /raw can come back 200 with an empty body or a non-object payload for groups
          // that have no routings yet. Treat that as "valid group, no routings" rather
          // than an error, so we don't poison currentGroup with a swallowed throw.
          if (!commonUtil.hasError(resp) && resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data)) {
            currentGroup = resp.data
          } else if (currentGroup) {
            currentGroup = { ...currentGroup, routings: [] }
          } else {
            throw resp?.data
          }
        }
      } catch(err) {
        logger.error(err);
      }

      // Normalize entire hierarchy
      if(currentGroup?.routings?.length) {
        currentGroup.routings = commonUtil.sortSequence(currentGroup.routings).map((routing: any) => {
          if (routing.orderFilters?.length) {
            routing.orderFilters = routing.orderFilters.map((filter: any) => {
              if (filter.operator === "not-equals" || filter.operator === "not-in") {
                filter.fieldName = filter.fieldName.replace("_excluded", "") + "_excluded"
              }
              return filter;
            })
          }
          if (routing.rules?.length) {
            routing.rules = commonUtil.sortSequence(routing.rules).map((rule: any) => {
              if (rule.inventoryFilters?.length) {
                const filterSortDesc = import.meta.env.VITE_VUE_APP_FILTER_SORT_DESC || ""
                rule.inventoryFilters = commonUtil.sortSequence(rule.inventoryFilters).map((filter: any) => {
                  if (filterSortDesc.includes(filter.fieldName)) {
                    filter.fieldName = filter.fieldName.replace(" desc", "").replace(" DESC", "")
                  }
                  if (filter.operator === "not-equals") {
                    filter.fieldName = filter.fieldName.replace("_excluded", "") + "_excluded"
                  }
                  return filter;
                })
              }
              return rule;
            })
          }
          return routing;
        })
      }

      await this.fetchCurrentGroupSchedule({ routingGroupId, currentGroup })
      this.setCurrentGroup(currentGroup, false);
    },
    async setCurrentGroup(currentGroup: any, hasUnsavedChanges = true) {
      this.currentGroup = { ...currentGroup, hasUnsavedChanges };
      const groupIndex = this.groups.findIndex((group: any) => group.routingGroupId === currentGroup.routingGroupId)
      if (groupIndex !== -1) {
        this.groups[groupIndex] = { ...this.groups[groupIndex], ...currentGroup, hasUnsavedChanges }
      }
    },
    async createOrderRouting(payload: any) {
      const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
      const orderRoutingId = uuidv4()
      try {
        if(currentGroup["routings"]) {
          currentGroup["routings"].push({
            ...payload,
            orderRoutingId,
            rules: []
          })
        } else {
          currentGroup["routings"] = [{
            ...payload,
            orderRoutingId,
            rules: []
          }]
        }
        if(currentGroup["routings"]?.length) {
          currentGroup["routings"] = commonUtil.sortSequence(currentGroup["routings"])
        }
        await this.setCurrentGroup(currentGroup)
        commonUtil.showToast(translate("New routing created"))
      } catch(err) {
        commonUtil.showToast(translate("Failed to create order routing"))
        logger.error(err)
      }
      return orderRoutingId;
    },
    async cloneOrderRouting(payload: any) {
      let orderRoutingId = ""
      const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
      try {
        const sourceRouting = currentGroup.routings?.find((r: any) => r.orderRoutingId === payload.orderRoutingId)
        if (sourceRouting) {
          orderRoutingId = uuidv4()
          const clonedRouting = JSON.parse(JSON.stringify(sourceRouting))
          clonedRouting.orderRoutingId = orderRoutingId
          clonedRouting.routingName = `${payload.orderRoutingName} copy`
          
          // Generate new IDs for rules and filters to avoid conflicts
          clonedRouting.rules?.forEach((rule: any) => {
            rule.routingRuleId = uuidv4()
          })

          currentGroup.routings.push(clonedRouting)
          currentGroup.routings = commonUtil.sortSequence(currentGroup.routings)
          await this.setCurrentGroup(currentGroup)
          commonUtil.showToast(translate("Routing cloned"))
        }
      } catch(err) {
        commonUtil.showToast(translate("Failed to clone order routing"))
        logger.error(err)
      }
      return orderRoutingId;
    },
    async setCurrentOrderRouting(orderRoutingId: string) {
      this.currentRouteId = orderRoutingId;
    },
    async fetchCurrentOrderRouting(orderRoutingId: string) {
      this.setCurrentOrderRouting(orderRoutingId)
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
        const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
        const routing = currentGroup.routings?.find((r: any) => r.orderRoutingId === payload.orderRoutingId)
        if (routing && routing.orderFilters) {
          const conditionSeqIdsToDelete = payload.filters.map((f: any) => f.conditionSeqId)
          routing.orderFilters = routing.orderFilters.filter((f: any) => !conditionSeqIdsToDelete.includes(f.conditionSeqId))
          await this.setCurrentGroup(currentGroup)
        }
      } catch(err) {
        logger.error(err);
        hasAllFiltersDeletedSuccessfully = false
      }
      return hasAllFiltersDeletedSuccessfully
    },
    async updateRouting(payload: any) {
      const orderRoutingId = payload.orderRoutingId
      try {
        const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
        const routingIndex = currentGroup.routings?.findIndex((r: any) => r.orderRoutingId === orderRoutingId)
        if (routingIndex !== undefined && routingIndex !== -1) {
          const routing = currentGroup.routings[routingIndex]

          // Merge rules if provided in payload
          if (payload.rules && Array.isArray(payload.rules)) {
            const updatedRules = [...(routing.rules || [])]
            payload.rules.forEach((updatedRule: any) => {
              const ruleIndex = updatedRules.findIndex((r: any) => 
                (updatedRule.routingRuleId && r.routingRuleId === updatedRule.routingRuleId) || 
                (!updatedRule.routingRuleId && r.ruleName === updatedRule.ruleName)
              )
              if (ruleIndex !== -1) {
                updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], ...updatedRule }
              } else {
                updatedRules.push(updatedRule)
              }
            })
            payload.rules = updatedRules
          }

          // Merge orderFilters if provided in payload
          if (payload.orderFilters && Array.isArray(payload.orderFilters)) {
            const updatedFilters = [...(routing.orderFilters || [])]
            payload.orderFilters.forEach((updatedFilter: any) => {
              const filterIndex = updatedFilters.findIndex((f: any) => 
                (updatedFilter.conditionSeqId && f.conditionSeqId === updatedFilter.conditionSeqId) ||
                (!updatedFilter.conditionSeqId && f.fieldName === updatedFilter.fieldName && f.conditionTypeEnumId === updatedFilter.conditionTypeEnumId)
              )
              if (filterIndex !== -1) {
                updatedFilters[filterIndex] = { ...updatedFilters[filterIndex], ...updatedFilter }
              } else {
                updatedFilters.push(updatedFilter)
              }
            })
            payload.orderFilters = updatedFilters
          }

          currentGroup.routings[routingIndex] = { ...routing, ...payload }
          await this.setCurrentGroup(currentGroup)
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
      const routingRuleId = uuidv4()
      try {
        const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRouteId)
        if (currentRoute) {
          if (!currentRoute.rules) {
            currentRoute.rules = []
          }
          currentRoute.rules.push({
            ...payload,
            routingRuleId,
            inventoryFilters: [],
            actions: []
          })
          currentRoute.rules = commonUtil.sortSequence(currentRoute.rules)
          await this.setCurrentGroup(currentGroup)
          commonUtil.showToast(translate("Inventory rule created successfully"))
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
        const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRouteId)
        const currentRule = currentRoute?.rules?.find((r: any) => r.routingRuleId === payload.routingRuleId)
        if (currentRule && currentRule.inventoryFilters) {
          const conditionSeqIdsToDelete = payload.conditions.map((c: any) => c.conditionSeqId).filter(Boolean)
          const fieldNamesToDelete = payload.conditions.filter((c: any) => !c.conditionSeqId).map((c: any) => c.fieldName)
          
          currentRule.inventoryFilters = currentRule.inventoryFilters.filter((f: any) => {
            if (f.conditionSeqId) return !conditionSeqIdsToDelete.includes(f.conditionSeqId)
            return !fieldNamesToDelete.includes(f.fieldName)
          })
          await this.setCurrentGroup(currentGroup)
        }
      } catch(err) {
        logger.error(err);
        hasAllConditionsDeletedSuccessfully = false
      }
      return hasAllConditionsDeletedSuccessfully
    },
    async deleteRuleActions(payload: any) {
      let hasAllActionsDeletedSuccessfully = true;
      try {
        const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRouteId)
        const currentRule = currentRoute?.rules?.find((r: any) => r.routingRuleId === payload.routingRuleId)
        if (currentRule && currentRule.actions) {
          const actionSeqIdsToDelete = payload.actions.map((a: any) => a.actionSeqId).filter(Boolean)
          const actionTypesToDelete = payload.actions.filter((a: any) => !a.actionSeqId).map((a: any) => a.actionTypeEnumId)

          currentRule.actions = currentRule.actions.filter((a: any) => {
            if (a.actionSeqId) return !actionSeqIdsToDelete.includes(a.actionSeqId)
            return !actionTypesToDelete.includes(a.actionTypeEnumId)
          })
          await this.setCurrentGroup(currentGroup)
        }
      } catch(err) {
        logger.error(err)
        hasAllActionsDeletedSuccessfully = false
      }
      return hasAllActionsDeletedSuccessfully
    },
    async fetchInventoryRuleInformation(routingRuleId: string) {
      this.updateRoutingRuleId(routingRuleId)
      const currentRule = this.getCurrentRule
      if (!currentRule || !currentRule.routingRuleId) return {}
      
      const formattedRule = JSON.parse(JSON.stringify(currentRule))
      if(formattedRule["inventoryFilters"]?.length) {
        formattedRule["inventoryFilters"] = formattedRule["inventoryFilters"].reduce((filters: any, filter: any) => {
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
      if(formattedRule["actions"]?.length) {
        formattedRule["actions"] = formattedRule["actions"].reduce((actions: any, action: any) => {
          actions[action.actionTypeEnumId] = action
          return actions
        }, {})
      }
      return formattedRule
    },
    async updateRule(payload: any) {
      const routingRuleId = payload.routingRuleId
      try {
        const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRouteId)
        const currentRuleIndex = currentRoute?.rules?.findIndex((r: any) => r.routingRuleId === routingRuleId)
        if (currentRoute && currentRuleIndex !== undefined && currentRuleIndex !== -1) {
          const rule = currentRoute.rules[currentRuleIndex]

          // Merge inventoryFilters if provided in payload
          if (payload.inventoryFilters && Array.isArray(payload.inventoryFilters)) {
            const updatedFilters = [...(rule.inventoryFilters || [])]
            payload.inventoryFilters.forEach((updatedFilter: any) => {
              const filterIndex = updatedFilters.findIndex((f: any) => 
                (updatedFilter.conditionSeqId && f.conditionSeqId === updatedFilter.conditionSeqId) ||
                (!updatedFilter.conditionSeqId && f.fieldName === updatedFilter.fieldName && f.conditionTypeEnumId === updatedFilter.conditionTypeEnumId)
              )
              if (filterIndex !== -1) {
                updatedFilters[filterIndex] = { ...updatedFilters[filterIndex], ...updatedFilter }
              } else {
                updatedFilters.push(updatedFilter)
              }
            })
            payload.inventoryFilters = updatedFilters
          }

          // Merge actions if provided in payload
          if (payload.actions && Array.isArray(payload.actions)) {
            const updatedActions = [...(rule.actions || [])]
            payload.actions.forEach((updatedAction: any) => {
              const actionIndex = updatedActions.findIndex((a: any) => 
                (updatedAction.actionSeqId && a.actionSeqId === updatedAction.actionSeqId) ||
                (!updatedAction.actionSeqId && a.actionTypeEnumId === updatedAction.actionTypeEnumId)
              )
              if (actionIndex !== -1) {
                updatedActions[actionIndex] = { ...updatedActions[actionIndex], ...updatedAction }
              } else {
                updatedActions.push(updatedAction)
              }
            })
            payload.actions = updatedActions
          }

          currentRoute.rules[currentRuleIndex] = { ...rule, ...payload }
          await this.setCurrentGroup(currentGroup)
        }
      } catch(err) {
        logger.error("Failed to update rule conditions and actions")
      }
      return routingRuleId;
    },
    async clearRouting() {
      this.groups = []
      this.currentGroup = {}
      this.currentRouteId = ""
      this.currentRuleId = ""
      this.routingHistory = {}
    },
    async clearCurrentGroup() {
      this.currentGroup = {};
      this.clearCurrentRoutingAndRule();
      this.routingHistory = {}
    },
    async clearCurrentRoutingAndRule() {
      this.currentRouteId = "";
      this.clearRules();
    },
    async clearRules() {
      this.currentRuleId = "";
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
      try {
        const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRouteId)
        const sourceRule = currentRoute?.rules?.find((r: any) => r.routingRuleId === payload.routingRuleId)
        
        if (currentRoute && sourceRule) {
          const clonedRule = JSON.parse(JSON.stringify(sourceRule))
          clonedRule.routingRuleId = uuidv4()
          clonedRule.ruleName = `${sourceRule.ruleName || 'Rule'} copy`
          
          currentRoute.rules.push(clonedRule)
          currentRoute.rules = commonUtil.sortSequence(currentRoute.rules)
          await this.setCurrentGroup(currentGroup)
          commonUtil.showToast(translate("Rule cloned"))
          return { data: { routingRuleId: clonedRule.routingRuleId } } // Returning matching api structure
        }
      } catch (err) {
        logger.error(err)
      }
      return Promise.reject("Failed to clone rule")
    },
    async fetchGroupHistory(jobName: string, params: any): Promise<any> {
      return api({
        url: `order-routing/serviceJobRuns/${jobName}`,
        method: "GET",
        params
      });
    },
    async updateRoutingGroup(payload: any): Promise<any> {
      try {
        const groupIndex = this.groups.findIndex((g: any) => g.routingGroupId === payload.routingGroupId);
        if (groupIndex !== -1) {
          this.groups[groupIndex] = { ...this.groups[groupIndex], ...payload };
          if (this.currentGroup?.routingGroupId === payload.routingGroupId) {
            this.currentGroup = { ...this.currentGroup, ...payload };
          }
          return payload.routingGroupId;
        }
      } catch (err) {
        logger.error(err);
      }
      return Promise.reject("Failed to update group");
    },
    async cloneGroup(payload: any): Promise<any> {
      try {
        const sourceGroup = this.groups.find((g: any) => g.routingGroupId === payload.routingGroupId);
        if (sourceGroup) {
          const newGroupId = uuidv4();
          const clonedGroup = JSON.parse(JSON.stringify(sourceGroup));
          clonedGroup.routingGroupId = newGroupId;
          clonedGroup.groupName = payload.newGroupName || `${sourceGroup.groupName || 'Group'} copy`;
          this.groups.push(clonedGroup);
          return { data: { routingGroupId: newGroupId } };
        }
      } catch (err) {
        logger.error(err);
      }
      return Promise.reject("Failed to clone group");
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
