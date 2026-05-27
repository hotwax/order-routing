<template>
  <div class="ion-padding">
    <simulation-progress v-if="sim.isRunning" />

    <ion-button fill="clear" @click="sim.view = 'editor'"><ion-icon slot="start" :icon="arrowBackOutline" />{{ translate("Back to editor") }}</ion-button>

    <ion-card v-if="sim.results">
      <ion-card-header><ion-card-title>{{ translate("Comparison") }}</ion-card-title></ion-card-header>
      <ion-card-content>
        <table class="scorecard">
          <thead>
            <tr><th></th><th>{{ translate("Baseline") }}</th><th v-for="v in sim.results.variants" :key="v.label" :class="{ winner: v.label === winnerLabel }">{{ v.label }}</th></tr>
          </thead>
          <tbody>
            <tr><td>{{ translate("Brokered") }}</td><td>{{ sim.results.baseline?.brokeredItemCount ?? '—' }}</td><td v-for="v in sim.results.variants" :key="v.label">{{ v.groupRun?.brokeredItemCount ?? '—' }}</td></tr>
            <tr><td>{{ translate("Queued") }}</td><td>{{ sim.results.baseline?.queuedItemCount ?? '—' }}</td><td v-for="v in sim.results.variants" :key="v.label">{{ v.groupRun?.queuedItemCount ?? '—' }}</td></tr>
            <tr><td>{{ translate("Attempted") }}</td><td>{{ sim.results.baseline?.attemptedItemCount ?? '—' }}</td><td v-for="v in sim.results.variants" :key="v.label">{{ v.groupRun?.attemptedItemCount ?? '—' }}</td></tr>
          </tbody>
        </table>
        <p v-if="sim.results.partial" class="warn">{{ translate("Some variations did not complete — results are partial.") }}</p>
      </ion-card-content>
    </ion-card>

    <ion-accordion-group v-if="sim.results">
      <ion-accordion v-for="v in sim.results.variants" :key="v.label" :value="v.label">
        <ion-item slot="header"><ion-label>{{ v.label }} {{ v.failed ? '⚠︎' : '' }}</ion-label></ion-item>
        <div slot="content" class="ion-padding">
          <h4>{{ translate("Orders that changed outcome") }}</h4>
          <ion-list>
            <ion-item v-for="(t, i) in (v.diff?.finalReasonTransitions ?? [])" :key="i">
              <ion-label>{{ t.orderId }}: {{ t.from }} → {{ t.to }}</ion-label>
            </ion-item>
          </ion-list>
          <h4>{{ translate("Per-routing delta") }}</h4>
          <ion-list>
            <ion-item v-for="(d, name) in (v.diff?.routingBrokeredDelta ?? {})" :key="name">
              <ion-label>{{ name }}: {{ d[0] }} → {{ d[1] }}</ion-label>
            </ion-item>
          </ion-list>
          <h4>{{ translate("Per-facility delta") }}</h4>
          <ion-list>
            <ion-item v-for="(d, name) in (v.diff?.facilityAllocationDelta ?? {})" :key="name">
              <ion-label>{{ name }}: {{ d[0] }} → {{ d[1] }}</ion-label>
            </ion-item>
          </ion-list>
        </div>
      </ion-accordion>
    </ion-accordion-group>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { translate } from "@common";
import { IonAccordion, IonAccordionGroup, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonItem, IonLabel, IonList } from "@ionic/vue";
import { arrowBackOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";
import SimulationProgress from "./SimulationProgress.vue";

const sim = simulationStore();

const winnerLabel = computed(() => {
  const vs = sim.results?.variants ?? [];
  let best: any = null;
  for (const v of vs) {
    if (v.failed) continue;
    if (!best || (v.groupRun?.brokeredItemCount ?? -1) > (best.groupRun?.brokeredItemCount ?? -1)) best = v;
  }
  return best?.label;
});
</script>

<style scoped>
.scorecard { width: 100%; border-collapse: collapse; }
.scorecard th, .scorecard td { padding: 8px; text-align: left; border-bottom: 1px solid var(--ion-color-light-shade); }
.scorecard th.winner { color: var(--ion-color-success); }
.warn { color: var(--ion-color-warning-shade); }
</style>
