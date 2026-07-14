import { defineStore } from 'pinia'
import { logger, translate, commonUtil, api } from "@common"
import { DateTime } from "luxon"
import { productStore } from './productStore'
import { productStore as useProduct } from './product'
import { normalizeRoutingGroupHierarchy } from '@/utils/ruleUtil'
import { v4 as uuidv4, validate } from 'uuid';
import { simApiBaseUrl } from '@/utils/simConfig';

export const orderRoutingStore = defineStore('orderRouting', {
  state: () => {
    return {
      groups: [] as Array<any>,
      // The editable working copy for the detail editor.
      currentGroup: {} as any,
      // Server-pristine snapshot the working copy diverges from. Captured on a fresh load / after a
      // successful save; used to compute dirty and to power Discard (reset the working copy to this).
      // Persisted alongside currentGroup so an in-progress draft + its baseline survive reload.
      baseline: {} as any,
      currentRoutingId: "",
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
      const currentRouting = state.currentGroup?.routings?.find((routing: any) => routing.orderRoutingId === state.currentRoutingId);
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
      return state.currentGroup?.routings?.find((routing: any) => routing.orderRoutingId === state.currentRoutingId) || {}
    },
    getRoutingHistory(state) {
      return state.routingHistory
    },
    getCurrentRuleId(state) {
      return state.currentRuleId
    },
    getCurrentRule(state) {
      const currentRouting = state.currentGroup?.routings?.find((routing: any) => routing.orderRoutingId === state.currentRoutingId);
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
    async fetchRoutingGroupsList(productStoreId: string): Promise<any[]> {
      const resp = await api({
        url: `order-routing/groups`,
        method: "GET",
        baseURL: simApiBaseUrl(),
        params: { productStoreId, pageSize: 200 },
      });
      return !commonUtil.hasError(resp) && Array.isArray(resp.data) ? resp.data : [];
    },
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
    // Fetches the raw routings/rules/filters for every group in state.groups that
    // is missing them. Used by the Routing groups assistant to give the agent full
    // detail visibility across all listed runs without forcing the user to open each one.
    async fetchOrderRoutingGroupsDetails() {
      const groupsNeedingDetail = this.groups.filter((group: any) => !group.isNew && !Array.isArray(group.routings));
      if (!groupsNeedingDetail.length) return;

      const responses = await Promise.allSettled(groupsNeedingDetail.map((group: any) => api({
        url: `order-routing/groups/${group.routingGroupId}/raw`,
        method: "GET"
      })));

      responses.forEach((response: any, index: number) => {
        const group = groupsNeedingDetail[index];
        const data = response.status === "fulfilled" && !commonUtil.hasError(response.value) ? response.value.data : null;
        const detail = data && typeof data === "object" && !Array.isArray(data) ? data : { routings: [] };
        if (detail?.routings?.length) {
          detail.routings = commonUtil.sortSequence(detail.routings).map((routing: any) => {
            if (routing.rules?.length) {
              routing.rules = commonUtil.sortSequence(routing.rules);
            }
            return routing;
          });
        }
        const groupIndex = this.groups.findIndex((g: any) => g.routingGroupId === group.routingGroupId);
        if (groupIndex !== -1) {
          this.groups[groupIndex] = { ...this.groups[groupIndex], ...detail };
        }
      });
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
        //   commonUtil.showToast(translate("Routing group created"))
        //   await this.fetchOrderRoutingGroups()
        // } else {
        //   throw resp.data
        // }

        this.groups.push(payload);
      } catch(err) {
        commonUtil.showToast(translate("Failed to create routing group"))
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
          if(routing.orderRoutingId && validate(routing.orderRoutingId)) delete routing.orderRoutingId
          routing.rules?.forEach((rule: any) => {
            if(rule.routingRuleId && validate(rule.routingRuleId)) delete rule.routingRuleId
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
              commonUtil.showToast(translate("Failed to schedule routing group."));
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
            throw "Error getting saved routing group";
          }
        } else {
          throw "Error saving routing group"
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
    async fetchRoutingGroupDetail(routingGroupId: string): Promise<any> {
      let group = (this.groups || []).find((g: any) => g.routingGroupId === routingGroupId);
      if (!group?.isNew) {
        let resp;
        try {
          resp = await api({
            url: `order-routing/groups/${routingGroupId}/raw`,
            method: "GET",
          });
        } catch (err) {
          if (group) return normalizeRoutingGroupHierarchy({ ...group });
          throw err;
        }
        if (!commonUtil.hasError(resp) && resp.data && typeof resp.data === "object" && !Array.isArray(resp.data)) {
          group = resp.data;
        } else if (group) {
          group = { ...group, routings: [] };
        } else {
          throw resp?.data;
        }
      }
      return normalizeRoutingGroupHierarchy(group);
    },
    async fetchCurrentRoutingGroup(routingGroupId: any) {
      let currentGroup = {} as any
      try {
        if (this.currentGroup && this.currentGroup.routingGroupId === routingGroupId && Array.isArray(this.currentGroup.routings)) {
          return;
        }
        currentGroup = await this.fetchRoutingGroupDetail(routingGroupId)
      } catch(err) {
        logger.error(err);
      }

      await this.fetchCurrentGroupSchedule({ routingGroupId, currentGroup })
      this.setCurrentGroup(currentGroup, false);
    },
    async setCurrentGroup(currentGroup: any, hasUnsavedChanges = true) {
      this.currentGroup = { ...currentGroup, hasUnsavedChanges };
      // hasUnsavedChanges=false marks server-pristine state (fresh load or post-save refetch): that
      // snapshot becomes the baseline the working copy diverges from (dirty detection + Discard).
      if (!hasUnsavedChanges) {
        this.baseline = JSON.parse(JSON.stringify(this.currentGroup));
      }
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
        commonUtil.showToast(translate("Failed to create routing"))
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
        commonUtil.showToast(translate("Failed to clone routing"))
        logger.error(err)
      }
      return orderRoutingId;
    },
    async setCurrentOrderRouting(orderRoutingId: string) {
      this.currentRoutingId = orderRoutingId;
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
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRoutingId)
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
          commonUtil.showToast(translate("Routing rule created successfully"))
        }
      } catch(err) {
        commonUtil.showToast(translate("Failed to create routing rule"))
        logger.error(err)
      }
      return routingRuleId;
    },
    async deleteRuleConditions(payload: any) {
      let hasAllConditionsDeletedSuccessfully = true;
      try {
        const currentGroup = JSON.parse(JSON.stringify(this.currentGroup))
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRoutingId)
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
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRoutingId)
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
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRoutingId)
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
      this.currentRoutingId = ""
      this.currentRuleId = ""
      this.routingHistory = {}
    },
    async clearCurrentGroup() {
      // Don't silently wipe a working copy that has unsaved edits — leaving the detail page must not
      // lose the draft. Callers (e.g. the list page) skip the reset when the working copy is dirty;
      // the detail page's own navigation guard prompts the user to Save/Discard first.
      if (this.currentGroup?.hasUnsavedChanges) return;
      this.currentGroup = {};
      this.baseline = {};
      this.clearCurrentRoutingAndRule();
      this.routingHistory = {}
    },
    // Discard the working copy's uncommitted edits by resetting it to the server-pristine baseline.
    discardChanges() {
      if (!this.baseline?.routingGroupId) return;
      this.setCurrentGroup(JSON.parse(JSON.stringify(this.baseline)), false);
    },
    async clearCurrentRoutingAndRule() {
      this.currentRoutingId = "";
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
        const currentRoute = currentGroup.routings?.find((r: any) => r.orderRoutingId === this.currentRoutingId)
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
        url: `admin/serviceJobs/${jobName}/runs`,
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
            // Mark the working copy dirty — this is a working-copy edit (name/description), committed
            // to the backend only on Save. (Unlike the other mutations, this one bypasses setCurrentGroup.)
            this.currentGroup = { ...this.currentGroup, ...payload, hasUnsavedChanges: true };
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
