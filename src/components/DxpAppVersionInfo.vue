<template>
  <div class="section-header">
    <div>
      <h1>{{ translate("App") }}</h1>
      <p class="overline" v-if="appVersion">{{ translate("Version:", { appVersion }) }}</p>
    </div>
    <div class="ion-text-end">
      <p class="overline" v-if="appInfo.builtTime">{{ translate("Built:", { builtDateTime: getDateTime(appInfo.builtTime) }) }}</p>
      <ion-button v-if="pwaState.updateExists" :disabled="updating" @click="refreshApp" fill="outline" color="dark" size="small">{{ translate("Update") }}</ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonButton, loadingController, modalController } from "@ionic/vue";
import { computed, ref } from "vue";
import { useUserStore } from "@/store/userStore";
import { DateTime } from "luxon";
import router from "@/router";

defineOptions({ inheritAttrs: false });

const userStore = useUserStore();
const pwaState = computed(() => userStore.getPwaState);

const appInfo = (import.meta.env.VITE_APP_VERSION_INFO ? JSON.parse(import.meta.env.VITE_APP_VERSION_INFO) : {}) as any;
const updating = ref(false);
const appVersion = appInfo.branch ? (appInfo.branch + "-" + appInfo.revision) : appInfo.tag || "";

// Routing's existing leave guard resolves dirty work before Settings can be entered.
// Ionic caches pages, so check the route again when activation finishes.
const canReload = async () => !await modalController.getTop() && !await loadingController.getTop()
  && router.currentRoute.value.name === "Settings";
async function refreshApp() {
  if (updating.value || !pwaState.value.updateExists) return;
  updating.value = true;
  if (!await canReload()) { updating.value = false; return; }
  const worker = pwaState.value.registration?.waiting;
  if (!worker) { window.location.reload(); return; } // Already activated in another tab.
  const activated = async () => {
    if (worker.state !== "activated" && worker.state !== "redundant") return;
    worker.removeEventListener("statechange", activated);
    if (worker.state === "activated" && await canReload()) window.location.reload();
    updating.value = false;
  };
  worker.addEventListener("statechange", activated);
  worker.postMessage({ type: "SKIP_WAITING" });
}

function getDateTime(time: any) {
  return time ? DateTime.fromMillis(time).toLocaleString({ ...DateTime.DATETIME_MED, hourCycle: "h12" }) : "";
}
</script>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacer-xs) 10px 0px;
}
</style>
