import { GetterTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import RootState from "@/store/RootState"

const getters: GetterTree<OrderRoutingState, RootState> = {
  getRoutingGroups(state) {
    return state.groups
  },
  getRoutingRules(state) {
    return state.currentGroup["rules"] ? JSON.parse(JSON.stringify(state.currentGroup["rules"])) : []
  },
  getRulesInformation(state) {
    return state.rules
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