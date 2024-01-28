import { MutationTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import * as types from "./mutation-types"

const mutations: MutationTree<OrderRoutingState> = {
  [types.ORDER_ROUTING_GROUPS_UPDATED](state, payload) {
    state.groups = payload
  },
  [types.ORDER_ROUTING_RULES_UPDATED](state, payload) {
    state.rules = payload
  },
  [types.ORDER_ROUTING_CURRENT_GROUP_UPDATED](state, payload) {
    state.currentGroup = payload
  },
  [types.ORDER_ROUTING_CURRENT_ROUTE_UPDATED](state, payload) {
    state.currentRoute = payload
  },
}
export default mutations;