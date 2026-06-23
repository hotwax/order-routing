<template>
  <div class="headline-grid">
    <div v-for="row in rows" :key="row.label" class="headline-col" :class="{ winner: row.label === winnerLabel }">
      <h3 class="col-title">{{ row.isBaseline ? translate("Baseline") : row.label }}</h3>

      <!-- Fill rate with explicit 100% goal marker -->
      <div class="metric">
        <div class="metric-value">{{ pct(fillRateOf(row)) }}</div>
        <div class="metric-label">{{ translate("Fill rate") }}</div>
        <div class="gauge"><div class="gauge-fill" :style="{ width: gaugeWidth(row) }"></div><div class="gauge-goal" :title="translate('Goal 100%')"></div></div>
        <div class="metric-sub">{{ row.groupRun?.brokeredItemCount ?? '—' }} / {{ row.groupRun?.attemptedItemCount ?? '—' }}</div>
      </div>

      <!-- ① Unfillable -->
      <div class="metric primary">
        <div class="metric-value">{{ row.outcomes?.unfillable?.itemCount ?? '—' }}</div>
        <div class="metric-label">{{ translate("Unfillable items") }}</div>
        <div class="metric-sub">{{ row.outcomes ? (row.outcomes.unfillable.orderCount + ' ' + translate('orders')) : '' }}</div>
      </div>

      <!-- ② SLA -->
      <div class="metric">
        <div class="metric-value">{{ row.outcomes?.sla?.available ? pct(row.outcomes.sla.complianceRate) : '—' }}</div>
        <div class="metric-label">{{ translate("SLA compliance") }}</div>
        <div class="metric-sub" v-if="row.outcomes?.sla?.available">
          {{ row.outcomes.sla.avgEstimatedTransitDays }}d {{ translate("est") }} / {{ row.outcomes.sla.avgPromisedDays }}d {{ translate("promised") }}
        </div>
      </div>

      <!-- ③ Shipping cost -->
      <div class="metric">
        <div class="metric-value">{{ costText(row) }}</div>
        <div class="metric-label">{{ translate("Shipping cost") }}</div>
        <div class="metric-sub saved" v-if="savedText(row)">{{ savedText(row) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { translate, commonUtil } from "@common";
import { fillRateOf, formatPercent, moneySaved } from "@/utils/simulationResults";
import type { OutcomeRow } from "@/utils/simulationResults";

const props = defineProps<{ rows: OutcomeRow[]; winnerLabel?: string }>();

function pct(v: number | null) { return formatPercent(v); }

function gaugeWidth(row: OutcomeRow) {
  const r = fillRateOf(row);
  return r === null ? "0%" : `${Math.min(100, Math.max(0, r * 100))}%`;
}

function costText(row: OutcomeRow) {
  const c = row.outcomes?.cost;
  if (!c?.available) return "—";
  return commonUtil.formatCurrency(c.totalShippingCost, c.currency);
}

/** Money saved vs baseline (variants only); green when positive. */
function savedText(row: OutcomeRow) {
  if (row.isBaseline) return "";
  const baseline = props.rows.find((r) => r.isBaseline);
  if (!baseline) return "";
  const saved = moneySaved(baseline, row);
  if (saved === null || saved === 0) return "";
  const currency = row.outcomes?.cost?.currency ?? "USD";
  const prefix = saved > 0 ? translate("saved") : translate("over");
  return `${prefix} ${commonUtil.formatCurrency(Math.abs(saved), currency)}`;
}
</script>

<style scoped>
.headline-grid { display: flex; gap: 16px; flex-wrap: wrap; }
.headline-col { flex: 1 1 200px; border: 1px solid var(--ion-color-light-shade); border-radius: 8px; padding: 12px; }
.headline-col.winner { border-color: var(--ion-color-success); box-shadow: 0 0 0 1px var(--ion-color-success); }
.col-title { margin: 0 0 12px; font-size: 0.95rem; }
.metric { margin-bottom: 14px; }
.metric.primary .metric-value { color: var(--ion-color-primary); }
.metric-value { font-size: 1.6rem; font-weight: 600; }
.metric-label { font-size: 0.8rem; color: var(--ion-color-medium); }
.metric-sub { font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 2px; }
.metric-sub.saved { color: var(--ion-color-success); }
.gauge { position: relative; height: 6px; background: var(--ion-color-light-shade); border-radius: 3px; margin: 6px 0; }
.gauge-fill { height: 100%; background: var(--ion-color-primary); border-radius: 3px; }
.gauge-goal { position: absolute; top: -2px; right: 0; width: 2px; height: 10px; background: var(--ion-color-success); }
</style>
