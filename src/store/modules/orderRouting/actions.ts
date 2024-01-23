import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import OrderRoutingState from "./OrderRoutingState"
import { OrderRoutingService } from "@/services/RoutingService"
import { hasError, showToast, sortSequence } from "@/utils"
import * as types from './mutation-types'
import logger from "@/logger"
import { Route, RouteFilter } from "@/types"

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
      productStoreId: "STORE"
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

  async updateRoutingGroup({ commit, state }, payload) {
    const current = JSON.parse(JSON.stringify(state.currentGroup))

    const params = {
      routingGroupId: payload.routingGroupId,
      [payload.fieldToUpdate]: payload.value
    }

    try {
      const resp = await OrderRoutingService.updateRoutingGroup(params);

      if(!hasError(resp) && resp.data.routingGroupId) {
        current[payload.fieldToUpdate] = payload.value
        showToast("Rounting group information updated")
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }
    commit(types.ORDER_ROUTING_CURRENT_GROUP_UPDATED, current)
  },

  async fetchCurrentRoutingGroup({ dispatch, state }, routingGroupId) {
    const current = state.currentGroup
    if(current.routingGroupId && current.routingGroupId === routingGroupId) {
      dispatch("setCurrentRoutingGroup", current)
      return;
    }

    let currentGroup = {}

    try {
      const resp = await OrderRoutingService.fetchRoutingGroup(routingGroupId);

      if(!hasError(resp) && resp.data) {
        currentGroup = resp.data
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    dispatch("setCurrentRoutingGroup", currentGroup)
  },

  async setCurrentRoutingGroup({ commit }, payload) {
    commit(types.ORDER_ROUTING_CURRENT_GROUP_UPDATED, payload)
  },

  async fetchOrderRoutings({ commit }, routingGroupId) {
    let orderRoutings = [] as any;
    // filter groups on the basis of productStoreId
    const payload = {
      routingGroupId
    }

    try {
      const resp = await OrderRoutingService.fetchOrderRoutings(payload);

      if(!hasError(resp) && resp.data.length) {
        orderRoutings = resp.data
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    if(orderRoutings.length) {
      orderRoutings = sortSequence(orderRoutings)
    }

    commit(types.ORDER_ROUTINGS_UPDATED, orderRoutings)
  },

  async createOrderRouting({ commit, state }, payload) {
    let orderRoutings = JSON.parse(JSON.stringify(state.routes))
    let orderRoutingId = ''

    try {
      const resp = await OrderRoutingService.createOrderRouting(payload)

      if(!hasError(resp) && resp?.data.orderRoutingId) {
        orderRoutingId = resp.data.orderRoutingId
        orderRoutings.push({
          ...payload,
          orderRoutingId
        })
        showToast('New Order Routing Created')
      }

      // Sort the routings and update the state only on success
      if(orderRoutings.length) {
        orderRoutings = sortSequence(orderRoutings)
      }

      commit(types.ORDER_ROUTINGS_UPDATED, orderRoutings)
    } catch(err) {
      showToast("Failed to create order routing")
      logger.error('err', err)
    }

    return orderRoutingId;
  },

  async updateOrderRouting({ commit, state }, payload) {
    let orderRoutings = JSON.parse(JSON.stringify(state.routes))
    const field: Route[keyof Route] = payload.fieldToUpdate
    let orderRoutingId = ''

    const params = {
      orderRoutingId: payload.orderRoutingId,
      [field]: payload.value  // only one field can be updated once for orderRouting
    }

    try {
      const resp = await OrderRoutingService.updateOrderRouting(params);

      if(!hasError(resp) && resp.data.orderRoutingId) {
        orderRoutingId = resp.data.orderRoutingId
        orderRoutings.map((routing: Route) => {
          if(routing.orderRoutingId === orderRoutingId) {
            routing[field] = payload.value
          }
        })
        showToast("Order routing information updated")
      } else {
        throw resp.data
      }
    } catch(err) {
      showToast("Failed to update order routing")
      logger.error(err);
    }

    if(orderRoutings.length) {
      orderRoutings = sortSequence(orderRoutings)
    }

    commit(types.ORDER_ROUTINGS_UPDATED, orderRoutings)
    return orderRoutingId;
  },

  async fetchCurrentOrderRouting({ dispatch, state }, orderRoutingId) {
    const current = state.currentRoute
    if(current.orderRoutingId && current.orderRoutingId === orderRoutingId) {
      dispatch("setCurrentOrderRouting", current)
      return;
    }

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
        routingRules.push({
          ...payload,
          routingRuleId
        })
        showToast('New Inventory Rule Created')
      }

      // Sort the routings and update the state only on success
      if(routingRules.length) {
        routingRules = sortSequence(routingRules)
      }

      commit(types.ORDER_ROUTINGS_UPDATED, routingRules)
    } catch(err) {
      showToast("Failed to create rule")
      logger.error('err', err)
    }

    return routingRuleId;
  },

  async fetchRoutingFilters({ commit }, orderRoutingId) {
    let routingFilters = [] as any;
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

  async fetchRuleConditions({ commit }, routingRuleId) {
    let ruleConditions = [] as any;
    // filter groups on the basis of productStoreId
    const payload = {
      routingRuleId
    }

    try {
      const resp = await OrderRoutingService.fetchRuleConditions(payload);

      if(!hasError(resp) && resp.data.length) {
        ruleConditions = resp.data
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }

    commit(types.ORDER_ROUTING_RULE_CONDITIONS_UPDATED, ruleConditions)
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