<template>
  <div class="ion-padding">
    <simulation-progress v-if="sim.isRunning" />

    <ion-button fill="clear" @click="sim.view = 'editor'">
      <ion-icon slot="start" :icon="arrowBackOutline" />{{ translate("Back to editor") }}
    </ion-button>

    <template v-if="sim.results">
      <p v-if="sim.results.simulationRan === false" class="warn">{{ translate("The simulator did not run — no numbers to report.") }}</p>
      <p v-if="sim.results.partial" class="warn">{{ translate("Some variations did not complete — results are partial.") }}</p>
      <ion-button
        v-if="sim.lastSimulationId"
        size="small" fill="outline"
        @click="router.push(`/simulate/history/${sim.lastSimulationId}`)"
      >
        {{ translate("View saved result") }}
      </ion-button>

      <!-- ①②③ headline -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("Outcomes") }}</ion-card-title></ion-card-header>
        <ion-card-content>
          <outcome-headline :rows="rows" :winner-label="winnerLabel" />
        </ion-card-content>
      </ion-card>

      <!-- Tradeoff -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("SLA vs. cost tradeoff") }}</ion-card-title></ion-card-header>
        <ion-card-content><tradeoff-chart :rows="rows" /></ion-card-content>
      </ion-card>

      <!-- Expedited -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("Expedited shipping") }}</ion-card-title></ion-card-header>
        <ion-card-content><expedited-panel :rows="rows" /></ion-card-content>
      </ion-card>

      <!-- Stockouts -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("New-season stockouts") }}</ion-card-title></ion-card-header>
        <ion-card-content><stockout-panel :rows="rows" /></ion-card-content>
      </ion-card>

      <!-- Fulfillment mix (self-hides when classification unavailable) -->
      <ion-card v-if="hasClassification">
        <ion-card-header><ion-card-title>{{ translate("Fulfillment mix") }}</ion-card-title></ion-card-header>
        <ion-card-content><fulfillment-mix-panel :rows="rows" /></ion-card-content>
      </ion-card>

      <!-- Composite score (collapsed) -->
      <ion-card>
        <ion-card-content><composite-score-panel :results="sim.results" @winner="onWinner" /></ion-card-content>
      </ion-card>

      <!-- Advanced details (collapsed) -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("Advanced / per-order details") }}</ion-card-title></ion-card-header>
        <ion-card-content><advanced-details :results="sim.results" /></ion-card-content>
      </ion-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { translate } from "@common";
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon } from "@ionic/vue";
import { arrowBackOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";
import { toRows } from "@/util/outcomes";
import SimulationProgress from "./SimulationProgress.vue";
import OutcomeHeadline from "./OutcomeHeadline.vue";
import TradeoffChart from "./TradeoffChart.vue";
import ExpeditedPanel from "./ExpeditedPanel.vue";
import StockoutPanel from "./StockoutPanel.vue";
import FulfillmentMixPanel from "./FulfillmentMixPanel.vue";
import CompositeScorePanel from "./CompositeScorePanel.vue";
import AdvancedDetails from "./AdvancedDetails.vue";

const sim = simulationStore();
const router = useRouter();

const rows = computed(() => toRows(sim.results));
const hasClassification = computed(() => rows.value.some((r) => r.outcomes?.classification?.available));

const winnerLabel = ref<string | undefined>(undefined);
function onWinner(label: string | undefined) { winnerLabel.value = label; }
</script>

<style scoped>
.warn { color: var(--ion-color-warning-shade); }
</style>
