<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Routing history") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
      <ion-item lines="full">
        <ion-label>
          <h1>{{ routingName }}</h1>
          <p>{{ groupName }}</p>
        </ion-label>
        <ion-label slot="end">
          {{ productStoreName }}
        </ion-label>
      </ion-item>
      <div class="empty-state" v-if="!routingHistory.length">
        {{ translate("No available history for this route") }}
      </div>
      <div v-else>
        <ion-item v-for="(history, index) in routingHistory" :key="index">
          <ion-icon v-if="history.hasError === 'Y'" :icon="warningOutline" color="warning" slot="start" />
          <ion-icon v-else :icon="checkmarkDoneOutline" slot="start"/>
          <ion-label>{{ history.routingResult }}</ion-label>
          <ion-label slot="end">{{ getDateAndTime(history.startDate) }}</ion-label>
        </ion-item>
      </div>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import store from "@/store";
import { getDateAndTime } from "@/utils";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  modalController,
} from "@ionic/vue";
import { checkmarkDoneOutline, closeOutline, warningOutline } from "ionicons/icons";
import { computed, defineProps } from "vue";

defineProps({
  routingHistory: {
    type: Array<any>,
    required: true,
    default: []
  },
  routingName: {
    type: String,
    default: "routing name"
  },
  groupName: {
    type: String,
    default: "group name"
  }
})

const userProfile = computed(() => store.getters["user/getUserProfile"])
const currentRoutingGroup: any = computed(() => store.getters["orderRouting/getCurrentRoutingGroup"])

const productStoreName = computed(() => userProfile.value.stores.find((store: any) => store.productStoreId === currentRoutingGroup.value.productStoreId)?.storeName || currentRoutingGroup.value.productStoreId)

function closeModal() {
  modalController.dismiss();
}
</script>
