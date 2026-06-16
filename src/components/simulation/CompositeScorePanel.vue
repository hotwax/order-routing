<template>
  <ion-accordion-group>
    <ion-accordion value="score">
      <ion-item slot="header"><ion-label>{{ translate("Suggested winner") }}: {{ winnerLabel || translate("none") }}</ion-label></ion-item>
      <div slot="content" class="ion-padding">
        <p class="hint">{{ translate("Re-weight the objectives to see how the suggestion changes. Secondary to the panels above.") }}</p>

        <div class="weights">
          <div class="weight">
            <label>{{ translate("Unfillable") }} ({{ pct(norm.unfillable) }})</label>
            <ion-range :min="0" :max="1" :step="0.05" :value="raw.unfillable" @ionInput="onInput('unfillable', $event)" />
          </div>
          <div class="weight">
            <label>{{ translate("SLA") }} ({{ pct(norm.sla) }})</label>
            <ion-range :min="0" :max="1" :step="0.05" :value="raw.sla" @ionInput="onInput('sla', $event)" />
          </div>
          <div class="weight">
            <label>{{ translate("Shipping cost") }} ({{ pct(norm.cost) }})</label>
            <ion-range :min="0" :max="1" :step="0.05" :value="raw.cost" @ionInput="onInput('cost', $event)" />
          </div>
        </div>

        <table class="ranks">
          <thead><tr><th>{{ translate("Variant") }}</th><th>{{ translate("Score") }}</th></tr></thead>
          <tbody>
            <tr v-for="r in ranked" :key="r.label" :class="{ winner: r.label === winnerLabel }">
              <td>{{ r.isBaseline ? translate("Baseline") : r.label }}</td>
              <td>{{ (r.score * 100).toFixed(1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ion-accordion>
  </ion-accordion-group>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { translate } from "@common";
import { IonAccordion, IonAccordionGroup, IonItem, IonLabel, IonRange } from "@ionic/vue";
import { computeScores, selectWinner, renormalizeWeights, DEFAULT_WEIGHTS } from "@/util/simulationResults";

const props = defineProps<{ results: any }>();
const emit = defineEmits<{ (e: "winner", label: string | undefined): void }>();

const raw = reactive({ ...DEFAULT_WEIGHTS });
const norm = computed(() => renormalizeWeights(raw));

const scored = computed(() => computeScores(props.results, norm.value));
const ranked = computed(() => [...scored.value].sort((a, b) => b.score - a.score));
const winnerLabel = computed(() => selectWinner(scored.value));

function onInput(key: "unfillable" | "sla" | "cost", ev: any) {
  raw[key] = Number(ev.detail.value);
}

function pct(v: number) { return `${Math.round(v * 100)}%`; }

watch(winnerLabel, (v) => emit("winner", v), { immediate: true });
</script>

<style scoped>
.hint { color: var(--ion-color-medium); font-size: 0.8rem; }
.weights { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.weight label { font-size: 0.8rem; }
.ranks { width: 100%; border-collapse: collapse; }
.ranks th, .ranks td { padding: 6px; text-align: left; border-bottom: 1px solid var(--ion-color-light-shade); }
.ranks tr.winner { color: var(--ion-color-success); font-weight: 600; }
</style>
