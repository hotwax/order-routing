import { GetterTree } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import RootState from "@/store/RootState"

const getters: GetterTree<OrderRoutingState, RootState> = {
  getRoutingGroups(state) {
    return state.groups
  },
  getOrderRoutings(state) {
    return state.routes
  }
}

export default getters;