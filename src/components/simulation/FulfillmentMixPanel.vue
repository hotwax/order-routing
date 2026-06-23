<template>
  <div v-if="anyAvailable" class="mix">
    <div v-for="row in availableRows" :key="row.label" class="mix-row">
      <h4>{{ row.isBaseline ? translate("Baseline") : row.label }}</h4>
      <div class="stacked">
        <div v-for="seg in segments(row)" :key="seg.type" class="seg" :style="{ width: seg.width, background: seg.color }" :title="`${seg.type}: ${seg.count}`"></div>
      </div>
      <div class="legend">
        <span v-for="seg in segments(row)" :key="seg.type"><i :style="{ background: seg.color }"></i>{{ seg.type }}: {{ seg.count }}</span>
      </div>
      <div class="policy">
        <span>{{ translate("Clearance from store") }}: {{ row.outcomes!.classification.fulfillmentMix!.clearanceFromStore }}</span>
        <span>{{ translate("New-season from DC") }}: {{ row.outcomes!.classification.fulfillmentMix!.newSeasonFromDC }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { translate } from "@common";
import type { OutcomeRow } from "@/utils/simulationResults";

const props = defineProps<{ rows: OutcomeRow[] }>();

const PALETTE = ["#3880ff", "#3dc2ff", "#5260ff", "#2dd36f", "#ffc409", "#eb445a"];

const availableRows = computed(() => props.rows.filter((r) => r.outcomes?.classification?.available && r.outcomes.classification.fulfillmentMix));
const anyAvailable = computed(() => availableRows.value.length > 0);

function segments(row: OutcomeRow) {
  const mix = row.outcomes!.classification.fulfillmentMix!;
  const entries = Object.entries(mix.byFacilityType);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
  return entries.map(([type, count], i) => ({
    type, count,
    width: `${(count / total) * 100}%`,
    color: PALETTE[i % PALETTE.length],
  }));
}
</script>

<style scoped>
.mix-row { margin-bottom: 16px; }
.mix-row h4 { margin: 0 0 6px; }
.stacked { display: flex; height: 16px; border-radius: 8px; overflow: hidden; background: var(--ion-color-light-shade); }
.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.78rem; margin-top: 4px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.policy { display: flex; gap: 16px; font-size: 0.8rem; margin-top: 6px; color: var(--ion-color-medium); }
</style>
