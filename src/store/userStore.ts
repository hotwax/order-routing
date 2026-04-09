import { defineStore } from 'pinia'
import { Settings, DateTime } from "luxon"
import { logger, emitter, api, cookieHelper, commonUtil, resetConfig, translate } from '@common'
import { useAuth } from '@/composables/auth'
import { orderRoutingStore } from './orderRoutingStore'
import { useUtilStore } from './utilStore'
import { productStore as useProduct } from './product'
import { productStore } from './productStore'

export const useUserStore = defineStore('appUser', {
  state: () => {
    return {
      current: null as any,
      permissions: [] as any,
      timeZones: [] as any[],
      pwaState: {
        updateExists: false as boolean,
        registration: null as any
      }
    }
  },
  getters: {
    getUserProfile(state) {
      return state.current
    },
    getUserPermissions (state) {
      return state.permissions;
    },
    getTimeZones(state) {
      return state.timeZones;
    },
    getPwaState(state) {
      return state.pwaState;
    },
    hasPermission: (state: any) => (permissionId: string): boolean => {
      const permissions = state.permissions;

      if (!permissionId) {
        return true;
      }


      // Handle OR/AND logic in permission string
      if (permissionId.includes(' OR ')) {
        const parts = permissionId.split(' OR ');
        return parts.some((part: string) => useUserStore().hasPermission(part.trim()));
      }

      if (permissionId.includes(' AND ')) {
        const parts = permissionId.split(' AND ');
        return parts.every((part: string) => useUserStore().hasPermission(part.trim()));
      }
      return permissions.includes(permissionId);
    }
  },
  actions: {
    async fetchPermissions() {
      const permissionId = import.meta.env.VITE_VUE_APP_PERMISSION_ID;
      const serverPermissions = [] as any;

      // TODO Make it configurable from the environment variables.
      // Though this might not be an server specific configuration, 
      // we will be adding it to environment variable for easy configuration at app level
      const viewSize = 200;

      let viewIndex = 0;

      try {
        let resp;
        do {
          resp = await api({
            url: "getPermissions",
            method: "post",
            baseURL: commonUtil.getOmsURL(),
            data: { viewIndex, viewSize }
          }) as any

          if (resp.status === 200 && resp.data.docs?.length && !commonUtil.hasError(resp)) {
            serverPermissions.push(...resp.data.docs.map((permission: any) => permission.permissionId));
            viewIndex++;
          } else {
            resp = null;
          }
        } while (resp);

        // Checking if the user has permission to access the app
        // If there is no configuration, the permission check is not enabled
        if (permissionId) {
          const hasAppPermission = serverPermissions.includes(permissionId);
          if (!hasAppPermission) {
            const permissionError = "You do not have permission to access the app.";
            commonUtil.showToast(translate(permissionError));
            logger.error("error", permissionError);
            return Promise.reject(new Error(permissionError));
          }
        }

        // Update the state with the fetched permissions
        this.permissions = serverPermissions;
      } catch (error: any) {
        return Promise.reject(error);
      }
    },
    async fetchUserProfile(): Promise<any> {
      try {
        const resp = await api({
          url: "admin/user/profile",
          method: "GET",
          baseURL: commonUtil.getMaargURL(),
        });
        if(commonUtil.hasError(resp)) throw "Error getting user profile";

        this.current = resp.data;

        if (this.current.timeZone) {
          Settings.defaultZone = this.current.timeZone;
        }

        return Promise.resolve(resp.data)
      } catch(error: any) {
        return Promise.reject(error)
      }
    },
    async checkPermission(payload: any): Promise <any> {
      return api({
        url: "checkPermission",
        method: "post",
        baseURL: commonUtil.getOmsURL(),
        ...payload
      });
    },
    async samlLogin(token: string, expirationTime: string) {
      try {
        cookieHelper().set("token", token)
        cookieHelper().set("expirationTime", expirationTime)

        try {
          const userProfileResp = await api({
            url: "admin/user/profile",
            method: "get",
            baseURL: commonUtil.getMaargURL()
          });
          this.current = userProfileResp.data
        } catch(error: any) {
          useAuth().clearAuth();
          commonUtil.showToast(translate("Failed to fetch user profile information"));
          console.error("error", error);
          return Promise.reject(new Error(error));
        }

        await this.fetchPermissions();
        await productStore().fetchEComStores();
        await this.fetchAvailableTimeZones();
      } catch (error: any) {
        // If any of the API call in try block has status code other than 2xx it will be handled in common catch block.
        // TODO Check if handling of specific status codes is required.
        commonUtil.showToast(translate('Something went wrong while login. Please contact administrator.'));
        console.error("error: ", error);
        return Promise.reject(new Error(error))
      }
    },
    // This action is just for clearing states of this app, callee should clear the auth in cookies.
    async logout() {
  
      this.current = null
      this.permissions = []

      // Instead of dispatching, invoke store actions
      orderRoutingStore().clearRouting()
      orderRoutingStore().clearRoutingTestInfo()
      useUtilStore().clearUtilState()
      useProduct().clearProductState()
      productStore().clearProductStoreState()

      resetConfig();
  
    },
    async setUserTimeZone(payload: any) {
      const current: any = this.current;
      if(current.timeZone !== payload.tzId) {
        current.timeZone = payload.tzId;
        this.current = current;
        Settings.defaultZone = current.timeZone;
        try {
          await api({
            url: "admin/user/profile",
            method: "post",
            data: { userId: current.userId, timeZone: current.timeZone }
          });
        } catch(err) {
          logger.error('Error setting timezone', err);
        }
        commonUtil.showToast(translate("Time zone updated successfully"));
      }
    },
    async fetchAvailableTimeZones() {
      if (this.timeZones.length) return;
      try {
        const resp = await api({
          url: "admin/user/getAvailableTimeZones",
          method: "get",
          cache: true
        });
        if (resp && resp.data?.timeZones?.length) {
          this.timeZones = resp.data.timeZones.filter((timeZone: any) => DateTime.local().setZone(timeZone.id).isValid);
        }
      } catch (err) {
        logger.error('Error fetching timezones', err);
      }
    },
    updatePwaState(payload: any) {
      this.pwaState.registration = payload.registration;
      this.pwaState.updateExists = payload.updateExists;
    }
  },
  persist: true
})
