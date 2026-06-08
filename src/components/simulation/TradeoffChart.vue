<template>
  <div class="tradeoff">
    <p v-if="points.length < 2" class="note">{{ translate("Tradeoff chart needs cost + SLA metrics") }}</p>
    <svg v-else viewBox="0 0 320 240" class="chart" role="img">
      <!-- axes -->
      <line x1="40" y1="200" x2="310" y2="200" class="axis" />
      <line x1="40" y1="10" x2="40" y2="200" class="axis" />
      <text x="175" y="232" class="axis-label">{{ translate("Shipping cost") }} →</text>
      <text x="12" y="105" class="axis-label" transform="rotate(-90 12 105)">{{ translate("SLA %") }} →</text>
      <!-- frontier hint: upper-left is best -->
      <text x="48" y="22" class="frontier">{{ translate("Best") }}</text>
      <!-- points -->
      <g v-for="p in points" :key="p.label">
        <circle class="point" :class="{ baseline: p.isBaseline }" :cx="p.x" :cy="p.y" r="5">
          <title>{{ p.label }}: {{ pct(p.sla) }}, {{ money(p) }}</title>
        </circle>
        <text :x="p.x + 8" :y="p.y + 4" class="point-label">{{ p.label }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { translate } from "@common";
import { formatPercent, formatMoney } from "@/util/outcomes";
import type { OutcomeRow } from "@/util/outcomes";

const props = defineProps<{ rows: OutcomeRow[] }>();

const PLOT = { left: 40, right: 310, top: 10, bottom: 200 };

interface Pt { label: string; isBaseline: boolean; cost: number; currency: string; sla: number; x: number; y: number }

const points = computed<Pt[]>(() => {
  const usable = props.rows.filter((r) => r.outcomes?.cost?.available && r.outcomes?.sla?.available);
  if (usable.length < 2) return [];
  const costs = usable.map((r) => r.outcomes!.cost.totalShippingCost);
  const slas = usable.map((r) => r.outcomes!.sla.complianceRate);
  const minC = Math.min(...costs), maxC = Math.max(...costs);
  const minS = Math.min(...slas), maxS = Math.max(...slas);
  const spanC = maxC - minC || 1;
  const spanS = maxS - minS || 1;
  return usable.map((r) => {
    const cost = r.outcomes!.cost.totalShippingCost;
    const sla = r.outcomes!.sla.complianceRate;
    // lower cost -> left (smaller x); higher SLA -> top (smaller y)
    const x = PLOT.left + ((cost - minC) / spanC) * (PLOT.right - PLOT.left);
    const y = PLOT.bottom - ((sla - minS) / spanS) * (PLOT.bottom - PLOT.top);
    return { label: r.isBaseline ? translate("Baseline") : r.label, isBaseline: r.isBaseline, cost, currency: r.outcomes!.cost.currency, sla, x, y };
  });
});

function pct(v: number) { return formatPercent(v); }
function money(p: Pt) { return formatMoney(p.cost, p.currency); }
</script>

<style scoped>
.note { color: var(--ion-color-medium); font-size: 0.85rem; }
.chart { width: 100%; max-width: 480px; }
.axis { stroke: var(--ion-color-medium); stroke-width: 1; }
.axis-label { fill: var(--ion-color-medium); font-size: 10px; }
.frontier { fill: var(--ion-color-success); font-size: 9px; }
.point { fill: var(--ion-color-primary); }
.point.baseline { fill: var(--ion-color-medium); }
.point-label { fill: var(--ion-color-dark); font-size: 9px; }
</style>
