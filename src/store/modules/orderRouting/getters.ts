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
    const currentRoutingGroup = state.groups?.find((group: Group) => group.routingGroupId === state.currentGroupId)
    return currentRoutingGroup ? currentRoutingGroup : {}
  },
  getCurrentOrderRouting(state) {
    const orderRouting = state.routes?.find((route: Route) => route.orderRoutingId === state.currentRouteId)
    return orderRouting ? orderRouting : {}
  }
}

export default getters;