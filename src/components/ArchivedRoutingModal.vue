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
import emitter from "@/event-bus";
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
import { useStore } from "vuex";

const store = useStore()
const props = defineProps({
  archivedRoutings: {
    required: true
  }
})

let routings = ref(props.archivedRoutings)

function closeModal() {
  modalController.dismiss({ dismissed: true });
}

async function updateOrderRouting(routing: Route, fieldToUpdate: string, value: string) {
  const orderRoutingId = await store.dispatch("orderRouting/updateOrderRouting", { orderRoutingId: routing.orderRoutingId, fieldToUpdate, value })
  if(orderRoutingId) {
    routings.value = (routings.value as any).filter((routing: Route) => routing.orderRoutingId !== orderRoutingId)
    emitter.emit("initializeOrderRoutings")
  }
}
</script>
