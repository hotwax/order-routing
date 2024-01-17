import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import OrderRoutingState from "./OrderRoutingState"
import { OrderRoutingService } from "@/services/RoutingService"
import { hasError, showToast, sortSequence } from "@/utils"
import * as types from './mutation-types'
import logger from "@/logger"

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

  async setCurrentRoutingGroupId({ commit }, payload) {
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

  async setCurrentOrderRoutingId({ commit }, payload) {
    commit(types.ORDER_ROUTING_CURRENT_ROUTE_UPDATED, payload)
  },
}

export default actions;