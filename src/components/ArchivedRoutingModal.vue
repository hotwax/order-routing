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
      <ion-item v-for="routing in routings" :key="routing.orderRoutingId">
        <ion-label>{{ routing.routingName }}</ion-label>
        <ion-button slot="end" fill="outline" color="medium" @click="updateOrderRouting(routing, 'statusId', 'ROUTING_DRAFT')">{{ "Unarchive" }}</ion-button>
      </ion-item>
    </ion-list>
    <p class="empty-state" v-if="!routings.length">
      {{ "No archived routings" }}
    </p>
  </ion-content>
</template>

<script setup lang="ts">
import { Route } from "@/types";
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
import { defineProps, ref } from "vue";

const props = defineProps({
  archivedRoutings: {
    required: true
  }
})

let routings = ref(props.archivedRoutings) as any
let routingsToUpdate = ref([]) as any

function closeModal() {
  modalController.dismiss({ dismissed: true, routings: routingsToUpdate.value.length ? routingsToUpdate.value.concat(routings.value) : [] });
}

async function updateOrderRouting(routing: Route, fieldToUpdate: string, value: string) {
  routingsToUpdate.value.push({
    ...routing,
    [fieldToUpdate]: value
  })
  // remove the updated routing from the archivedRoutings
  routings.value = routings.value.filter((route: Route) => route.orderRoutingId !== routing.orderRoutingId)
}
</script>
