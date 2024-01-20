import { GetterTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import RootState from "@/store/RootState"
import { Group, Route } from "@/types"

const getters: GetterTree<OrderRoutingState, RootState> = {
  getRoutingGroups(state) {
    return state.groups
  },
  getOrderRoutings(state) {
    return state.routes
  },
  getRoutingRules(state) {
    return state.rules
  },
  getCurrentRoutingGroup(state) {
    return JSON.parse(JSON.stringify(state.currentGroup))
  },
  getCurrentOrderRouting(state) {
    const orderRouting = state.routes?.find((route: Route) => route.orderRoutingId === state.currentRouteId)
    return orderRouting ? orderRouting : {}
  },
  getCurrentRouteFilters(state) {
    return state.currentRouteFilters
  },
  getRuleConditions(state) {
    return JSON.parse(JSON.stringify(state.ruleConditions))
  },
  getRuleActions(state) {
    return JSON.parse(JSON.stringify(state.ruleActions))
  }
}

export default getters;