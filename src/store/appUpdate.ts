import { defineStore } from "pinia";
import { alertController, loadingController, modalController } from "@ionic/vue";
import { translate } from "@common";

// Imported by the eager app shell, so Settings reports the running build, not a later lazy chunk.
const runningBuildInfo = JSON.parse(import.meta.env.VITE_APP_VERSION_INFO || "{}");
export const useAppUpdateStore = defineStore("appUpdate", {
  state: () => ({ updateAvailable: false, registration: null as ServiceWorkerRegistration | null, blockers: new Set<symbol>(), confirming: false, runningBuildInfo }),
  getters: {
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
        if (role === "confirm" && this.updateAvailable
          && !await modalController.getTop() && !await loadingController.getTop() && !this.blocked) {
          const worker = this.registration?.waiting;
          if (worker) {
            // Only the consenting tab reloads, and recheck work started during activation.
            const activated = async () => {
              if (worker.state !== "activated" && worker.state !== "redundant") return;
              worker.removeEventListener("statechange", activated);
              if (worker.state === "activated"
                && !await modalController.getTop() && !await loadingController.getTop() && !this.blocked) window.location.reload();
            };
            worker.addEventListener("statechange", activated);
            worker.postMessage({ type: "SKIP_WAITING" });
          } else {
            // Another tab may already have activated the waiting worker.
            window.location.reload();
          }
        }
      } finally { this.confirming = false; }
    }
  }
});
