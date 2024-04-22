import { UserService } from "@/services/UserService"
import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import UserState from "./UserState"
import * as types from "./mutation-types"
import { showToast } from "@/utils"
import { translate } from "@/i18n"
import logger from "@/logger"
import emitter from "@/event-bus"
import { Settings } from "luxon"
import { useAuthStore } from '@hotwax/dxp-components'
import { logout, resetConfig, updateInstanceUrl, updateToken } from '@/adapter'

const actions: ActionTree<UserState, RootState> = {

  /**
  * Login user and return token
  */
  async login({ commit, dispatch }, payload) {
    try {
      // TODO: implement support for permission check

      // TODO: oms here is of ofbiz we need to check how to get the maarg url from here as we need to hit all apis on maarg
      const { token, oms } = payload;
      dispatch("setUserInstanceUrl", oms);

      emitter.emit("presentLoader", { message: "Logging in...", backdropDismiss: false })
      const userProfile = await UserService.getUserProfile(token);

      // TODO: fetch only associated product stores for user, currently api does not support this
      userProfile.stores = await UserService.getEComStores(token);

      if (userProfile.timeZone) {
        Settings.defaultZone = userProfile.timeZone;
      }

      updateToken(token)

      commit(types.USER_TOKEN_CHANGED, { newToken: token })
      commit(types.USER_INFO_UPDATED, userProfile);
      commit(types.USER_CURRENT_ECOM_STORE_UPDATED, userProfile.stores.length ? userProfile.stores[0] : {});
      emitter.emit("dismissLoader")
      return Promise.resolve({ token })
    } catch (err: any) {
      emitter.emit("dismissLoader")
      showToast(translate(err));
      logger.error("error", err);
      return Promise.reject(new Error(err))
    }
  },

  /**
  * Logout user
  */
  async logout ({ commit }, payload) {
    // store the url on which we need to redirect the user after logout api completes in case of SSO enabled
    let redirectionUrl = ''

    emitter.emit('presentLoader', { message: 'Logging out', backdropDismiss: false })

    // Calling the logout api to flag the user as logged out, only when user is authorised
    // if the user is already unauthorised then not calling the logout api as it returns 401 again that results in a loop, thus there is no need to call logout api if the user is unauthorised
    if(!payload?.isUserUnauthorised) {
      let resp;

      // wrapping the parsing logic in try catch as in some case the logout api makes redirection, and then we are unable to parse the resp and thus the logout process halts
      try {
        resp = await logout();

        // Added logic to remove the `//` from the resp as in case of get request we are having the extra characters and in case of post we are having 403
        resp = JSON.parse(resp.startsWith('//') ? resp.replace('//', '') : resp)
      } catch(err) {
        console.error('Error parsing data', err)
      }

      if(resp?.logoutAuthType == 'SAML2SSO') {
        redirectionUrl = resp.logoutUrl
      }
    }

    const authStore = useAuthStore()

    // TODO add any other tasks if need
    commit(types.USER_END_SESSION)
    this.dispatch("orderRouting/clearRouting")
    this.dispatch("util/clearUtilState")
    resetConfig();

    // reset plugin state on logout
    authStore.$reset()

    // If we get any url in logout api resp then we will redirect the user to the url
    if(redirectionUrl) {
      window.location.href = redirectionUrl
    }

    emitter.emit('dismissLoader')
    return redirectionUrl;
  },
  
  /**
  * Update user timeZone
  */
  async setUserTimeZone({ state, commit }, payload) {
    const current: any = state.current;
    // TODO: add support to change the user time on server, currently api to update user is not available
    if(current.timeZone !== payload.tzId) {
      current.timeZone = payload.tzId;
      commit(types.USER_INFO_UPDATED, current);
      Settings.defaultZone = current.timeZone;
      showToast(translate("Time zone updated successfully"));
    }
  },

  /**
  * Set User Instance Url
  */
  setUserInstanceUrl({ commit }, payload) {
    const maargUrl = payload.includes("dev-oms") ? JSON.parse(process.env.VUE_APP_MAARG_URL)["dev-oms"] : "dev-maarg"
    commit(types.USER_INSTANCE_URL_UPDATED, maargUrl)
  },

  setEcomStore({ commit, state }, payload) {
    let productStore = payload.productStore;
    if(!productStore) {
      productStore = (state.current as any).stores.find((store: any) => store.productStoreId === payload.productStoreId);
    }
    commit(types.USER_CURRENT_ECOM_STORE_UPDATED, productStore);
    this.dispatch("util/updateShippingMethods", {})
    this.dispatch("util/updateFacillityGroups", {})
  }
}

export default actions;