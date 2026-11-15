import { register } from "register-service-worker";
import { useUserStore } from "@/store/userStore";

export function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const user = useUserStore();
  register(`${import.meta.env.BASE_URL}sw.js`, {
    registrationOptions: { updateViaCache: "none" },
    updated(registration) {
      user.updatePwaState({ registration, updateExists: true });
    },
  });
}
