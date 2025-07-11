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
  [types.ORDER_ROUTING_HISTORY_UPDATED](state, payload) {
    state.routingHistory = payload
  },
  [types.ORDER_ROUTING_CURRENT_RULE_UPDATED](state, payload) {
    state.currentRuleId = payload
  },
  [types.ORDER_ROUTING_CLEARED](state) {
    state.groups = []
    state.rules = {}
    state.currentGroup = {}
    state.currentRoute = {}
    state.routingHistory = {}
  },
  [types.ORDER_ROUTING_TEST_UPDATED](state, payload) {
    state.testRouting[payload.key] = payload.value
  },
  [types.ORDER_ROUTING_TEST_CLEARED](state, payload) {
    state.testRouting = {
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
      ...payload
    }
  }
}
export default mutations;