import { GetterTree } from "vuex"
import UtilState from "./UtilState"
import RootState from "@/store/RootState"

const getters: GetterTree<UtilState, RootState> = {
  getEnums(state) {
    return state.enums
  },
  getFacilities(state) {
    return state.facilities
  },
  getShippingMethods(state) {
    return state.shippingMethods
  },
  getFacilityGroups(state) {
    return state.facilityGroups
  },
  isOmsConnectionExist(state) {
    return state.isOmsConnectionExist
  },
  getStatusDesc: (state) => (id: any) => {
    return state.statuses[id]?.description ? state.statuses[id]?.description : id
  }
}

export default getters;