import { GetterTree } from "vuex"
import ProductState from "./ProductState"
import RootState from "@/store/RootState"

const getters: GetterTree<ProductState, RootState> = {
  getProducts(state) {
    return state.products
  },
  getProductById: (state) => (id: string) => {
    console.log('id', id)
    return state.products[id] || {}
  },
  getProductStock: (state) => (productId: string, facilityId: string) => {
    return state.stock[productId] ? state.stock[productId][facilityId] ? state.stock[productId][facilityId] : {} : {}
  },
}

export default getters;