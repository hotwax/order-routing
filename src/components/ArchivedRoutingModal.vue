<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ "Archived Routes" }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
      <ion-item v-for="routing in props.archivedRoutings" :key="routing.orderRoutingId">
        <ion-label>{{ routing.routingName }}</ion-label>
        <ion-button slot="end" fill="outline" color="medium">{{ "Unarchive" }}</ion-button>
      </ion-item>
    </ion-list>
    <p class="empty-state" v-if="!(props as any).archivedRoutings.length">
      {{ "No archived routings" }}
    </p>
  </ion-content>
</template>

<script setup lang="ts">
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
import { closeOutline } from "ionicons/icons";
import { defineProps } from "vue";

const props = defineProps({
  archivedRoutings: {
    required: true
  }
})

function closeModal() {
  modalController.dismiss({ dismissed: true });
}
</script>
