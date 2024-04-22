<template>
  <ion-content>
    <ion-list>
      <ion-list-header>{{ group.groupName }}</ion-list-header>
      <ion-item button>
        <ion-icon slot="start" :icon="flashOutline" />
        {{ translate("Run now") }}
      </ion-item>
      <ion-item lines="none" button v-if="group.schedule?.paused === 'N'" @click="updateGroupStatus('Y')">
        <ion-icon slot="start" :icon="pauseOutline" />
        {{ translate("Move to Draft") }}
      </ion-item>
      <ion-item lines="none" button v-else @click="updateGroupStatus('N')">
        <ion-icon slot="start" :icon="playOutline" />
        {{ translate("Activate") }}
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonContent,
  IonIcon,
  IonItem,
  IonList,
  IonListHeader,
  popoverController
} from "@ionic/vue";
import { flashOutline, pauseOutline, playOutline } from 'ionicons/icons'
import { translate } from "@/i18n"
import { defineProps } from "vue"
import { OrderRoutingService } from "@/services/RoutingService";
import { hasError, showToast } from "@/utils";
import logger from "@/logger";
import store from "@/store";

const props = defineProps(["group"])

async function updateGroupStatus(paused: string) {
  let routingGroups = [];
  const payload = {
    routingGroupId: props.group.routingGroupId,
    paused
  }

  try {
    const resp = await OrderRoutingService.scheduleBrokering(payload)
    if(!hasError(resp)){
      showToast(translate("Group status updated"))
      routingGroups = await store.dispatch("orderRouting/updateGroupStatus", { routingGroupId: props.group.routingGroupId, value: paused })
    } else {
      throw resp.data
    }
  } catch(err) {
    showToast(translate("Failed to update group status"))
    logger.error(err)
  }

  popoverController.dismiss({ routingGroups });
}
</script> 