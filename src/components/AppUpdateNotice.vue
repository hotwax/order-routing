<template>
  <ion-toast
    :is-open="updates.updateAvailable && !dismissed"
    :message="message"
    :buttons="buttons"
    position="top"
    @didDismiss="dismissed = true"
  />
</template>

<script setup lang="ts">
import { IonToast } from "@ionic/vue";
import { computed, markRaw, onMounted, onUnmounted, ref, watch } from "vue";
import { translate } from "@common";
import router from "@/router";
import { useAppUpdateStore } from "@/store/appUpdate";
import { register } from "register-service-worker";

const updates = useAppUpdateStore();
const dismissed = ref(false);
// Other screens own local forms and requests that are not represented by a global dirty flag.
// Keep updating in Settings rather than claiming that an empty routing blocker set makes them safe.
const routeBlocker = Symbol("update-route");
const inSettings = computed(() => router.currentRoute.value.name === "Settings");
watch(inSettings, ready => updates.setBlocked(routeBlocker, !ready), { immediate: true, flush: "sync" });
onUnmounted(() => updates.setBlocked(routeBlocker, false));
// Use the installed registration library; no build marker or polling loop.
const checkForUpdate = () => {
  if (document.visibilityState === "visible" && navigator.onLine)
    void updates.registration?.update().catch(() => {});
};
const workerChanged = () => { updates.updateAvailable = true; dismissed.value = false; };
onMounted(() => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  register(`${import.meta.env.BASE_URL}sw.js`, {
    registrationOptions: { scope: import.meta.env.BASE_URL, updateViaCache: "none" },
    registered: registration => { updates.registration = markRaw(registration); },
    updated: registration => {
      updates.registration = markRaw(registration);
      workerChanged();
    },
  });
  // An update accepted in another tab must never reload this tab's draft.
  navigator.serviceWorker.addEventListener("controllerchange", workerChanged);
  document.addEventListener("visibilitychange", checkForUpdate);
});
onUnmounted(() => {
  navigator.serviceWorker?.removeEventListener("controllerchange", workerChanged);
  document.removeEventListener("visibilitychange", checkForUpdate);
});
const message = computed(() => !inSettings.value
  ? translate("A new version is available. Finish your work, then open Settings to update.")
  : updates.blocked
  ? translate("An update is available. Finish the current request and save or discard your changes before updating.")
  : translate("A new version is available. Update when you are ready."));
const buttons = computed(() => [
  ...(!updates.blocked ? [{ text: translate("Update"), handler: () => { void updates.requestUpdate(); return false; } }] : []),
  { text: translate("Later"), role: "cancel" }
]);
</script>
