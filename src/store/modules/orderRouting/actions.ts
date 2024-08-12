import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import OrderRoutingState from "./OrderRoutingState"
import { OrderRoutingService } from "@/services/RoutingService"
import { hasError, showToast, sortSequence } from "@/utils"
import * as types from './mutation-types'
import logger from "@/logger"
import { DateTime } from "luxon"
import emitter from "@/event-bus"
import { translate } from "@/i18n"
import store from "@/store"

const actions: ActionTree<OrderRoutingState, RootState> = {
  async fetchOrderRoutingGroups({ commit }) {
    let routingGroups = [] as any;
    // filter groups on the basis of productStoreId
    const payload = {
      productStoreId: store.state.user.currentEComStore.productStoreId,
      pageSize: 200
    }

    try {
      const resp = await OrderRoutingService.fetchRoutingGroups(payload);

      if(!hasError(resp) && resp.data.length) {
        routingGroups = resp.data
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    if(routingGroups.length) {
      const groupScheduleInfoPayload = routingGroups.map((group: any) => {
        return group.routingGroupId
      })

      const resp = await Promise.allSettled(groupScheduleInfoPayload.map((routingGroupId: any) => OrderRoutingService.fetchRoutingScheduleInformation(routingGroupId)))

      // Performing check on only those responses for which the status is fulfilled
      const schedules = resp.filter((response: any) => response.status === "fulfilled").reduce((schedules: any, response: any) => {
        if(response.value.data.schedule) {
          schedules[response.value.data.schedule.jobName] = response.value.data.schedule
        }
        return schedules;
      }, {})

      routingGroups = routingGroups.map((group: any) => ({
        ...group,
        runTime: schedules[group.jobName]?.nextExecutionDateTime,  // Using this value just to sort the groups on the basis of runTime
        schedule: schedules[group.jobName]
      }))

      routingGroups = sortSequence(routingGroups, "runTime")
    }

    commit(types.ORDER_ROUTING_GROUPS_UPDATED, routingGroups)
  },

  async createRoutingGroup({ dispatch }, groupName) {
    const payload = {
      groupName,
      productStoreId: store.state.user.currentEComStore.productStoreId,
      createdDate: DateTime.now().toMillis()
    }
    try {
      const resp = await OrderRoutingService.createRoutingGroup(payload)

      if(!hasError(resp)) {
        showToast(translate("Brokering run created"))
        await dispatch("fetchOrderRoutingGroups")
      } else {
        throw resp.data
      }
    } catch(err) {
      showToast(translate("Failed to create brokering run"))
      logger.error(err)
    }
  },

  async fetchCurrentRoutingGroup({ dispatch }, routingGroupId) {
    emitter.emit("presentLoader", { message: "Fetching rules", backdropDismiss: false })
    let currentGroup = {} as any

    try {
      const resp = await OrderRoutingService.fetchRoutingGroupInformation(routingGroupId);

      if(!hasError(resp) && resp.data) {
        currentGroup = resp.data
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    if(currentGroup.routings?.length) {
      currentGroup.routings = sortSequence(currentGroup.routings)
    }

    // Fetching the schedule information for the group
    await dispatch("fetchCurrentGroupSchedule", { routingGroupId, currentGroup })

    emitter.emit("dismissLoader")
  },

  async fetchCurrentGroupSchedule({ commit }, payload) {
    const currentGroup = payload.currentGroup as any

    try {
      const resp = await OrderRoutingService.fetchRoutingScheduleInformation(payload.routingGroupId);

      if(!hasError(resp) && resp.data?.schedule) {
        currentGroup["schedule"] = resp.data.schedule
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    commit(types.ORDER_ROUTING_CURRENT_GROUP_UPDATED, currentGroup)
  },

  async setCurrentGroup({ commit }, currentGroup) {
    commit(types.ORDER_ROUTING_CURRENT_GROUP_UPDATED, currentGroup)
  },

  async createOrderRouting({ dispatch, state }, payload) {
    const currentGroup = JSON.parse(JSON.stringify(state.currentGroup))
    let orderRoutingId = ""

    try {
      const resp = await OrderRoutingService.createOrderRouting(payload)

      if(!hasError(resp) && resp?.data.orderRoutingId) {
        orderRoutingId = resp.data.orderRoutingId
        // Added check, as when there is no routing we need to create the key as well, but if routings already exist then we just need to push the value
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
        showToast(translate("New routing created"))
      }

      if(currentGroup["routings"].length) {
        currentGroup["routings"] = sortSequence(currentGroup["routings"])
      }

      await dispatch("setCurrentGroup", currentGroup)
    } catch(err) {
      showToast(translate("Failed to create order routing"))
      logger.error(err)
    }

    return orderRoutingId;
  },

  async cloneOrderRouting({ dispatch }, payload) {
    let orderRoutingId = ""

    try {
      const resp = await OrderRoutingService.cloneRouting({
        orderRoutingId: payload.orderRoutingId,
        newRoutingName: `${payload.orderRoutingName} copy`,
        newRoutingGroupId: payload.routingGroupId // group in which this routing needs to be cloned
      })

      if(!hasError(resp) && resp?.data.newOrderRoutingId) {
        orderRoutingId = resp.data.newOrderRoutingId
        showToast(translate("Routing cloned"))

        // TODO: check if we can get all the information in response so we do not need to make an api call here
        // Fetching the group information again as we do not have the complete information for the cloned route
        await dispatch("fetchCurrentRoutingGroup", payload.routingGroupId)
      }
    } catch(err) {
      showToast(translate("Failed to clone order routing"))
      logger.error(err)
    }

    return orderRoutingId;
  },

  async fetchCurrentOrderRouting({ dispatch }, orderRoutingId) {
    let currentRoute = {} as any

    try {
      const resp = await OrderRoutingService.fetchOrderRouting(orderRoutingId);

      if(!hasError(resp) && resp.data) {
        currentRoute = resp.data
        currentRoute["rules"] = currentRoute["rules"]?.length ? sortSequence(currentRoute["rules"]) : []
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    dispatch("setCurrentOrderRouting", currentRoute)
  },

  async setCurrentOrderRouting({ commit }, payload) {
    commit(types.ORDER_ROUTING_CURRENT_ROUTE_UPDATED, payload)
  },

  async fetchRoutingHistory({ commit }, routingGroupId) {
    let routingHistory = {}

    try {
      const resp = await OrderRoutingService.fetchRoutingHistory(routingGroupId, { orderByField: "startDate DESC", pageSize: 500 })
  
      if(!hasError(resp)) {
        // Sorting the history based on startTime, as we does not get the records in sorted order from api
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

    commit(types.ORDER_ROUTING_HISTORY_UPDATED, routingHistory)
  },

  async deleteRoutingFilters({ dispatch }, payload) {
    let hasAllFiltersDeletedSuccessfully = true;
    try {
      // As discussed, we can't make parallel api calls, hence using for loop to make api calls
      for(const filter of payload.filters) {
        const resp = await OrderRoutingService.deleteRoutingFilter({
          orderRoutingId: payload.orderRoutingId,
          conditionSeqId: filter.conditionSeqId
        });
        if(hasError(resp) || !resp.data.orderRoutingId) {
          hasAllFiltersDeletedSuccessfully = false
        }
      }
    } catch(err) {
      logger.error(err);
    }

    return hasAllFiltersDeletedSuccessfully
  },

  async updateRouting({ dispatch }, payload) {
    let orderRoutingId = ''
    try {
      const resp = await OrderRoutingService.updateRouting(payload)
      if(!hasError(resp) && resp.data?.orderRoutingId) {
        orderRoutingId = resp.data.orderRoutingId
      }
    } catch(err) {
      logger.error(err);
    }

    return orderRoutingId
  },

  async updateRoutingRuleId({ commit }, payload) {
    commit(types.ORDER_ROUTING_CURRENT_RULE_UPDATED, payload)
  },

  async createRoutingRule({ commit, state }, payload) {
    const currentRoute = JSON.parse(JSON.stringify(state.currentRoute))
    let routingRules = currentRoute.rules?.length ? JSON.parse(JSON.stringify(currentRoute.rules)) : []
    let routingRuleId = ''

    try {
      const resp = await OrderRoutingService.createRoutingRule(payload)

      if(!hasError(resp) && resp?.data.routingRuleId) {
        routingRuleId = resp.data.routingRuleId
        // Use the routingRuleId received in response, as we are passing empty routingRuleId in request
        routingRules.push({
          ...payload,
          routingRuleId
        })
        showToast(translate("Inventory rule created successfully"))

        // Sort the routings and update the state only on success
        if(routingRules.length) {
          routingRules = sortSequence(routingRules)
        }

        currentRoute["rules"] = routingRules
        commit(types.ORDER_ROUTING_CURRENT_ROUTE_UPDATED, currentRoute)
      }
    } catch(err) {
      showToast(translate("Failed to create inventory rule"))
      logger.error(err)
    }

    return routingRuleId;
  },

  async deleteRuleConditions({ dispatch }, payload) {
    // TODO: check if we can call request in parallel for delete operation
    let hasAllConditionsDeletedSuccessfully = true;
    try {
      for(const condition of payload.conditions) {
        const resp = await OrderRoutingService.deleteRuleCondition({
          routingRuleId: payload.routingRuleId,
          conditionSeqId: condition.conditionSeqId
        })
        if(hasError(resp) || !resp.data.conditionSeqId) {
          hasAllConditionsDeletedSuccessfully = false
        }
      }
    } catch(err) {
      logger.error(err);
    }

    return hasAllConditionsDeletedSuccessfully
  },

  async deleteRuleActions({ dispatch }, payload) {
    // TODO: check if we can call request in parallel for delete operation
    let hasAllActionsDeletedSuccessfully = true;
    try {
      for(const action of payload.actions) {
        const resp = await OrderRoutingService.deleteRuleAction({
          routingRuleId: payload.routingRuleId,
          actionSeqId: action.actionSeqId
        })
        if(hasError(resp) || !resp.data.actionSeqId) {
          hasAllActionsDeletedSuccessfully = false
        }
      }
    } catch(err) {
      logger.error(err)
    }

    return hasAllActionsDeletedSuccessfully
  },

  async fetchInventoryRuleInformation({ commit, state }, routingRuleId) {
    const rulesInformation = JSON.parse(JSON.stringify(state.rules))

    // Do not fetch the rule information if its already available in state. This condition will be false on refresh as state will be cleared so automatically updated information will be fetched
    // commented this, as after update we currently do not update state locally and fetch the information again for getting latest information
    // if(rulesInformation[routingRuleId]) {
    //   return rulesInformation[routingRuleId];
    // }

    try {
      const resp = await OrderRoutingService.fetchRule(routingRuleId)

      if(!hasError(resp) && resp.data.routingRuleId) {
        rulesInformation[routingRuleId] = resp.data

        if(rulesInformation[routingRuleId]["inventoryFilters"]?.length) {
          rulesInformation[routingRuleId]["inventoryFilters"] = sortSequence(rulesInformation[routingRuleId]["inventoryFilters"]).reduce((filters: any, filter: any) => {
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

    commit(types.ORDER_ROUTING_RULES_UPDATED, rulesInformation)
    return rulesInformation[routingRuleId] ? JSON.parse(JSON.stringify(rulesInformation[routingRuleId])) : {}
  },

  async updateRule({ dispatch }, payload) {
    let routingRuleId = ''
    try {
      const resp = await OrderRoutingService.updateRule(payload)

      if(!hasError(resp) && resp.data.routingRuleId) {
        routingRuleId = resp.data.routingRuleId
      }
    } catch(err) {
      logger.error("Failed to update rule conditions and actions")
    }

    return routingRuleId;
  },

  async clearRouting({ commit }) {
    commit(types.ORDER_ROUTING_CLEARED)
  },

  async clearRules({ commit }) {
    commit(types.ORDER_ROUTING_RULES_UPDATED, {})
  },

  async updateGroupStatus({ commit, state }, payload) {
    const routingGroups = JSON.parse(JSON.stringify(state.groups))
    const routingGroup = routingGroups.find((routingGroup: any) => routingGroup.routingGroupId === payload.routingGroupId)
    routingGroup["schedule"]["paused"] = payload.value
    commit(types.ORDER_ROUTING_GROUPS_UPDATED, routingGroups)
    return routingGroups
  }
}

export default actions;