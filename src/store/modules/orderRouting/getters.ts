import { GetterTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import RootState from "@/store/RootState"

const getters: GetterTree<OrderRoutingState, RootState> = {
  getRoutingGroups(state) {
    return state.groups
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
  getRoutingHistory(state) {
    return JSON.parse(JSON.stringify(state.routingHistory))
  },
  getCurrentRuleId(state) {
    return state.currentRuleId
  },
  getTemporalExpr: (state) => (id: string): any  => {
    return state.temporalExp[id];
  }
}

export default getters;