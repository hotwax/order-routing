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
    rules: {},
    currentGroup: {},
    currentRoute: {},
    routingHistory: {},
    currentRuleId: "",
    testRouting: {
      currentOrderId: "",
      currentOrder: {},
      currentShipGroupId: "",
      errorMessage: "",
      brokeringDesicionReason: "",
      isOrderBrokered: false,
      hasUnmatchedFilters: false,
      isOrderAlreadyBrokered: false,
      brokeringRoute: "",
      brokeringRule: "",
      eligibleOrderRoutings: [],
      selectedRuleId: "",
      unmatchedOrderFilters: [],
      isRoutingTestEnabled: false
    }
  },
  getters,
  actions,
  mutations,
}

export default orderRoutingModule;