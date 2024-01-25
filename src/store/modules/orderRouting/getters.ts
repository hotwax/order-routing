import { GetterTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import RootState from "@/store/RootState"

const getters: GetterTree<OrderRoutingState, RootState> = {
  getRoutingGroups(state) {
    return state.groups
  },
  getOrderRoutings(state) {
    return state.routes
  },
  getRoutingRules(state) {
    return JSON.parse(JSON.stringify(state.rules))
  },
  getCurrentRoutingGroup(state) {
    return JSON.parse(JSON.stringify(state.currentGroup))
  },
  getCurrentOrderRouting(state) {
    return JSON.parse(JSON.stringify(state.currentRoute))
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