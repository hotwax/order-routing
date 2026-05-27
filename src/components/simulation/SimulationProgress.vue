<template>
  <ion-list>
    <ion-list-header><ion-label>{{ translate("Simulation progress") }}</ion-label></ion-list-header>
    <ion-item v-for="rs in sim.runStates" :key="rs.variationId">
      <ion-label>
        <h3>{{ rs.label }}</h3>
        <p v-if="rs.error" class="error">{{ rs.error }}</p>
      </ion-label>
      <ion-spinner slot="end" v-if="rs.phase === 'running' || rs.phase === 'submitted'" />
      <ion-badge slot="end" v-else :color="badgeColor(rs.phase)">{{ phaseLabel(rs.phase) }}</ion-badge>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonBadge, IonItem, IonLabel, IonList, IonListHeader, IonSpinner } from "@ionic/vue";
import { simulationStore } from "@/store/simulationStore";

const sim = simulationStore();

function phaseLabel(phase: string) {
  return { pending: translate("Queued"), done: translate("Done"), failed: translate("Failed") }[phase] || phase;
}
function badgeColor(phase: string) {
  return phase === "done" ? "success" : phase === "failed" ? "danger" : "medium";
}
</script>

<style scoped>
.error { color: var(--ion-color-danger); }
</style>
