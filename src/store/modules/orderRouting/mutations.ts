import { MutationTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import * as types from "./mutation-types"

const mutations: MutationTree<OrderRoutingState> = {
  [types.ORDER_ROUTING_GROUPS_UPDATED](state, payload) {
    state.groups = payload
  },
  [types.ORDER_ROUTINGS_UPDATED](state, payload) {
    state.routes = payload
  },
  [types.ORDER_ROUTING_RULES_UPDATED](state, payload) {
    state.rules = payload
  },
  [types.ORDER_ROUTING_CURRENT_GROUP_UPDATED](state, payload) {
    state.currentGroup = payload
  },
  [types.ORDER_ROUTING_CURRENT_ROUTE_UPDATED](state, routeId) {
    state.currentRouteId = routeId
  },
  [types.ORDER_ROUTING_FILTERS_UPDATED](state, payload) {
    state.currentRouteFilters = payload
  },
  [types.ORDER_ROUTING_RULE_CONDITIONS_UPDATED](state, payload) {
    state.ruleConditions = payload
  },
  [types.ORDER_ROUTING_RULE_ACTIONS_UPDATED](state, payload) {
    state.ruleActions = payload
  }
}
export default mutations;