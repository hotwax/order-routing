<template>
  <div class="expedited">
    <div v-for="row in rows" :key="row.label" class="exp-row">
      <h4>{{ row.isBaseline ? translate("Baseline") : row.label }}</h4>
      <template v-if="row.outcomes?.cost?.available">
        <div class="split-bar">
          <div class="seg ground" :style="{ width: groundPct(row) }" :title="translate('Ground')"></div>
          <div class="seg air" :style="{ width: airPct(row) }" :title="translate('Air')"></div>
        </div>
        <div class="legend">
          <span class="ground">{{ translate("Ground") }}: {{ row.outcomes.cost.expedited.groundItems }} ({{ money(row.outcomes.cost.expedited.groundCost, row) }})</span>
          <span class="air">{{ translate("Air") }}: {{ row.outcomes.cost.expedited.airItems }} ({{ money(row.outcomes.cost.expedited.airCost, row) }})</span>
        </div>
      </template>
      <p v-else class="note">—</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { translate, commonUtil } from "@common";
import type { OutcomeRow } from "@/utils/simulationResults";

defineProps<{ rows: OutcomeRow[] }>();

function totalItems(row: OutcomeRow) {
  const e = row.outcomes!.cost.expedited;
  return (e.groundItems + e.airItems) || 1;
}
function groundPct(row: OutcomeRow) { return `${(row.outcomes!.cost.expedited.groundItems / totalItems(row)) * 100}%`; }
function airPct(row: OutcomeRow) { return `${(row.outcomes!.cost.expedited.airItems / totalItems(row)) * 100}%`; }
function money(amount: number, row: OutcomeRow) { return commonUtil.formatCurrency(amount, row.outcomes!.cost.currency); }
</script>

<style scoped>
.exp-row { margin-bottom: 16px; }
.exp-row h4 { margin: 0 0 6px; }
.split-bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: var(--ion-color-light-shade); }
.seg.ground { background: var(--ion-color-success); }
.seg.air { background: var(--ion-color-warning); }
.legend { display: flex; gap: 16px; font-size: 0.78rem; margin-top: 4px; }
.legend .ground { color: var(--ion-color-success-shade); }
.legend .air { color: var(--ion-color-warning-shade); }
.note { color: var(--ion-color-medium); }
</style>
