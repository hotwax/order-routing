<template>
  <!-- What the safety stock rules on this page hold back at stores right now. -->
  <section class="safety-analytics">
    <StatCard :title="translate('Store stock held as safety stock')" :stat="formatPercent(storeHoldTotals.safetyStockShare)">
      <template #subtitle>
        <ion-note>{{ translate("{held} of {available} units, right now", { held: formatNumber(storeHoldTotals.safetyStockHeld), available: formatNumber(storeHoldTotals.available) }) }}</ion-note>
      </template>
    </StatCard>

    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ translate("Units held by rule") }}</ion-card-title>
        <ion-card-subtitle>{{ translate("Safety stock at stores, by the rule that set it") }}</ion-card-subtitle>
      </ion-card-header>
      <SectionState :status="status.reasons" :empty="!safetyReasons.length" :empty-message="translate('No units are held back at stores')">
        <ion-card-content>
          <SafetyReasonChips :reasons="safetyReasons" />
        </ion-card-content>
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
            <ion-label>{{ translate("See every store on the dashboard") }}</ion-label>
          </ion-item>
        </ion-list>
      </SectionState>
    </ion-card>
  </section>
</template>

<script setup lang="ts">
import { StatCard, translate } from "@common";
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonItem, IonLabel, IonList, IonNote, IonProgressBar } from "@ionic/vue";
import { computed } from "vue";
import SafetyReasonChips from "@/components/diagnostics/SafetyReasonChips.vue";
import SectionState from "@/components/diagnostics/SectionState.vue";
import { useSafetyStockSummary } from "@/composables/useSafetyStockSummary";
import { useRoutingDiagnosticsStore } from "@/store/routingDiagnosticsStore";
import { SHIPPING_REASON } from "@/utils/routingDiagnostics";

const TOP_STORE_COUNT = 5;

const diagnostics = useRoutingDiagnosticsStore();
const { storeHolds, storeHoldTotals, reasonLegend } = useSafetyStockSummary();

const status = computed(() => diagnostics.status);
// This page is about safety stock, so units held only because shipping is off are left out.
const safetyReasons = computed(() => reasonLegend.value.filter((reason) => reason.key !== SHIPPING_REASON));
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
