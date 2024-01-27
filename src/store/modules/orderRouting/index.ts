import actions from "./actions"
import getters from "./getters"
import mutations from "./mutations"
import { Module } from "vuex"
import OrderRoutingState from "./OrderRoutingState"
import RootState from "@/store/RootState"
import { Route } from "@/types"

const orderRoutingModule: Module<OrderRoutingState, RootState> = {
  namespaced: true,
  state: {
    groups: [],
    routes: [],
    rules: {},
    currentGroup: {},
    currentRoute: {},
    currentRouteFilters: {},
    ruleConditions: {},
    ruleActions: {}
  },
  getters,
  actions,
  mutations,
}

export default orderRoutingModule;