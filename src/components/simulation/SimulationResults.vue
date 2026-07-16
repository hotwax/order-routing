<template>
  <div class="ion-padding">
    <SimulationProgress v-if="sim.isRunning" />

    <!-- "Back to editor" only applies to the standalone editor/results view toggle. When embedded
         (e.g. in the Variations rail's results modal or the past-run detail page), the host owns
         its own close/back affordance, so hide it. -->
    <ion-button v-if="!embedded" fill="clear" @click="sim.view = 'editor'">
      <ion-icon slot="start" :icon="arrowBackOutline" />{{ translate("Back to editor") }}
    </ion-button>

    <!-- H2 variation run: synchronous (no event stream) -> indeterminate bar; then per-routing compare.
         runCompareError is included so a failed run shows its error (the note below) instead of a blank
         pane — otherwise, on error (no result, not running) this whole block would render nothing. -->
    <template v-if="sim.variationRunResult || sim.isRunningVariationRun || sim.runCompareError">
      <div v-if="sim.isRunningVariationRun" class="vrun-progress">
        <ion-label>{{ translate("Simulating variation") }} — {{ translate("this can take 25–150s") }}</ion-label>
        <ion-progress-bar type="indeterminate" />
      </div>
      <ion-note v-if="sim.runCompareError" color="danger">{{ sim.runCompareError }}</ion-note>

      <ion-list v-if="sim.variationRunResult">
        <ion-list-header><ion-label>{{ translate("Per-routing results") }}</ion-label></ion-list-header>
        <ion-item v-for="row in sim.variationCompareRows" :key="row.routingName + (row.variationRoutingId || row.parentRoutingId)" button detail @click="openRowDetail(row)">
          <ion-label>
            {{ row.routingName }}
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
          <OutcomeHeadline :rows="rows" :winner-label="winnerLabel" />
        </ion-card-content>
      </ion-card>

      <!-- Tradeoff -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("SLA vs. cost tradeoff") }}</ion-card-title></ion-card-header>
        <ion-card-content><TradeoffChart :rows="rows" /></ion-card-content>
      </ion-card>

      <!-- Expedited -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("Expedited shipping") }}</ion-card-title></ion-card-header>
        <ion-card-content><ExpeditedPanel :rows="rows" /></ion-card-content>
      </ion-card>

      <!-- Stockouts -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("New-season stockouts") }}</ion-card-title></ion-card-header>
        <ion-card-content><StockoutPanel :rows="rows" /></ion-card-content>
      </ion-card>

      <!-- Fulfillment mix (self-hides when classification unavailable) -->
      <ion-card v-if="hasClassification">
        <ion-card-header><ion-card-title>{{ translate("Fulfillment mix") }}</ion-card-title></ion-card-header>
        <ion-card-content><FulfillmentMixPanel :rows="rows" /></ion-card-content>
      </ion-card>

      <!-- Composite score (collapsed) -->
      <ion-card>
        <ion-card-content><CompositeScorePanel :results="sim.results" @winner="onWinner" /></ion-card-content>
      </ion-card>

      <!-- Advanced details (collapsed) -->
      <ion-card>
        <ion-card-header><ion-card-title>{{ translate("Advanced / per-order details") }}</ion-card-title></ion-card-header>
        <ion-card-content><AdvancedDetails :results="sim.results" /></ion-card-content>
      </ion-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { translate } from "@common";
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonProgressBar, modalController } from "@ionic/vue";
import { arrowBackOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";
import type { CompareRow } from "@/types/variation";
import { toRows } from "@/utils/simulationResults";
import SimulationProgress from "./SimulationProgress.vue";
import OutcomeHeadline from "./OutcomeHeadline.vue";
import TradeoffChart from "./TradeoffChart.vue";
import ExpeditedPanel from "./ExpeditedPanel.vue";
import StockoutPanel from "./StockoutPanel.vue";
import FulfillmentMixPanel from "./FulfillmentMixPanel.vue";
import CompositeScorePanel from "./CompositeScorePanel.vue";
import AdvancedDetails from "./AdvancedDetails.vue";
import RoutingRunDetailModal from "./RoutingRunDetailModal.vue";

/* eslint-disable no-undef */
defineProps<{ embedded?: boolean }>();
/* eslint-enable no-undef */

const sim = simulationStore();
const router = useRouter();

const rows = computed(() => toRows(sim.results));
const hasClassification = computed(() => rows.value.some((r) => r.outcomes?.classification?.available));

const winnerLabel = ref<string | undefined>(undefined);
function onWinner(label: string | undefined) { winnerLabel.value = label; }

// H2 variation compare helpers.
const n = (v: number | undefined) => (v == null ? "—" : String(v));
function compareSignal(row: CompareRow): string {
  const v = row.variation;
  if (!v) return translate("Not run in this variation");
  if (v.eligibleEntryCount === 0) return translate("0 eligible — filter matched nothing");
  if (v.brokeredItemCount === 0) return translate("Eligible but nothing brokered — no available inventory");
  return "";
}

async function openRowDetail(row: CompareRow) {
  const modal = await modalController.create({
    component: RoutingRunDetailModal,
    componentProps: { row },
  });
  await modal.present();
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
