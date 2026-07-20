<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Simulate") }}</ion-title>
        <ion-segment slot="end" :value="tab" @ionChange="tab = $event.detail.value">
          <ion-segment-button value="new"><ion-label>{{ translate("New simulation") }}</ion-label></ion-segment-button>
          <ion-segment-button value="past"><ion-label>{{ translate("Past simulations") }}</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list v-show="tab === 'new'">
        <ion-list-header>
          <ion-label>{{ translate("Choose a routing group to simulate") }}</ion-label>
        </ion-list-header>
        <ion-item v-for="group in groups" :key="group.routingGroupId" button @click="openGroup(group.routingGroupId)">
          <ion-label>
            {{ group.groupName || group.routingGroupId }}
            <p>{{ group.routingGroupId }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <PastSimulationsList v-if="tab === 'past'" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { translate } from "@common";
import { IonContent, IonHeader, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonSegment, IonSegmentButton, IonTitle, IonToolbar } from "@ionic/vue";
import { simulationStore } from "@/store/simulationStore";
import PastSimulationsList from "@/components/simulation/PastSimulationsList.vue";
import router from "@/router";

// Groups come from the simulation backend via the simulation store — isolated from the OMS group state.
const simStore = simulationStore();
const groups = computed(() => simStore.getSimGroups);
const tab = ref<any>("new");

// fetchSimGroups catches its own errors (empty list on failure), so a sim outage can't reject here.
onMounted(async () => { await simStore.fetchSimGroups(); });

function openGroup(routingGroupId: string) {
  router.push(`/simulate/${routingGroupId}`);
}
</script>
