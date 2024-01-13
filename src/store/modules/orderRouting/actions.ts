import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import OrderRoutingState from "./OrderRoutingState"
import { OrderRoutingService } from "@/services/RoutingService"
import { hasError } from "@/utils"
import * as types from './mutation-types'

const actions: ActionTree<OrderRoutingState, RootState> = {
  async fetchOrderRoutingGroups({ commit }) {
    const routingGroups = [] as any;
    const payload = {}

    try {
      const resp = await OrderRoutingService.fetchRoutingGroups(payload);

      if(!hasError(resp)) {
        console.log('resp', resp)
      } else {
        throw resp.data
      }
    } catch(err) {
      console.log(err);
    }

    commit(types.ORDER_ROUTING_GROUPS_UPDATED, routingGroups)
  }
}

export default actions;