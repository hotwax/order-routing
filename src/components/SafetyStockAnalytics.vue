<template>
  <!-- What the safety stock rules on this page hold back at stores right now. -->
  <section class="safety-analytics">
    <StatCard :title="translate('Store stock held as safety stock')" :stat="formatPercent(storeHoldTotals.safetyStockShare)">
      <template #subtitle>
        <ion-note>{{ translate("{held} of {available} units, right now", { held: formatNumber(storeHoldTotals.safetyStockHeld), available: formatNumber(storeHoldTotals.available) }) }}</ion-note>
      </template>
      <template v-if="shareTrend.length > 1">
        <Sparkline :points="shareTrend.map((share) => share ?? 0)" color="warning" :label="translate('Safety-stock share by week')" />
        <ion-note>{{ translate("{from} to {to}", { from: historyLabels[0], to: historyLabels[historyLabels.length - 1] }) }}</ion-note>
      </template>
    </StatCard>

    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ translate("Units held by rule") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Safety stock at stores, by the rule that set it") }}</ion-card-subtitle>
      </ion-card-header>
      <SectionState :status="status.reasons" :empty="!safetyReasons.length" :empty-message="translate('No units are held back at stores')">
        <ion-list lines="full">
          <ion-item
            v-for="reason in safetyReasons"
            :key="reason.key"
            :button="!!reason.ruleId"
            :detail="!!reason.ruleId"
            :router-link="reason.ruleId ? `/update-safety-stock/${reason.ruleId}` : undefined"
          >
            <ion-icon slot="start" :icon="ellipse" :color="reason.tone" />
            <ion-label class="ion-text-wrap">
              {{ reason.key }}
              <p>{{ translate("{share} of safety stock", { share: formatPercent(safetyTotal ? reason.total / safetyTotal : null) }) }}</p>
            </ion-label>
            <ion-note slot="end">
              {{ formatNumber(reason.total) }}
            </ion-note>
          </ion-item>
        </ion-list>
      </SectionState>
    </ion-card>

    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ translate("Stores holding the most") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Safety-stock hold divided by units available before it") }}</ion-card-subtitle>
      </ion-card-header>
      <SectionState :status="status.inventory" :empty="!topStores.length" :empty-message="translate('No store inventory found')">
        <ion-list lines="full">
          <ion-item v-for="hold in topStores" :key="hold.facilityId">
            <ion-label>
              {{ hold.facilityName }}
              <p>{{ translate("{held} of {available} units", { held: formatNumber(hold.safetyStockHeld), available: formatNumber(hold.available) }) }}</p>
              <ion-progress-bar :value="hold.safetyStockShare ?? 0" :color="(hold.safetyStockShare ?? 0) > (storeHoldTotals.safetyStockShare ?? 0) ? 'warning' : 'medium'" />
            </ion-label>
            <ion-note slot="end">
              {{ formatPercent(hold.safetyStockShare) }}
            </ion-note>
          </ion-item>
          <ion-item router-link="/dashboard" button lines="none">
            <ion-label>{{ translate("See every store and the weekly trend on the dashboard") }}</ion-label>
          </ion-item>
        </ion-list>
      </SectionState>
    </ion-card>
  </section>
</template>

<script setup lang="ts">
import { Sparkline, StatCard, translate } from "@common";
import { IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonNote, IonProgressBar } from "@ionic/vue";
import { ellipse } from "ionicons/icons";
import { computed } from "vue";
import SectionState from "@/components/diagnostics/SectionState.vue";
import { useSafetyStockSummary } from "@/composables/useSafetyStockSummary";
import { useRoutingDiagnosticsStore } from "@/store/routingDiagnosticsStore";
import { SHIPPING_REASON } from "@/utils/routingDiagnostics";

const TOP_STORE_COUNT = 5;

const diagnostics = useRoutingDiagnosticsStore();
const { storeHolds, storeHoldTotals, historyLabels, shareTrend, reasonLegend } = useSafetyStockSummary();

const status = computed(() => diagnostics.status);
// This page is about safety stock, so units held only because shipping is off are left out.
const safetyReasons = computed(() => reasonLegend.value.filter((reason) => reason.key !== SHIPPING_REASON));
const safetyTotal = computed(() => safetyReasons.value.reduce((sum, reason) => sum + reason.total, 0));
const topStores = computed(() => storeHolds.value.slice(0, TOP_STORE_COUNT));

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if(value === null || value === undefined) {return "-";}

  return `${(value * 100).toFixed(1)}%`;
}
</script>

<style scoped>
.safety-analytics {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-sm);
  padding: var(--spacer-base) 0 0;
}

ion-card {
  margin: 0;
}
</style>
