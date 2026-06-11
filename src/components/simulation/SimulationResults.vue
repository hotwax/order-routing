<template>
  <div class="ion-padding">
    <simulation-progress v-if="sim.isRunning" />

    <ion-button fill="clear" @click="sim.view = 'editor'">
      <ion-icon slot="start" :icon="arrowBackOutline" />{{ translate("Back to editor") }}
    </ion-button>

    <!-- H2 variation run: synchronous (no event stream) -> indeterminate bar; then per-routing compare. -->
    <template v-if="sim.variationRunResult || sim.isRunningVariationRun">
      <div v-if="sim.isRunningVariationRun" class="vrun-progress">
        <ion-label>{{ translate("Simulating variation") }} — {{ translate("this can take 25–150s") }}</ion-label>
        <ion-progress-bar type="indeterminate" />
      </div>
      <ion-note v-if="sim.runCompareError" color="danger">{{ sim.runCompareError }}</ion-note>

      <ion-list v-if="sim.variationRunResult">
        <ion-list-header><ion-label>{{ translate("Per-routing results") }}</ion-label></ion-list-header>
        <ion-item v-for="row in sim.variationCompareRows" :key="row.routingName + (row.variationRoutingId || row.parentRoutingId)">
          <ion-label>
            <h3>{{ row.routingName }}</h3>
            <div class="cmp">
              <span class="metric"><span class="lbl">{{ translate("Eligible") }}</span><span class="val">{{ n(row.parent?.eligibleEntryCount) }} → <strong>{{ n(row.variation?.eligibleEntryCount) }}</strong></span></span>
              <span class="metric"><span class="lbl">{{ translate("Brokered") }}</span><span class="val">{{ n(row.parent?.brokeredItemCount) }} → {{ n(row.variation?.brokeredItemCount) }}</span></span>
              <span class="metric"><span class="lbl">{{ translate("Queued") }}</span><span class="val">{{ n(row.parent?.queuedItemCount) }} → {{ n(row.variation?.queuedItemCount) }}</span></span>
            </div>
            <p v-if="compareSignal(row)" :class="row.variation && row.variation.eligibleEntryCount === 0 ? 'sig-warn' : 'sig-info'">{{ compareSignal(row) }}</p>
          </ion-label>
        </ion-item>
        <ion-note v-if="!sim.parentRunByGroupId[sim.routingGroupId]" color="medium" class="ion-padding-horizontal">
          {{ translate("Parent run unavailable — showing variation results only.") }}
        </ion-note>
      </ion-list>
    </template>

    <template v-else-if="sim.results">
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
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonProgressBar } from "@ionic/vue";
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

// H2 variation compare helpers.
const n = (v: number | undefined) => (v == null ? "—" : String(v));
function compareSignal(row: any): string {
  const v = row.variation;
  if (!v) return translate("Not run in this variation");
  if (v.eligibleEntryCount === 0) return translate("0 eligible — filter matched nothing");
  if (v.brokeredItemCount === 0) return translate("Eligible but nothing brokered — no available inventory");
  return "";
}
</script>

<style scoped>
.warn { color: var(--ion-color-warning-shade); }
.vrun-progress { margin: var(--spacer-sm) 0; }
.cmp { display: flex; gap: var(--spacer-base); flex-wrap: wrap; }
.metric { display: flex; flex-direction: column; }
.lbl { font-size: 0.75rem; color: var(--ion-color-medium); }
.sig-warn { color: var(--ion-color-warning); }
.sig-info { color: var(--ion-color-medium); }
</style>
