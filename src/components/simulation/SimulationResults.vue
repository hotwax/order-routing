<template>
  <div class="ion-padding">
    <ion-button v-if="!run && sim.lastSimulationId" size="small" fill="outline"
      data-testid="view-saved-simulation" @click="router.push(`/simulate/history/${sim.lastSimulationId}`)">
      {{ translate("View saved result") }}
    </ion-button>

    <ion-note v-if="!run && (sim.baselineRunError || sim.runCompareError)" color="danger" class="run-error">
      {{ sim.baselineRunError || sim.runCompareError }}
    </ion-note>

    <template v-if="displayRun?.simulation">
      <ion-item lines="none">
        <ion-label>
          <h2>{{ translate("Simulation") }} {{ displayRun.simulation.simulationId }}</h2>
          <p>{{ displayRun.simulation.routingGroupId }}</p>
        </ion-label>
        <ion-spinner v-if="isRunning" slot="end" name="crescent" />
        <ion-badge v-else slot="end" :color="isFailed ? 'danger' : 'success'">{{ statusLabel }}</ion-badge>
      </ion-item>

      <ion-list v-if="displayRun.variants?.length">
        <ion-item v-for="variant in displayRun.variants" :key="variant.variantSeqId">
          <ion-label class="ion-text-wrap">
            <h2>{{ variant.isBaseline === 'Y' ? translate('Baseline') : (variant.label || translate('Variation')) }}</h2>
            <p v-if="variant.failureReason" class="failure">{{ variant.failureReason }}</p>
            <p>{{ translate('Attempted') }}: {{ count(variant.attemptedItemCount) }} ·
              {{ translate('Brokered') }}: {{ count(variant.brokeredItemCount) }} ·
              {{ translate('Queued') }}: {{ count(variant.queuedItemCount) }}</p>
            <p v-if="canCompare(variant)" class="comparison">
              {{ translate('Compared with baseline') }} ·
              {{ translate('Brokered') }}: {{ difference(variant.brokeredItemCount, baselineVariant?.brokeredItemCount) }} ·
              {{ translate('Queued') }}: {{ difference(variant.queuedItemCount, baselineVariant?.queuedItemCount) }}
            </p>
          </ion-label>
          <ion-badge v-if="variant.failed === 'Y'" slot="end" color="danger">{{ translate('Failed') }}</ion-badge>
        </ion-item>
      </ion-list>
      <ion-note v-else class="ion-padding-horizontal" color="medium">
        {{ isRunning ? translate('Waiting for the first result…') : translate('No variant results were recorded.') }}
      </ion-note>

      <ion-note v-if="displayRun.simulation.statusId === 'BRSIM_COMPLETE' && displayRun.simulation.attemptedItemCount != null && Number(displayRun.simulation.attemptedItemCount) === 0"
        color="warning" class="ion-padding-horizontal empty-run-note">
        {{ translate('No orders were attempted. Check that the active datastore contains approved orders waiting in a queue and that this routing group’s filters include them.') }}
      </ion-note>

      <section v-if="hasPersistedOutcomes && displayRun.variants?.length" class="item-outcomes">
        <h2>{{ translate('Simulation details') }}</h2>
        <ion-note v-if="isFailed" color="medium" class="ion-padding-horizontal">
          {{ translate('This run failed. Any outcomes below were recorded before the failure and may be incomplete.') }}
        </ion-note>
        <ion-item>
          <ion-select v-model="selectedVariantSeqId" :label="translate('Variant')" label-placement="stacked" interface="popover">
            <ion-select-option v-for="variant in displayRun.variants" :key="variant.variantSeqId" :value="variant.variantSeqId">
              {{ variant.isBaseline === 'Y' ? translate('Baseline') : (variant.label || translate('Variation')) }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <h2>{{ translate('Routing outcomes') }}</h2>
        <ion-item v-if="rulesLoading" lines="none">
          <ion-label>{{ translate('Loading routing outcomes…') }}</ion-label>
          <ion-spinner slot="end" name="crescent" />
        </ion-item>
        <ion-item v-else-if="rulesError" lines="none">
          <ion-label color="danger" class="ion-text-wrap">{{ rulesError }}</ion-label>
          <ion-button slot="end" fill="outline" @click="loadRules">{{ translate('Retry') }}</ion-button>
        </ion-item>
        <ion-note v-else-if="!rules.length" class="ion-padding-horizontal" color="medium">
          {{ translate('No routing outcomes were recorded for this variant.') }}
        </ion-note>
        <ion-list v-else>
          <ion-item v-for="rule in rules" :key="rule.ruleResultSeqId">
            <ion-label class="ion-text-wrap">
              <h3>{{ translate('Routing') }} {{ rule.orderRoutingId || rule.ruleResultSeqId }}</h3>
              <p><template v-if="rule.eligibleEntryCount != null">{{ translate('Eligible') }}: {{ count(rule.eligibleEntryCount) }} · </template>{{ translate('Attempted') }}: {{ count(rule.attemptedItemCount) }}</p>
              <p>{{ translate('Brokered') }}: {{ count(rule.brokeredItemCount) }} ·
                {{ translate('Queued') }}: {{ count(rule.queuedItemCount) }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
        <div v-if="rulesTotal > pageSize" class="item-pagination">
          <ion-button fill="clear" :disabled="rulePageIndex === 0 || rulesLoading" @click="rulePageIndex--">{{ translate('Previous rules') }}</ion-button>
          <ion-note>{{ rulePageIndex * pageSize + 1 }}–{{ Math.min((rulePageIndex + 1) * pageSize, rulesTotal) }} / {{ rulesTotal }}</ion-note>
          <ion-button fill="clear" :disabled="(rulePageIndex + 1) * pageSize >= rulesTotal || rulesLoading" @click="rulePageIndex++">{{ translate('Next rules') }}</ion-button>
        </div>

        <h2>{{ translate('Order item outcomes') }}</h2>
        <ion-item v-if="itemsLoading" lines="none">
          <ion-label>{{ translate('Loading item outcomes…') }}</ion-label>
          <ion-spinner slot="end" name="crescent" />
        </ion-item>
        <ion-item v-else-if="itemsError" lines="none">
          <ion-label color="danger" class="ion-text-wrap">{{ itemsError }}</ion-label>
          <ion-button slot="end" fill="outline" @click="loadItems">{{ translate('Retry') }}</ion-button>
        </ion-item>
        <ion-note v-else-if="!items.length" class="ion-padding-horizontal" color="medium">
          {{ translate('No order item outcomes were recorded for this variant.') }}
        </ion-note>
        <ion-list v-else>
          <ion-item v-for="item in items" :key="`${item.ruleResultSeqId}:${item.itemSeqId}`">
            <ion-label class="ion-text-wrap">
              <h3>{{ translate('Order') }} {{ item.orderId || '—' }} · {{ translate('Item') }} {{ item.orderItemSeqId || '—' }}</h3>
              <p>{{ translate('Product') }} {{ item.productId || '—' }} · {{ translate('Facility') }} {{ item.facilityId || '—' }}</p>
              <p>{{ translate('Quantity') }} {{ count(item.routedQty) }} / {{ count(item.itemQty) }}</p>
            </ion-label>
            <ion-badge slot="end" color="medium">{{ item.finalReason || '—' }}</ion-badge>
          </ion-item>
        </ion-list>
        <div v-if="itemsTotal > pageSize" class="item-pagination">
          <ion-button fill="clear" :disabled="pageIndex === 0 || itemsLoading" @click="pageIndex--">{{ translate('Previous') }}</ion-button>
          <ion-note>{{ pageIndex * pageSize + 1 }}–{{ Math.min((pageIndex + 1) * pageSize, itemsTotal) }} / {{ itemsTotal }}</ion-note>
          <ion-button fill="clear" :disabled="(pageIndex + 1) * pageSize >= itemsTotal || itemsLoading" @click="pageIndex++">{{ translate('Next') }}</ion-button>
        </div>
      </section>
    </template>
    <ion-item v-else-if="sim.isRunningBaselineRun || sim.isRunningVariationRun" lines="none">
      <ion-label>{{ translate('Submitting simulation…') }}</ion-label>
      <ion-spinner slot="end" name="crescent" />
    </ion-item>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { translate } from "@common";
import { IonBadge, IonButton, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonSpinner } from "@ionic/vue";
import { simulationStore } from "@/store/simulationStore";
import { listSimulationItems, listSimulationRuleResults } from "@/services/SimulationService";
import type { PersistedSimulation, SimulationItem, SimulationRuleResult } from "@/services/SimulationService";
import { simulationSetupError } from "@/services/SimulationSetupService";

const props = defineProps<{ embedded?: boolean; run?: PersistedSimulation | null }>();
const sim = simulationStore();
const router = useRouter();
const displayRun = computed(() => props.run || sim.currentRun);
const baselineVariant = computed(() => displayRun.value?.variants?.find((variant) => variant.isBaseline === "Y"));
const isRunning = computed(() => ["BRSIM_QUEUED", "BRSIM_RUNNING"].includes(displayRun.value?.simulation?.statusId || ""));
const isFailed = computed(() => displayRun.value?.simulation?.statusId === "BRSIM_FAILED");
const statusLabel = computed(() => String(displayRun.value?.simulation?.statusId || "").replace("BRSIM_", ""));
const count = (value?: number) => Number(value || 0).toLocaleString();
const difference = (value?: number, baseline?: number) => {
  const change = Number(value) - Number(baseline);
  return change > 0 ? `+${change.toLocaleString()}` : change.toLocaleString();
};
function canCompare(variant: PersistedSimulation["variants"][number]) {
  const baseline = baselineVariant.value;
  return displayRun.value?.simulation?.statusId === "BRSIM_COMPLETE" && variant.isBaseline !== "Y" &&
    variant.failed !== "Y" && baseline?.brokeredItemCount != null && baseline.queuedItemCount != null &&
    variant.brokeredItemCount != null && variant.queuedItemCount != null &&
    (Number(baseline.attemptedItemCount) > 0 || Number(variant.attemptedItemCount) > 0);
}
const pageSize = 25;
const selectedVariantSeqId = ref<number | null>(null);
const pageIndex = ref(0);
const items = ref<SimulationItem[]>([]);
const itemsTotal = ref(0);
const itemsLoading = ref(false);
const itemsError = ref("");
let requestGeneration = 0;
const rulePageIndex = ref(0);
const rules = ref<SimulationRuleResult[]>([]);
const rulesTotal = ref(0);
const rulesLoading = ref(false);
const rulesError = ref("");
let ruleRequestGeneration = 0;

const hasPersistedOutcomes = computed(() => ["BRSIM_COMPLETE", "BRSIM_FAILED"].includes(displayRun.value?.simulation?.statusId || ""));
const completedRunKey = computed(() => hasPersistedOutcomes.value
  ? `${displayRun.value?.simulation?.simulationId}:${displayRun.value?.variants?.map((variant) => variant.variantSeqId).join(',')}`
  : "");
watch(completedRunKey, () => {
  selectedVariantSeqId.value = displayRun.value?.variants?.[0]?.variantSeqId ?? null;
  pageIndex.value = 0;
  rulePageIndex.value = 0;
}, { immediate: true });
watch(selectedVariantSeqId, () => { pageIndex.value = 0; rulePageIndex.value = 0; });

async function loadRules() {
  const simulationId = displayRun.value?.simulation?.simulationId;
  const variantSeqId = selectedVariantSeqId.value;
  const generation = ++ruleRequestGeneration;
  rules.value = [];
  rulesTotal.value = 0;
  rulesError.value = "";
  if (!completedRunKey.value || !simulationId || variantSeqId == null) return;
  rulesLoading.value = true;
  try {
    const result = await listSimulationRuleResults(simulationId, variantSeqId, rulePageIndex.value, pageSize);
    if (generation !== ruleRequestGeneration) return;
    rules.value = result.ruleResultList;
    rulesTotal.value = Number(result.totalCount || 0);
  } catch (cause: any) {
    if (generation !== ruleRequestGeneration) return;
    rulesError.value = simulationSetupError(cause);
  } finally {
    if (generation === ruleRequestGeneration) rulesLoading.value = false;
  }
}
watch([completedRunKey, selectedVariantSeqId, rulePageIndex], loadRules, { immediate: true });

async function loadItems() {
  const simulationId = displayRun.value?.simulation?.simulationId;
  const variantSeqId = selectedVariantSeqId.value;
  const generation = ++requestGeneration;
  items.value = [];
  itemsTotal.value = 0;
  itemsError.value = "";
  if (!completedRunKey.value || !simulationId || variantSeqId == null) return;
  itemsLoading.value = true;
  try {
    const result = await listSimulationItems(simulationId, variantSeqId, pageIndex.value, pageSize);
    if (generation !== requestGeneration) return;
    items.value = result.itemList;
    itemsTotal.value = Number(result.totalCount || 0);
  } catch (cause: any) {
    if (generation !== requestGeneration) return;
    itemsError.value = simulationSetupError(cause);
  } finally {
    if (generation === requestGeneration) itemsLoading.value = false;
  }
}
watch([completedRunKey, selectedVariantSeqId, pageIndex], loadItems, { immediate: true });
</script>

<style scoped>
.failure, .run-error { color: var(--ion-color-danger); }
.run-error { display: block; margin-bottom: var(--spacer-sm); }
.empty-run-note { display: block; margin: var(--spacer-sm) 0; }
.comparison { color: var(--ion-color-medium); }
.item-outcomes { margin-top: var(--spacer-lg); }
.item-outcomes h2 { padding: 0 var(--spacer-md); font-size: 1rem; }
.item-pagination { display: flex; align-items: center; justify-content: space-between; }
</style>
