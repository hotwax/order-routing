import { defineStore } from "pinia";
import { alertController, loadingController, modalController } from "@ionic/vue";
import { translate } from "@common";

// Imported by the eager app shell, so Settings reports the running build, not a later lazy chunk.
const runningBuildInfo = JSON.parse(import.meta.env.VITE_APP_VERSION_INFO || "{}");
export const useAppUpdateStore = defineStore("appUpdate", {
  state: () => ({ availableBuildId: "", blockers: new Set<symbol>(), confirming: false, runningBuildInfo }),
  getters: {
    updateAvailable: state => Boolean(state.availableBuildId),
    blocked: state => state.blockers.size > 0
  },
  actions: {
    setBlocked(owner: symbol, blocked: boolean) {
      if (blocked) this.blockers.add(owner);
      else this.blockers.delete(owner);
    },
    async requestUpdate() {
      if (!this.updateAvailable || this.blocked || this.confirming) return;
      this.confirming = true;
      try {
        // Settings can also open editors or await a request. Never reload through an overlay.
        if (await modalController.getTop() || await loadingController.getTop()) return;
        const alert = await alertController.create({
          header: translate("Update app?"),
          message: translate("Save or discard any unfinished work before updating. This reloads the current page."),
          buttons: [{ text: translate("Later"), role: "cancel" }, { text: translate("Update now"), role: "confirm" }]
        });
        await alert.present();
        const { role } = await alert.onDidDismiss();
        // A request/edit may start while the confirmation is open.
        if (role === "confirm" && !this.blocked && this.updateAvailable
          && !await modalController.getTop() && !await loadingController.getTop()) window.location.reload();
      } finally { this.confirming = false; }
    }
  }
});
