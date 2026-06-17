import { defineStore } from 'pinia'
import { Settings, DateTime } from "luxon"
import { logger, api, commonUtil, translate, cookieHelper } from '@common'
import { useAuth } from '@common/composables/useAuth'
import { orderRoutingStore } from './orderRoutingStore'
import { useUtilStore } from './utilStore'
import { productStore as useProduct } from './product'
import { productStore } from './productStore'
import { useAtpProductStore } from './atpProductStore'
import { useRuleStore } from './rule'
import { useChannelStore } from './channel'

export const useUserStore = defineStore('user', {
  state: () => {
    return {
      current: null as any,
      oms: null as any,
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
    getOms(state) {
      return state.oms
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
    getCurrentTimeZone(state): string | undefined {
      return state.current?.timeZone
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
    async setOms(oms: any) {
      this.oms = oms
    },
    async fetchPermissions() {
      const permissionId = import.meta.env.VITE_PERMISSION_ID;
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
            url: "admin/user/permissions",
            method: "get",
            baseURL: commonUtil.getMaargURL(),
            params: { viewIndex, viewSize }
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
        // Set maarg user id in the cookies.
        useAuth().updateUserId(this.current.userId);

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
    async postLogin() {
      try {
        await this.fetchUserProfile()
        await this.setOms(cookieHelper().get("oms"))
        await this.fetchPermissions()
        await productStore().fetchEComStores()
        await this.fetchAvailableTimeZones()
        // ATP (sourcing rules) initialisation
        try {
          const atp = useAtpProductStore()
          await atp.fetchUserProductStores()
          const stores = atp.getProductStores
          if (stores && stores.length) {
            atp.setCurrentProductStore(stores[0])
          }
        } catch (atpErr) {
          logger.error('ATP postLogin failed', atpErr)
        }
      } catch(error: any) {
        return Promise.reject(new Error(error));
      }
    },
    async postLogout() {
      orderRoutingStore().clearRouting()
      orderRoutingStore().clearRoutingTestInfo()
      useUtilStore().clearUtilState()
      useProduct().clearProductState()
      productStore().clearProductStoreState()
      useAtpProductStore().$reset()
      useRuleStore().$reset()
      useChannelStore().$reset()

      this.$reset();
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
