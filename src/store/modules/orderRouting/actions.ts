import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import OrderRoutingState from "./OrderRoutingState"
import { OrderRoutingService } from "@/services/RoutingService"
import { hasError, showToast, sortSequence } from "@/utils"
import * as types from './mutation-types'
import logger from "@/logger"
import { DateTime } from "luxon"

const actions: ActionTree<OrderRoutingState, RootState> = {
  async fetchOrderRoutingGroups({ commit }) {
    let routingGroups = [] as any;
    // filter groups on the basis of productStoreId
    const payload = {}

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
      routingGroups = sortSequence(routingGroups)
    }

    commit(types.ORDER_ROUTING_GROUPS_UPDATED, routingGroups)
  },

  async createRoutingGroup({ dispatch }, groupName) {
    const payload = {
      groupName,
      productStoreId: "STORE",
      createdDate: DateTime.now().toMillis()
    }
    try {
      const resp = await OrderRoutingService.createRoutingGroup(payload)

      if(!hasError(resp)) {
        showToast('Brokering run created')
        dispatch("fetchOrderRoutingGroups")
      }
    } catch(err) {
      showToast("Failed to create brokering run")
      logger.error('err', err)
    }
  },

  async fetchCurrentRoutingGroup({ commit }, routingGroupId) {
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

    commit(types.ORDER_ROUTING_CURRENT_GROUP_UPDATED, currentGroup)
  },

  async setCurrentGroup({ commit }, currentGroup) {
    commit(types.ORDER_ROUTING_CURRENT_GROUP_UPDATED, currentGroup)
  },

  async createOrderRouting({ dispatch, state }, payload) {
    const currentGroup = JSON.parse(JSON.stringify(state.currentGroup))
    let orderRoutingId = ''

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
        showToast('New routing created')
      }

      if(currentGroup["routings"].length) {
        currentGroup["routings"] = sortSequence(currentGroup["routings"])
      }

      await dispatch("setCurrentGroup", currentGroup)
    } catch(err) {
      showToast("Failed to create order routing")
      logger.error('err', err)
    }

    return orderRoutingId;
  },

  async fetchCurrentOrderRouting({ dispatch }, orderRoutingId) {
    let currentRoute = {}

    try {
      const resp = await OrderRoutingService.fetchOrderRouting(orderRoutingId);

      if(!hasError(resp) && resp.data) {
        currentRoute = resp.data
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

  async createRoutingRule({ commit, state }, payload) {
    const currentRoute = JSON.parse(JSON.stringify(state.currentRoute))
    let routingRules = currentRoute.rules?.length ? currentRoute.rules : []
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
        showToast('New Inventory Rule Created')

        // Sort the routings and update the state only on success
        if(routingRules.length) {
          routingRules = sortSequence(routingRules)
        }

        commit(types.ORDER_ROUTING_CURRENT_ROUTE_UPDATED, currentRoute)
      }
    } catch(err) {
      showToast("Failed to create rule")
      logger.error('err', err)
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
    if(rulesInformation[routingRuleId]) {
      return rulesInformation[routingRuleId];
    }

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
    return JSON.parse(JSON.stringify(rulesInformation[routingRuleId]))
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
  }
}

export default actions;