<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/simulate" />
        </ion-buttons>
        <ion-title>{{ translate("Simulation") }}</ion-title>
        <ion-segment v-if="sim.baseline" slot="end" :value="sim.view" @ionChange="sim.view = $event.detail.value">
          <ion-segment-button value="editor">
            <ion-label>{{ translate("Editor") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="results">
            <ion-label>{{ (sim.isRunning || sim.isRunningVariationRun) ? translate("Simulation") : translate("Results") }}</ion-label>
            <ion-spinner v-if="sim.isRunning || sim.isRunningVariationRun" name="dots" />
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
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
        <div v-show="sim.view === 'editor'">
          <!-- Key on the active variation so switching baseline <-> variation tears down and
               rebuilds the editor, guaranteeing a fresh bind to sim.working regardless of any
               in-place reactivity edge case (esp. for edited variations). -->
          <RoutingEditorCanvas :key="sim.activeVariationId || 'baseline'" mode="simulation" />
        </div>
        <!-- Persistent right-side sheet; teleports to body so it stays available across views. -->
        <VariationRail />
        <div v-show="sim.view === 'results' && !sim.isRunning && !sim.results && !sim.isRunningVariationRun && !sim.variationRunResult" class="ion-padding sim-empty">
          {{ translate("No simulation has run yet. Save a variation and run it.") }}
        </div>
        <SimulationResults v-show="sim.view === 'results' && (sim.isRunning || sim.results || sim.isRunningVariationRun || sim.variationRunResult)" />
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { translate } from "@common";
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonLabel, IonPage, IonSegment, IonSegmentButton, IonSpinner, IonTitle, IonToolbar } from "@ionic/vue";
import { simulationStore } from "@/store/simulationStore";
import RoutingEditorCanvas from "@/components/routing-editor/RoutingEditorCanvas.vue";
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
.sim-viewbar { max-width: 360px; margin: var(--spacer-sm) auto; }
.sim-empty { color: var(--ion-color-medium); }
</style>
