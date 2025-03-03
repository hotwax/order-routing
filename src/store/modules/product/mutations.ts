import { MutationTree } from "vuex"
import ProductState from "./ProductState"
import * as types from "./mutation-types"

const mutations: MutationTree<ProductState> = {
  [types.PRODUCT_LIST_UPDATED](state, payload) {
    state.products = payload
  },
  [types.PRODUCT_CLEARED](state) {
    state.products = {}
  },
  [types.PRODUCT_STOCK_UPDATED] (state, payload) {
    if(state.stock[payload.productId]) {
      state.stock[payload.productId][payload.facilityId] = payload.stock
    } else {
      state.stock[payload.productId] = {
        [payload.facilityId]: payload.stock
      }
    }
  },
}
export default mutations;