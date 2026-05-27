<template>
  <div>
    <!-- Live per-batch panels (one per job): bar + counters + rolling last-50 order events -->
    <div v-for="bp in sim.batchProgress" :key="bp.batchIndex" class="batch-panel">
      <h3>
        {{ bp.phaseLabel || translate("Starting…") }}
        <small v-if="bp.phaseCount">· {{ translate("Round") }} {{ bp.phaseIndex }}/{{ bp.phaseCount }}</small>
      </h3>
      <ion-progress-bar :value="bp.ordersInScope ? bp.ordersProcessed / bp.ordersInScope : 0" />
      <p class="counts">
        {{ bp.ordersProcessed }}/{{ bp.ordersInScope }} ·
        {{ translate("Brokered") }} {{ bp.brokered }} · {{ translate("Queued") }} {{ bp.queued }}
      </p>
      <ion-list v-if="bp.events.length">
        <ion-item v-for="ev in reversed(bp.events)" :key="ev.seq" lines="none">
          <ion-label class="ion-text-wrap">
            {{ ev.orderId }} · <span :class="reasonClass(ev.finalReason)">{{ ev.finalReason }}</span>
            · {{ ev.facilityId || translate("unfilled") }}
          </ion-label>
        </ion-item>
      </ion-list>
    </div>

    <!-- Per-variation summary (unchanged) -->
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
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonBadge, IonItem, IonLabel, IonList, IonListHeader, IonProgressBar, IonSpinner } from "@ionic/vue";
import { simulationStore } from "@/store/simulationStore";
import { OrderEvent } from "@/types/simulation";

const sim = simulationStore();

function reversed(events: OrderEvent[]) { return [...events].reverse(); } // newest first

function reasonClass(reason: string) {
  if (reason === "FULLY_BROKERED" || reason === "PARTIALLY_BROKERED") return "ok";
  if (reason === "QUEUED") return "muted";
  return "warn"; // NO_RULE_MATCH / unfillable / etc.
}

function phaseLabel(phase: string) {
  return { pending: translate("Queued"), done: translate("Done"), failed: translate("Failed") }[phase] || phase;
}
function badgeColor(phase: string) {
  return phase === "done" ? "success" : phase === "failed" ? "danger" : "medium";
}
</script>

<style scoped>
.batch-panel { margin-bottom: var(--spacer-base); padding: var(--spacer-sm); border: 1px solid var(--ion-color-light-shade); border-radius: 8px; }
.batch-panel h3 { margin: 0 0 6px; font-size: 15px; }
.batch-panel h3 small { color: var(--ion-color-medium); font-weight: 400; }
.counts { font-size: 13px; color: var(--ion-color-medium); margin: 6px 0; }
.ok { color: var(--ion-color-success); }
.muted { color: var(--ion-color-medium); }
.warn { color: var(--ion-color-warning-shade); }
.error { color: var(--ion-color-danger); }
</style>
