import actions from "./actions"
import getters from "./getters"
import mutations from "./mutations"
import { Module } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import RootState from "@/store/RootState"

const orderRoutingModule: Module<OrderRoutingState, RootState> = {
  namespaced: true,
  state: {
    groups: [],
    routes: [],
    rule: [],
    currentGroupId: '',
    currentRouteId: ''
  },
  getters,
  actions,
  mutations,
}

export default orderRoutingModule;