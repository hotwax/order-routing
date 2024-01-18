import { GetterTree } from "vuex"
import UtilState from "./UtilState"
import RootState from "@/store/RootState"

const getters: GetterTree<UtilState, RootState> = {
  getEnums(state) {
    return state.enums
  },
  getFacilities(state) {
    return state.facilities
  }
}

export default getters;