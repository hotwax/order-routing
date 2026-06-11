<template>
  <ion-page>
    <ion-content>
      <div v-if="sim.loadError" class="ion-padding">
        <p>{{ sim.loadError }}</p>
        <ion-button fill="outline" @click="reload">{{ translate("Retry") }}</ion-button>
      </div>
      <div v-else-if="!sim.baseline">{{ translate("Loading group…") }}</div>
      <template v-else>
        <!-- Toggle is always available so the user can move freely between the editor and the
             (possibly still-running, or not-yet-started) simulation. Both panes stay mounted so
             switching is instant and the editor keeps its state while a run continues in the background. -->
        <ion-segment :value="sim.view" @ionChange="sim.view = String($event.detail.value)" class="sim-viewbar">
          <ion-segment-button value="editor">
            <ion-label>{{ translate("Editor") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="results">
            <ion-label>{{ (sim.isRunning || sim.isRunningVariationRun) ? translate("Simulation") : translate("Results") }}</ion-label>
            <ion-spinner v-if="sim.isRunning || sim.isRunningVariationRun" name="dots" />
          </ion-segment-button>
        </ion-segment>

        <div v-show="sim.view === 'editor'" class="sim-editor">
          <simulation-canvas />
          <variation-rail />
        </div>
        <div v-show="sim.view === 'results' && !sim.isRunning && !sim.results && !sim.isRunningVariationRun && !sim.variationRunResult" class="ion-padding sim-empty">
          {{ translate("No simulation has run yet. Save a variation and run it.") }}
        </div>
        <simulation-results v-show="sim.view === 'results' && (sim.isRunning || sim.results || sim.isRunningVariationRun || sim.variationRunResult)" />
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { translate } from "@common";
import { IonButton, IonContent, IonLabel, IonPage, IonSegment, IonSegmentButton, IonSpinner } from "@ionic/vue";
import { simulationStore } from "@/store/simulationStore";
import SimulationCanvas from "@/components/simulation/SimulationCanvas.vue";
import VariationRail from "@/components/simulation/VariationRail.vue";
import SimulationResults from "@/components/simulation/SimulationResults.vue";

// Route params arrive as props (route registered with `props: true`), matching the
// convention used by BrokeringRoute.vue et al. useRoute() is not reliable here.
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
});
const sim = simulationStore();

async function reload() {
  await sim.loadGroup(String(props.routingGroupId));
  await sim.resumeInFlight(String(props.routingGroupId));
}

onMounted(reload);
</script>

<style scoped>
.sim-editor { display: flex; gap: var(--spacer-base); }
.sim-viewbar { max-width: 360px; margin: var(--spacer-sm) auto; }
.sim-empty { color: var(--ion-color-medium); }
</style>
