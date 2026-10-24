<template>
  <div class="section-header">
    <h1>
      {{ translate("App") }}
      <p class="overline" v-if="appVersion">{{ translate("Version:", { appVersion }) }}</p>
    </h1>
    <p class="overline" v-if="appInfo.builtTime">{{ translate("Built:", { builtDateTime: getDateTime(appInfo.builtTime) }) }}</p>
  </div>
  <ion-button v-if="updates.updateAvailable" :disabled="updates.blocked" @click="updates.requestUpdate()">{{ translate("Update") }}</ion-button>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonButton } from "@ionic/vue";
import { useAppUpdateStore } from "@/store/appUpdate";
import { DateTime } from "luxon";

defineOptions({ inheritAttrs: false });

const updates = useAppUpdateStore();
const appInfo = updates.runningBuildInfo;
const appVersion = appInfo.branch ? (appInfo.branch + "-" + appInfo.revision) : appInfo.tag || "";

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
