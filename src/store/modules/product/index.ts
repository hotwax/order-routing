import actions from "./actions"
import getters from "./getters"
import mutations from "./mutations"
import { Module } from "vuex"
import ProductState from "./ProductState"
import RootState from "@/store/RootState"

const productModule: Module<ProductState, RootState> = {
  namespaced: true,
  state: {
    products: {},
    stock: {}
  },
  getters,
  actions,
  mutations,
}

export default productModule;