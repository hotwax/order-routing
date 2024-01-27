import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import OrderRoutingState from "./OrderRoutingState"
import { OrderRoutingService } from "@/services/RoutingService"
import { hasError, showToast, sortSequence } from "@/utils"
import * as types from './mutation-types'
import logger from "@/logger"
import { RouteFilter } from "@/types"
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

  async setCurrentGroup({ commit }, currentGroup) {
    commit(types.ORDER_ROUTING_CURRENT_GROUP_UPDATED, currentGroup)
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

  async fetchRoutingRules({ commit }, orderRoutingId) {
    let routingRules = [] as any;
    // filter groups on the basis of productStoreId
    const payload = {
      orderRoutingId
    }

    try {
      const resp = await OrderRoutingService.fetchRoutingRules(payload);

      if(!hasError(resp) && resp.data.length) {
        routingRules = resp.data
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    if(routingRules.length) {
      routingRules = sortSequence(routingRules)
    }

    commit(types.ORDER_ROUTING_RULES_UPDATED, routingRules)
  },

  async createRoutingRule({ commit, state }, payload) {
    let routingRules = JSON.parse(JSON.stringify(state.rules))
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

        commit(types.ORDER_ROUTINGS_UPDATED, routingRules)
      }
    } catch(err) {
      showToast("Failed to create rule")
      logger.error('err', err)
    }

    return routingRuleId;
  },

  async fetchRoutingFilters({ commit }, orderRoutingId) {
    let routingFilters = {} as any;
    // filter groups on the basis of productStoreId
    const payload = {
      orderRoutingId
    }

    try {
      const resp = await OrderRoutingService.fetchRoutingFilters(payload);

      if(!hasError(resp) && resp.data.length) {
        routingFilters = resp.data.reduce((filters: any, filter: RouteFilter) => {
          if(filters[filter.conditionTypeEnumId]) {
            filters[filter.conditionTypeEnumId][filter.fieldName] = filter
          } else {
            filters[filter.conditionTypeEnumId] = {
              [filter.fieldName]: filter
            }
          }
          return filters
        }, {})
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    const sortEnum = "ENTCT_SORT_BY"

    // As we only need to add support of reordering for sortBy filter
    if(routingFilters[sortEnum]?.length) {
      routingFilters[sortEnum] = sortSequence(routingFilters[sortEnum])
    }

    commit(types.ORDER_ROUTING_FILTERS_UPDATED, routingFilters)
  },

  async deleteRoutingFilters({ dispatch }, payload) {
    let hasAllFiltersDeletedSuccessfully = true;
    try {
      // We can't make parallel api calls, as discussed hence using forEach loop to make api calls
      await payload.filters.forEach(async (filter: any) => {
        const resp = await OrderRoutingService.deleteRoutingFilter({
          orderRoutingId: payload.orderRoutingId,
          conditionSeqId: filter.conditionSeqId
        });
        if(hasError(resp) || !resp.data.orderRoutingId) {
          hasAllFiltersDeletedSuccessfully = false
        }
      });
    } catch(err) {
      logger.error(err);
    }

    dispatch("fetchRoutingFilters", payload.orderRoutingId)

    return hasAllFiltersDeletedSuccessfully
  },

  async createRoutingFilters({ dispatch }, payload) {
    // TODO: check if we can call request in parallel for create operation
    let hasAllFiltersCreatedSuccessfully = true;
    try {
      await payload.filters.forEach(async (filter: any) => {
        const resp = await OrderRoutingService.updateRoutingFilter({
          orderRoutingId: payload.orderRoutingId,
          ...filter
        });
        if(hasError(resp) || !resp.data.orderRoutingId) {
          hasAllFiltersCreatedSuccessfully = false
        }
      });
    } catch(err) {
      logger.error(err);
    }

    dispatch("fetchRoutingFilters", payload.orderRoutingId)
    return hasAllFiltersCreatedSuccessfully
  },

  async fetchRuleConditions({ commit }, routingRuleId) {
    let ruleConditions = {} as any;
    // filter groups on the basis of productStoreId
    const payload = {
      routingRuleId
    }

    try {
      const resp = await OrderRoutingService.fetchRuleConditions(payload);

      if(!hasError(resp) && resp.data.length) {
        ruleConditions = resp.data.reduce((conditions: any, condition: any) => {
          if(conditions[condition.conditionTypeEnumId]) {
            conditions[condition.conditionTypeEnumId][condition.fieldName] = condition
          } else {
            conditions[condition.conditionTypeEnumId] = {
              [condition.fieldName]: condition
            }
          }
          return conditions
        }, {})
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    const sortEnum = "ENTCT_SORT_BY"

    // As we only need to add support of reordering for sortBy filter
    if(ruleConditions[sortEnum]?.length) {
      ruleConditions[sortEnum] = sortSequence(ruleConditions[sortEnum])
    }

    commit(types.ORDER_ROUTING_RULE_CONDITIONS_UPDATED, ruleConditions)
  },

  async deleteRuleConditions({ dispatch }, payload) {
    // TODO: check if we can call request in parallel for delete operation
    let hasAllConditionsDeletedSuccessfully = true;
    try {
      await payload.conditions.forEach(async (condition: any) => {
        const resp = await OrderRoutingService.deleteRuleCondition({
          routingRuleId: payload.routingRuleId,
          conditionSeqId: condition.conditionSeqId
        });
        if(hasError(resp) || !resp.data.conditionSeqId) {
          hasAllConditionsDeletedSuccessfully = false
        }
      });
    } catch(err) {
      logger.error(err);
    }

    dispatch("fetchRuleConditions", payload.routingRuleId)

    return hasAllConditionsDeletedSuccessfully
  },

  async createRuleConditions({ dispatch }, payload) {
    let hasAllConditionsCreatedSuccessfully = true;
    try {
      await payload.conditions.forEach(async (condition: any) => {
        const resp = await OrderRoutingService.createRuleCondition({
          routingRuleId: payload.routingRuleId,
          ...condition
        });
        if(!hasError(resp) || !resp.data.conditionSeqId) {
          hasAllConditionsCreatedSuccessfully = false
        }
      });
    } catch(err) {
      logger.error(err);
    }

    // TODO: check if we can call the action only once after all the operations are success
    dispatch("fetchRuleConditions", payload.routingRuleId)
    return hasAllConditionsCreatedSuccessfully
  },

  async fetchRuleActions({ commit }, routingRuleId) {
    let ruleActions = {} as any;
    const payload = {
      routingRuleId
    }

    try {
      const resp = await OrderRoutingService.fetchRuleActions(payload);

      if(!hasError(resp) && resp.data.length) {
        ruleActions = resp.data.reduce((actions: any, action: any) => {
          // considering that only one value for an action is available
          actions[action.actionTypeEnumId] = action
          return actions
        }, {})
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    commit(types.ORDER_ROUTING_RULE_ACTIONS_UPDATED, ruleActions)
  },

}

export default actions;