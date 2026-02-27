import { defineStore } from 'pinia'
import { UserService } from "@/services/UserService"
import { commonUtil } from "@/utils/commonUtil"
import { translate } from "@/i18n"
import logger from "@/logger"
import emitter from "@/event-bus"
import { Settings } from "luxon"
import { useAuthStore } from '@hotwax/dxp-components'
import { resetConfig } from '@/adapter'
import { getServerPermissionsFromRules, prepareAppPermissions, resetPermissions, setPermissions } from "@/authorization"
import { useProductStore } from './useProductStore'
import { useUtilStore } from './useUtilStore'
import { useOrderRoutingStore } from './useOrderRoutingStore'

export const useUserStore = defineStore('appUser', {
  state: () => {
    return {
      token: "",
      current: null as any,
      instanceUrl: "",
      currentEComStore: {} as any,
      omsRedirectionInfo: {
        url: "",
        token: ""
      },
      permissions: [] as any
    }
  },
  getters: {
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
    getBaseUrl(state) {
      const baseURL = state.instanceUrl;
      return baseURL.startsWith("http") ? baseURL : `https://${baseURL}.hotwax.io/rest/s1/order-routing/`;
    },
    getOmsRedirectionInfo(state) {
      return state.omsRedirectionInfo;
    },
    getUserPermissions (state) {
      return state.permissions;
    },
  },
  actions: {
    setUserInstanceUrl(payload: string) {
      this.instanceUrl = payload;
    },
    setOmsRedirectionInfo(payload: { url: string, token: string }) {
      this.omsRedirectionInfo = payload;
    },
    async login(payload: any) {
      try {
        const { token, oms, omsRedirectionUrl } = payload;
        this.setUserInstanceUrl(oms);
        
        const permissionId = process.env.VUE_APP_PERMISSION_ID;
        const serverPermissionsFromRules = getServerPermissionsFromRules();
        if (permissionId) serverPermissionsFromRules.push(permissionId);
        
        const serverPermissions: Array<string> = await UserService.getUserPermissions({
          permissionIds: [...new Set(serverPermissionsFromRules)]
        }, omsRedirectionUrl, token);
        const appPermissions = prepareAppPermissions(serverPermissions);
        
        if (permissionId) {
          const hasPermission = appPermissions.some((appPermission: any) => appPermission.action === permissionId );
          if (!hasPermission) {
            const permissionError = 'You do not have permission to access the app.';
            commonUtil.showToast(translate(permissionError));
            logger.error("error", permissionError);
            return Promise.reject(new Error(permissionError));
          }
        }
        
        emitter.emit("presentLoader", { message: "Logging in...", backdropDismiss: false })
        const api_key = await UserService.login(token)
        const userProfile = await UserService.getUserProfile(api_key);
        
        userProfile.stores = await UserService.getEComStores(api_key);
        
        if (userProfile.timeZone) {
          Settings.defaultZone = userProfile.timeZone;
        }
        
        if(omsRedirectionUrl && token) {
          this.setOmsRedirectionInfo({ url: omsRedirectionUrl, token })
        }
        setPermissions(appPermissions);
        this.permissions = appPermissions;
        this.token = api_key;
        this.current = userProfile;
        this.currentEComStore = userProfile.stores.length ? userProfile.stores[0] : {};
        emitter.emit("dismissLoader")
      } catch (err: any) {
        emitter.emit("dismissLoader")
        commonUtil.showToast(translate(err));
        logger.error("error", err);
        return Promise.reject(new Error(err))
      }
    },
    async logout() {
      emitter.emit('presentLoader', { message: 'Logging out', backdropDismiss: false })
  
      const authStore = useAuthStore()
  
      this.token = ""
      this.current = null
      this.currentEComStore = {}
      this.permissions = []

      // Instead of dispatching, invoke store actions
      useOrderRoutingStore().clearRouting()
      useOrderRoutingStore().clearRoutingTestInfo()
      useUtilStore().clearUtilState()
      useProductStore().clearProductState()

      this.setOmsRedirectionInfo({ url: "", token: "" })
      resetConfig();
      resetPermissions();
      authStore.$reset()
  
      emitter.emit('dismissLoader')
    },
    async setUserTimeZone(payload: any) {
      const current: any = this.current;
      if(current.timeZone !== payload.tzId) {
        current.timeZone = payload.tzId;
        this.current = current;
        Settings.defaultZone = current.timeZone;
        commonUtil.showToast(translate("Time zone updated successfully"));
      }
    },
    setEcomStore(payload: any) {
      let productStore = payload.productStore;
      if(!productStore) {
        productStore = (this.current as any).stores.find((store: any) => store.productStoreId === payload.productStoreId);
      }
      this.currentEComStore = productStore;
      useUtilStore().updateShippingMethods({});
      useUtilStore().updateFacillityGroups({});
      useUtilStore().updateProductCategories({});
    }
  },
  persist: true
})
