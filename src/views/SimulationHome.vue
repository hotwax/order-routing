<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Simulate") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-list-header>
          <ion-label>{{ translate("Choose a routing group to simulate") }}</ion-label>
        </ion-list-header>
        <ion-item v-for="group in groups" :key="group.routingGroupId" button @click="openGroup(group.routingGroupId)">
          <ion-label>
            <h2>{{ group.groupName || group.routingGroupId }}</h2>
            <p>{{ group.routingGroupId }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { translate } from "@common";
import { IonContent, IonHeader, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonTitle, IonToolbar } from "@ionic/vue";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import router from "@/router";

const routingStore = orderRoutingStore();
const groups = computed(() => routingStore.getRoutingGroups);

onMounted(async () => { await routingStore.fetchOrderRoutingGroups(); });

function openGroup(routingGroupId: string) {
  router.push(`/tabs/simulate/${routingGroupId}`);
}
</script>
