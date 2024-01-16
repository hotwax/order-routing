import { GetterTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import RootState from "@/store/RootState"
import { Group } from "@/types"

const getters: GetterTree<OrderRoutingState, RootState> = {
  getRoutingGroups(state) {
    return state.groups
  },
  getOrderRoutings(state) {
    return state.routes
  },
  getCurrentRoutingGroup(state) {
    const currentRoutingGroup = state.groups?.find((group: Group) => group.routingGroupId === state.currentGroupId)
    return currentRoutingGroup ? currentRoutingGroup : {}
  }
}

export default getters;