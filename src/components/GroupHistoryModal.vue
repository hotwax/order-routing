<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Group history") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
        <ion-item v-for="history in (groupHistory)" :key="history.jobRunId">
        <ion-label>
          <h3>{{ commonUtil.getTime(history.startTime) }}</h3>
          <p>{{ commonUtil.getDate(history.startTime) }}</p>
        </ion-label>
        <ion-badge color="dark" v-if="history.endTime">{{ commonUtil.getRelativeTime(history.endTime) }}</ion-badge>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { translate, commonUtil } from "@common";
import { IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { defineProps } from "vue";

defineProps({
  groupHistory: {
    required: true,
    default: [] as any[]
  }
})

function closeModal() {
  modalController.dismiss();
}
</script>
