<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button default-href="/simulate" /></ion-buttons>
        <ion-title>{{ translate('Saved simulation') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading" class="ion-padding"><ion-spinner name="crescent" /> {{ translate('Loading…') }}</div>
      <div v-else-if="error" class="ion-padding">
        <ion-text color="danger">{{ error }}</ion-text>
        <ion-button fill="outline" size="small" @click="load">{{ translate('Retry') }}</ion-button>
      </div>
      <SimulationResults v-else :embedded="true" :run="run" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { translate } from "@common";
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonSpinner, IonText, IonTitle, IonToolbar } from "@ionic/vue";
import SimulationResults from "@/components/simulation/SimulationResults.vue";
import { getSimulation } from "@/services/SimulationService";
import type { PersistedSimulation } from "@/services/SimulationService";
import { simulationSetupError } from "@/services/SimulationSetupService";

const props = defineProps<{ simulationId: string }>();
const run = ref<PersistedSimulation | null>(null);
const loading = ref(false);
const error = ref("");
let requestNumber = 0;

async function load() {
  const current = ++requestNumber;
  loading.value = true;
  error.value = "";
  run.value = null;
  try {
    const result = await getSimulation(props.simulationId);
    if (current === requestNumber) run.value = result;
  } catch (cause: any) {
    if (current === requestNumber) error.value = simulationSetupError(cause);
  } finally {
    if (current === requestNumber) loading.value = false;
  }
}
watch(() => props.simulationId, load, { immediate: true });
</script>
