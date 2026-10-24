import { register } from "register-service-worker";
import { markRaw } from "vue";
import { commonUtil, translate } from "@common";
import { useUserStore } from "@/store/userStore";

export function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const user = useUserStore();
  let registration: ServiceWorkerRegistration | undefined;
  const notify = () => {
    if (!user.pwaState.updateExists)
      commonUtil.showToast(translate("A new version is available. Open Settings to update."));
    user.updatePwaState({ registration, updateExists: true });
  };
  register(`${import.meta.env.BASE_URL}sw.js`, {
    registrationOptions: { updateViaCache: "none" },
    registered: value => { registration = markRaw(value); user.pwaState.registration = registration; },
    updated: notify,
  });
  // Other tabs may activate an update. Notify, but never reload their unsaved work.
  navigator.serviceWorker.addEventListener("controllerchange", notify);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine)
      void registration?.update().then(() => { if (registration?.waiting) notify(); }).catch(() => {});
  });
}
