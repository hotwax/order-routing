<!-- src/views/PastSimulationDetail.vue -->
<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button default-href="/simulate" /></ion-buttons>
        <ion-title>{{ translate("Saved simulation") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="sim.detailLoading" class="ion-padding"><ion-spinner name="crescent" /> {{ translate("Loading…") }}</div>
      <div v-else-if="sim.detailError" class="ion-padding">
        <ion-text color="danger">{{ sim.detailError }}</ion-text>
        <ion-button fill="outline" size="small" @click="load">{{ translate("Retry") }}</ion-button>
      </div>
      <SimulationResults v-else :embedded="true" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonSpinner, IonText, IonTitle, IonToolbar } from "@ionic/vue";
import { onMounted } from "vue";
import { translate } from "@common";
import SimulationResults from "@/components/simulation/SimulationResults.vue";
import { usePastSimulationStore } from "@/store/pastSimulationStore";
import { simulationStore } from "@/store/simulationStore";

const props = defineProps<{ simulationId: string }>();
const sim = usePastSimulationStore();
const live = simulationStore();

async function load() {
  try {
    const adapted = await sim.loadDetail(props.simulationId);
    live.results = adapted as any;   // read-only display reuse of the existing results UI
    live.isRunning = false;
    live.view = "results";
  } catch { /* detailError already set */ }
}
onMounted(load);
</script>
