<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Archived Routes") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
      <ion-item v-for="routing in routings" :key="routing.orderRoutingId">
        <ion-label>{{ routing.routingName }}</ion-label>
        <ion-button slot="end" fill="outline" color="medium" @click="updateOrderRouting(routing, 'statusId', 'ROUTING_DRAFT')">{{ translate("Unarchive") }}</ion-button>
      </ion-item>
    </ion-list>
    <p class="empty-state" v-if="!routings.length">
      {{ translate("No archived routings") }}
    </p>
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
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
  },
  saveRoutings: {
    required: true
  } as any
})

let routings = ref(props.archivedRoutings) as any

// Not passing any data on modal close as we are updating the routings on every button click.
function closeModal() {
  modalController.dismiss();
}

async function updateOrderRouting(routing: Route, fieldToUpdate: string, value: string) {
  // remove the updated routing from the archivedRoutings
  routings.value = routings.value.filter((route: Route) => route.orderRoutingId !== routing.orderRoutingId)

  /*
  Instead of updating the same on closeModal we are updating it on every routing unarchive action, as if a user
  unarchives multiple routings and then click backdrop then the updated data can't be sent back to the parent component.
  Thus used this approach to update the parent data on every routing unarchive click

  As we need the feature to save the routing status even when backdrop is clicked thus added above approach
  */
  props.saveRoutings([{
    ...routing,
    [fieldToUpdate]: value
  }, ...routings.value])
}
</script>
