import { defineStore } from 'pinia'
import { commonUtil } from "@/utils/commonUtil"
import { translate } from "@/i18n"
import logger from "@/logger"
import emitter from "@/event-bus"
import { Settings, DateTime } from "luxon"
import { api, cookieHelper, getMaargURL, resetConfig } from '@common'
import { getServerPermissionsFromRules, prepareAppPermissions, resetPermissions, setPermissions } from "@/authorization"
import { useProductStore } from './useProductStore'
import { useUtilStore } from './useUtilStore'
import { getOmsURL, hasError, showToast } from '@common/utils/commonUtil'
import { useAuth } from '@/composables/auth'
import { useOrderRoutingStore } from './useOrderRoutingStore'

export const useUserStore = defineStore('appUser', {
  state: () => {
    return {
      current: null as any,
      currentEComStore: {} as any,
      permissions: [] as any,
      timeZones: [] as any[]
    }
  },
  getters: {
    getUserProfile(state) {
      return state.current
    },
    getCurrentEComStore(state) {
      return state.currentEComStore
    },
    getUserPermissions (state) {
      return state.permissions;
    },
    getTimeZones(state) {
      return state.timeZones;
    },
  },
  actions: {
    async fetchPermissions() {
      const permissionId = import.meta.env.VITE_VUE_APP_PERMISSION_ID;
      // Prepare permissions list
      const serverPermissionsFromRules = [...new Set(getServerPermissionsFromRules())];
      if (permissionId) serverPermissionsFromRules.push(permissionId);
      let serverPermissions = [] as any;

      // If the server specific permission list doesn't exist, getting server permissions will be of no use
      // It means there are no rules yet depending upon the server permissions.
      if (serverPermissionsFromRules && serverPermissionsFromRules.length == 0) return serverPermissions;
      // TODO pass specific permissionIds
      let resp;
      // TODO Make it configurable from the environment variables.
      // Though this might not be an server specific configuration, 
      // we will be adding it to environment variable for easy configuration at app level
      const viewSize = 200;

      try {
        const params = {
          "viewIndex": 0,
          viewSize,
          permissionIds: serverPermissionsFromRules
        }
        resp = await api({
          url: "getPermissions",
          method: "post",
          baseURL: getOmsURL(),
          data: params,
        })
        if(resp.status === 200 && resp.data.docs?.length && !hasError(resp)) {
          serverPermissions = resp.data.docs.map((permission: any) => permission.permissionId);
          const total = resp.data.count;
          const remainingPermissions = total - serverPermissions.length;
          if (remainingPermissions > 0) {
            // We need to get all the remaining permissions
            const apiCallsNeeded = Math.floor(remainingPermissions / viewSize) + ( remainingPermissions % viewSize != 0 ? 1 : 0);
            const responses = await Promise.all([...Array(apiCallsNeeded).keys()].map(async (index: any) => {
              const response = await api({
                url: "getPermissions",
                method: "post",
                baseURL: getOmsURL(),
                data: {
                  "viewIndex": index + 1,
                  viewSize,
                  permissionIds: serverPermissionsFromRules
                }
              })
              if(!hasError(response)){
                return Promise.resolve(response);
                } else {
                return Promise.reject(response);
                }
            }))
            const permissionResponses = {
              success: [],
              failed: []
            }
            responses.reduce((permissionResponses: any, permissionResponse: any) => {
              if (permissionResponse.status !== 200 || hasError(permissionResponse) || !permissionResponse.data?.docs) {
                permissionResponses.failed.push(permissionResponse);
              } else {
                permissionResponses.success.push(permissionResponse);
              }
              return permissionResponses;
            }, permissionResponses)

            serverPermissions = permissionResponses.success.reduce((serverPermissions: any, response: any) => {
              serverPermissions.push(...response.data.docs.map((permission: any) => permission.permissionId));
              return serverPermissions;
            }, serverPermissions)

            // If partial permissions are received and we still allow user to login, some of the functionality might not work related to the permissions missed.
            // Show toast to user intimiting about the failure
            // Allow user to login
            // TODO Implement Retry or improve experience with show in progress icon and allowing login only if all the data related to user profile is fetched.
            if (permissionResponses.failed.length > 0) Promise.reject("Something went wrong while getting complete user permissions.");
          }
        }
        const appPermissions = prepareAppPermissions(serverPermissions);

        // Checking if the user has permission to access the app
        // If there is no configuration, the permission check is not enabled
        if (permissionId) {
          const hasPermission = appPermissions.some((appPermission: any) => appPermission.action === permissionId);
          if (!hasPermission) {
            const permissionError = "You do not have permission to access the app.";
            showToast(translate(permissionError));
            logger.error("error", permissionError);
            return Promise.reject(new Error(permissionError));
          }
        }

        // Update the state with the fetched permissions
        this.permissions = appPermissions;
        // Set permissions in the authorization module
        setPermissions(appPermissions);
      } catch(error: any) {
        return Promise.reject(error);
      }
    },
    async fetchUserProfile(): Promise<any> {
      try {
        const resp = await api({
          url: "admin/user/profile",
          method: "GET",
          baseURL: getMaargURL(),
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
    async fetchEComStores(): Promise<any> {
      try {
        const resp = await api({
          url: "admin/user/productStore",
          method: "GET",
          baseURL : getMaargURL(),
        });
        if (commonUtil.hasError(resp) || resp.data.length === 0) {
          throw resp.data;
        } else {
          this.current.stores = resp.data;
          this.currentEComStore = resp.data[0];
          return Promise.resolve(resp.data);
        }
      } catch(error: any) {
        return Promise.reject(error)
      }
    },
    async checkPermission(payload: any): Promise <any> {
      return api({
        url: "checkPermission",
        method: "post",
        baseURL: getOmsURL(),
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
            baseURL: getMaargURL()
          });
          this.current = userProfileResp.data
        } catch(error: any) {
          useAuth().clearAuth();
          showToast(translate("Failed to fetch user profile information"));
          console.error("error", error);
          return Promise.reject(new Error(error));
        }

        await this.fetchPermissions();
        await this.fetchEComStores();
        await this.fetchAvailableTimeZones();
      } catch (error: any) {
        // If any of the API call in try block has status code other than 2xx it will be handled in common catch block.
        // TODO Check if handling of specific status codes is required.
        showToast(translate('Something went wrong while login. Please contact administrator.'));
        console.error("error: ", error);
        return Promise.reject(new Error(error))
      }
    },
    // This action is just for clearing states of this app, callee should clear the auth in cookies.
    async logout() {
      emitter.emit('presentLoader', { message: 'Logging out', backdropDismiss: false })
  
      this.current = null
      this.currentEComStore = {}
      this.permissions = []

      // Instead of dispatching, invoke store actions
      useOrderRoutingStore().clearRouting()
      useOrderRoutingStore().clearRoutingTestInfo()
      useUtilStore().clearUtilState()
      useProductStore().clearProductState()

      resetConfig();
      resetPermissions();
  
      emitter.emit('dismissLoader')
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
