import { GetterTree } from "vuex"
import UserState from "./UserState"
import RootState from "@/store/RootState"

const getters: GetterTree <UserState, RootState> = {
  isAuthenticated(state) {
    return !!state.token;
  },
  isUserAuthenticated(state) {
    return state.token && state.current
  },
  getUserToken(state) {
    return state.token
  },
  getUserProfile(state) {
    return state.current
  },
  getInstanceUrl(state) {
    return state.instanceUrl;
  },
  getCurrentEComStore(state) {
    return state.currentEComStore
  },
  getBaseUrl (state) {
    let baseURL = process.env.VUE_APP_BASE_URL;
    if (!baseURL) baseURL = state.instanceUrl;
    return baseURL.startsWith('http') ? baseURL.includes('/api') ? baseURL : `${baseURL}/api/` : `https://${baseURL}.hotwax.io/api/`;
  },
  getUserPermissions (state) {
    return state.permissions;
  },
}
export default getters;