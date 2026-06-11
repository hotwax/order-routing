<template>
  <div class="run-panel">
    <div class="controls">
      <ion-button :disabled="store.isRunningVariation" @click="store.runComparison(500)">
        {{ store.isRunningVariation ? translate("Running…") : translate("Run comparison") }}
      </ion-button>
      <ion-button fill="outline" :disabled="store.isRunningParent" @click="store.rerunParent(500)">
        {{ translate("Re-run parent") }}
      </ion-button>
    </div>

    <!-- Variation run: synchronous, no progress stream -> indeterminate + elapsed timer. -->
    <div v-if="store.isRunningVariation" class="prog">
      <ion-label>{{ translate("Simulating variation") }} ({{ elapsed }}s) — {{ translate("this can take 25–150s") }}</ion-label>
      <ion-progress-bar type="indeterminate" />
    </div>

    <!-- Parent run: streams real progress. -->
    <div v-if="store.isRunningParent" class="prog">
      <ion-label>{{ translate("Running parent group") }}</ion-label>
      <ion-progress-bar :value="parentRatio" />
    </div>

    <ion-note v-if="store.runError" color="danger">{{ store.runError }}</ion-note>

    <variation-compare-table v-if="store.variationResult" />
    <ion-note v-if="store.variationResult && !parentReady" color="medium">
      {{ translate("Parent run unavailable — showing variation results only.") }}
    </ion-note>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { translate } from "@common";
import { IonButton, IonLabel, IonNote, IonProgressBar } from "@ionic/vue";
import { variationStore } from "@/store/variationStore";
import VariationCompareTable from "./VariationCompareTable.vue";

const store = variationStore();
const elapsed = ref(0);
let timer: any = null;

watch(() => store.isRunningVariation, (running) => {
  if (running) { elapsed.value = 0; timer = setInterval(() => (elapsed.value += 1), 1000); }
  else if (timer) { clearInterval(timer); timer = null; }
});
onUnmounted(() => { if (timer) clearInterval(timer); });

const parentRatio = computed(() => {
  const p = store.parentProgress;
  if (!p || !p.ordersInScope) return 0;
  return Math.min(1, (p.ordersProcessed || 0) / p.ordersInScope);
});
const parentReady = computed(() => !!store.parentResultByParentId[store.parentRoutingGroupId]);
</script>

<style scoped>
.controls { display: flex; gap: var(--spacer-sm); margin-bottom: var(--spacer-base); }
.prog { margin: var(--spacer-sm) 0; }
</style>
