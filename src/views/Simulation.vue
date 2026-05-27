<template>
  <ion-page>
    <ion-content>
      <div v-if="sim.loadError" class="ion-padding">
        <p>{{ sim.loadError }}</p>
        <ion-button fill="outline" @click="reload">{{ translate("Retry") }}</ion-button>
      </div>
      <div v-else-if="!sim.baseline">{{ translate("Loading group…") }}</div>
      <template v-else>
        <simulation-results v-if="sim.results || sim.isRunning" />
        <div v-else class="sim-editor">
          <simulation-canvas />
          <variation-rail />
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import { translate } from "@common";
import { IonButton, IonContent, IonPage } from "@ionic/vue";
import { simulationStore } from "@/store/simulationStore";
import SimulationCanvas from "@/components/simulation/SimulationCanvas.vue";
import VariationRail from "@/components/simulation/VariationRail.vue";
import SimulationResults from "@/components/simulation/SimulationResults.vue";

const sim = simulationStore();
const route = useRoute();

function reload() { sim.loadGroup(String(route.params.routingGroupId)); }

onMounted(reload);
</script>

<style scoped>
.sim-editor { display: flex; gap: var(--spacer-base); }
</style>
