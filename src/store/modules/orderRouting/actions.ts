import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import OrderRoutingState from "./OrderRoutingState"
import { OrderRoutingService } from "@/services/RoutingService"
import { hasError, sortSequence } from "@/utils"
import * as types from './mutation-types'

const actions: ActionTree<OrderRoutingState, RootState> = {
  async fetchOrderRoutingGroups({ commit }) {
    let routingGroups = [] as any;
    // filter groups on the basis of productStoreId
    const payload = {}

    try {
      const resp = await OrderRoutingService.fetchRoutingGroups(payload);

      if(!hasError(resp) && resp.data.length) {
        routingGroups = resp.data
      } else {
        throw resp.data
      }
    } catch(err) {
      console.log(err);
    }

    if(routingGroups.length) {
      routingGroups = sortSequence(routingGroups)
    }

    commit(types.ORDER_ROUTING_GROUPS_UPDATED, routingGroups)
  }
}

export default actions;