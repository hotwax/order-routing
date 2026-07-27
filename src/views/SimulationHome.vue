<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Simulation history") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <!-- Running a simulation now happens on a routing group's detail page (Variations rail).
           This page is the cross-group archive of past runs. -->
      <PastSimulationsList />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/vue";
import PastSimulationsList from "@/components/simulation/PastSimulationsList.vue";
</script>
