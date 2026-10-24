<template>
  <ion-toast
    :is-open="updates.updateAvailable && dismissedBuildId !== updates.availableBuildId"
    :message="message"
    :buttons="buttons"
    position="top"
    @didDismiss="dismissedBuildId = updates.availableBuildId"
  />
</template>

<script setup lang="ts">
import { IonToast } from "@ionic/vue";
import { computed, onUnmounted, ref, watch } from "vue";
import { translate, useBuildUpdate } from "@common";
import router from "@/router";
import { useAppUpdateStore } from "@/store/appUpdate";

const updates = useAppUpdateStore();
const dismissedBuildId = ref("");
// Other screens own local forms and requests that are not represented by a global dirty flag.
// Keep updating in Settings rather than claiming that an empty routing blocker set makes them safe.
const routeBlocker = Symbol("update-route");
const inSettings = computed(() => router.currentRoute.value.name === "Settings");
watch(inSettings, ready => updates.setBlocked(routeBlocker, !ready), { immediate: true, flush: "sync" });
onUnmounted(() => updates.setBlocked(routeBlocker, false));
const { availableBuildId } = useBuildUpdate({
  currentBuildId: import.meta.env.VITE_APP_BUILD_ID || "",
  base: import.meta.env.BASE_URL,
  enabled: import.meta.env.PROD
});
watch(availableBuildId, value => { updates.availableBuildId = value; });
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
