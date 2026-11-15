<template>
  <div class="section-header">
    <div>
      <h1>{{ translate("App") }}</h1>
      <p class="overline" v-if="appVersion">{{ translate("Version:", { appVersion }) }}</p>
    </div>
    <div class="ion-text-end">
      <p class="overline" v-if="appInfo.builtTime">{{ translate("Built:", { builtDateTime: getDateTime(appInfo.builtTime) }) }}</p>
      <ion-button v-if="pwaState.updateExists" @click="refreshApp" fill="outline" color="dark" size="small">{{ translate("Update") }}</ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonButton } from "@ionic/vue";
import { computed } from "vue";
import { useUserStore } from "@/store/userStore";
import { DateTime } from "luxon";

defineOptions({ inheritAttrs: false });

const userStore = useUserStore();
const pwaState = computed(() => userStore.getPwaState);

const appInfo = (import.meta.env.VITE_APP_VERSION_INFO ? JSON.parse(import.meta.env.VITE_APP_VERSION_INFO) : {}) as any;
const appVersion = appInfo.branch ? (appInfo.branch + "-" + appInfo.revision) : appInfo.tag || "";

function refreshApp() {
  const registration = pwaState.value.registration;
  if (registration && registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  userStore.updatePwaState({ registration: pwaState.value.registration, updateExists: false });
  window.location.reload();
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
