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
    rules: [],
    currentGroupId: '', // choosing only to save id and not whole object, as when updating the state we don't need to care updating the state on two different places
    currentRouteId: '',
    currentRouteFilters: {}
  },
  getters,
  actions,
  mutations,
}

export default orderRoutingModule;