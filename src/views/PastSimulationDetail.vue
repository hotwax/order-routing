<!-- src/views/PastSimulationDetail.vue -->
<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button default-href="/simulate" /></ion-buttons>
        <ion-title>{{ translate("Saved simulation") }}<template v-if="resultIdentity"> · {{ resultIdentity.kind === "variation" ? `${translate("Variation")} ${resultIdentity.label}` : translate("Baseline") }}</template></ion-title>
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
import { computed, ref, watch } from "vue";
import { translate } from "@common";
import SimulationResults from "@/components/simulation/SimulationResults.vue";
import { usePastSimulationStore } from "@/store/pastSimulationStore";
import { simulationStore } from "@/store/simulationStore";

const props = defineProps<{ simulationId: string }>();
const sim = usePastSimulationStore();
const live = simulationStore();
const loadGeneration = ref(0);
const resultIdentity = computed(() => live.results?.identity || null);

async function load() {
  const simulationId = String(props.simulationId || "");
  const generation = ++loadGeneration.value;
  live.results = null;
  try {
    const adapted = await sim.loadDetail(simulationId);
    if (generation !== loadGeneration.value || String(props.simulationId || "") !== simulationId) return;
    live.results = adapted as any;   // read-only display reuse of the existing results UI
    live.isRunning = false;
    live.view = "results";
  } catch { /* detailError already set */ }
}
watch(() => props.simulationId, load, { immediate: true });
</script>
