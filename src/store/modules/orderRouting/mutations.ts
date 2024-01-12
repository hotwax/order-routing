import { MutationTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import * as types from "./mutation-types"

const mutations: MutationTree<OrderRoutingState> = {
  [types.ORDER_ROUTING_GROUPS_UPDATED](state, payload) {
    state.groups = payload
  },
  [types.ORDER_ROUTING_ROUTES_UPDATED](state, payload) {
    state.routes = payload
  },
  [types.ORDER_ROUTING_RULE_UPDATED](state, payload) {
    state.rule = payload
  },
  [types.ORDER_ROUTING_CURRENT_GROUP_UPDATED](state, groupId) {
    state.currentGroupId = groupId
  },
  [types.ORDER_ROUTING_CURRENT_ROUTE_UPDATED](state, routeId) {
    state.currentRouteId = routeId
  }
}
export default mutations;