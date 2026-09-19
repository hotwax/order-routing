import { defineStore } from 'pinia'
import { Settings, DateTime } from "luxon"
import { logger, api, commonUtil, translate, cookieHelper } from '@common'
import { useAuth } from '@common/composables/useAuth'
import { orderRoutingStore } from './orderRoutingStore'
import { useUtilStore } from './utilStore'
import { productStore as useProduct } from './product'
import { productStore } from './productStore'
import { useProductInventoryStore } from './productInventory'
import { initialize } from '@/services/appInitializer'
import { isInstanceScopeStale } from '@/utils/omsInstance'
import { useAtpProductStore } from './atpProductStore'
import { useRuleStore } from './rule'
import { useChannelStore } from './channel'
import { useCircuitStore } from './circuit'
import { simulationStore } from './simulationStore'
import { useInventoryUpdatesStore } from './inventoryUpdates'

export const useUserStore = defineStore('user', {
  state: () => {
    return {
      current: null as any,
      oms: null as any,
      permissions: [] as any,
      timeZones: [] as any[],
      // The app version this deployment is pinned to. undefined = not resolved yet, "" = no version
      // configured, "vX.Y.Z" = pinned. Resolved from the OMS by useAuth().fetchAppVersion() on Login.
      appVersion: undefined as string | undefined,
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
    getAppVersion(state) {
      return state.appVersion
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

      const viewSize = 200;

      let viewIndex = 0;

      try {
        let resp;
        do {
          resp = await api({
            url: "admin/user/permissions",
            method: "get",
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
    async postLogin() {
      try {
        await this.setOms(cookieHelper().get("oms"))
        // Clear state owned by the previous OMS before loading any profile or permission
        // data for the newly connected instance.
        await this.ensureInstanceScope()
        await this.fetchUserProfile()
        const sessionChanged = orderRoutingStore().activateSessionContext([
          commonUtil.getOMSInstanceName(),
          this.current?.userId
        ].map((value) => String(value || "").trim()).join("::"))
        if (sessionChanged) {
          // Circuit threads and simulation working copies can contain the same routing data. They
          // must not survive an instance/user boundary either.
          useCircuitStore().$reset()
          simulationStore().$reset()
        }
        await initialize()
        await this.fetchPermissions()
        await useUtilStore().fetchSystemInformation()
        await productStore().fetchProductStores()
        await this.fetchAvailableTimeZones()
      } catch(error: any) {
        return Promise.reject(new Error(error));
      }
    },
    async postLogout() {
      await this.clearInstanceScopedState()

      this.$reset();
    },
    // Clears every store whose persisted data only makes sense on the OMS instance it was
    // fetched from. Used on logout and when a login/hydrate detects an instance switch.
    async clearInstanceScopedState(): Promise<void> {
      this.current = null
      this.permissions = []
      orderRoutingStore().clearSessionContext()
      orderRoutingStore().clearRoutingTestInfo()
      useCircuitStore().$reset()
      simulationStore().$reset()
      useUtilStore().clearUtilState()
      useProduct().clearProductState()
      productStore().$reset()
      await useProductInventoryStore().clearProductInventory()
      useAtpProductStore().$reset()
      useRuleStore().$reset()
      useChannelStore().$reset()
      useInventoryUpdatesStore().$reset()
    },
    // Persisted Pinia state survives OMS instance switches that happen without an explicit
    // logout (launchpad switch, relogin to another instance), leaving product stores from
    // the previously linked instance selected. Compares the instance key stamped on the
    // canonical product-store cache against the connected instance and drops all instance-scoped
    // state on mismatch. Returns whether the persisted state was already valid.
    async ensureInstanceScope(payload?: { refetch?: boolean }): Promise<boolean> {
      const ecom = productStore()
      const ecomStale = isInstanceScopeStale(ecom.omsInstanceKey, Boolean(ecom.ecomStores?.length || ecom.currentEComStore?.productStoreId))
      if (!ecomStale) return true

      await this.clearInstanceScopedState()

      // On app hydrate there is no login flow to repopulate the selector, so refetch here.
      if (payload?.refetch) {
        try {
          await this.fetchUserProfile()
          await this.fetchPermissions()
        } catch (error) {
          logger.error("User Profile - Fetch failed for the connected OMS", error)
        }
        try {
          await ecom.fetchProductStores()
        } catch (error) {
          logger.error("Product Store - Fetch failed for the connected OMS", error)
        }
      }
      return false
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
