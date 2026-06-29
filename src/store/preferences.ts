import { defineStore } from 'pinia'

// Local, frontend-only UI preferences (persisted in the browser; no backend/OMS contract).
export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    devModeEnabled: false
  }),
  getters: {
    isDevModeEnabled: (state) => state.devModeEnabled
  },
  actions: {
    setDevMode(enabled: boolean) {
      this.devModeEnabled = enabled
    }
  },
  persist: true
})
