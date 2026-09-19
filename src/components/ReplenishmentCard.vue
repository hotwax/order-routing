<template>
  <ion-card class="replenishment-card">
    <ion-card-header>
      <ion-card-title>{{ translate("Replenishment") }}</ion-card-title>
    </ion-card-header>

    <ion-card-content>
      <div v-if="isLoading" class="replenishment-skeleton" aria-hidden="true">
        <ion-skeleton-text animated />
        <ion-skeleton-text animated />
        <ion-skeleton-text animated />
      </div>

      <template v-else>
        <div class="replenishment-metrics">
          <ion-chip>
            <ion-label>{{ translate("Sales velocity: {value} units / day", { value: salesVelocityDisplay }) }}</ion-label>
          </ion-chip>
          <ion-chip>
            <ion-label>{{ incomingLabel }}</ion-label>
          </ion-chip>
        </div>

        <div class="replenishment-inputs">
          <ion-item>
            <ion-input
              type="number"
              min="0"
              inputmode="decimal"
              :label="translate('Reorder point')"
              :value="minimumStockValue"
              @ion-input="minimumStockValue = String($event.detail.value ?? '')"
            />
          </ion-item>
          <ion-item>
            <ion-input
              type="number"
              min="0"
              inputmode="numeric"
              :label="translate('Maximum stock')"
              :value="maximumStockValue"
              @ion-input="maximumStockValue = String($event.detail.value ?? '')"
            />
          </ion-item>
          <ion-item>
            <ion-input
              type="number"
              min="0"
              inputmode="numeric"
              :label="translate('Reorder quantity')"
              :value="reorderQuantityValue"
              @ion-input="reorderQuantityValue = String($event.detail.value ?? '')"
            />
          </ion-item>
        </div>

        <div class="trend-frame">
          <svg v-if="trendPath" viewBox="0 0 320 128" role="img" :aria-label="translate('ATP trend')">
            <line
              v-if="minimumStockLineY !== null"
              x1="8"
              x2="312"
              :y1="minimumStockLineY"
              :y2="minimumStockLineY"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="4 4"
            />
            <line
              v-if="maximumStockLineY !== null"
              x1="8"
              x2="312"
              :y1="maximumStockLineY"
              :y2="maximumStockLineY"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="4 4"
            />
            <path :d="trendPath" fill="none" stroke="currentColor" stroke-width="2" />
            <circle v-if="currentMarker" :cx="currentMarker.x" :cy="currentMarker.y" r="4" fill="currentColor" />
          </svg>
          <p v-else>{{ translate("No ATP trend data available") }}</p>
        </div>

        <div class="card-actions">
          <ion-note v-if="!restockHref">{{ translate("Restock setup is unavailable for this environment.") }}</ion-note>
          <ion-button fill="outline" :href="restockHref || undefined" :disabled="!restockHref">
            {{ translate("Restock Inventory") }}
          </ion-button>
          <ion-button :disabled="!canSave" @click="saveChanges">
            {{ isSaving ? translate("Saving") : translate("Save changes") }}
          </ion-button>
        </div>
      </template>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSkeletonText,
} from "@ionic/vue";
import { translate } from "@common";
import { computed, ref, watch } from "vue";
import { type TrendPoint, formatUnitsPerDay, toNumber } from "@/utils/replenishmentMetrics";

type ConfigValue = string | number | null | undefined;

const props = defineProps<{
  minimumStock: ConfigValue;
  maximumStock?: ConfigValue;
  reorderQuantity?: ConfigValue;
  salesVelocityUnitsPerDay: number;
  incomingUnits: number;
  incomingUnavailable: boolean;
  trendPoints: TrendPoint[];
  isLoading: boolean;
  isSaving: boolean;
  restockHref: string | null;
}>();

const emit = defineEmits<{
  (event: "save", payload: { minimumStock?: number; maximumStock?: number; reorderQuantity?: number }): void;
}>();

const CHART_WIDTH = 320;
const CHART_HEIGHT = 128;
const CHART_PADDING = 8;

const minimumStockValue = ref("");
const maximumStockValue = ref("");
const reorderQuantityValue = ref("");

function displayValue(value: ConfigValue): string {
  return value === null || value === undefined ? "" : String(value);
}

watch(() => props.minimumStock, (value) => {
  minimumStockValue.value = displayValue(value);
}, { immediate: true });

watch(() => props.maximumStock, (value) => {
  maximumStockValue.value = displayValue(value);
}, { immediate: true });

watch(() => props.reorderQuantity, (value) => {
  reorderQuantityValue.value = displayValue(value);
}, { immediate: true });

const minimumStockNumber = computed(() => toNumber(props.minimumStock));
const maximumStockNumber = computed(() => toNumber(props.maximumStock));
const reorderQuantityNumber = computed(() => toNumber(props.reorderQuantity));
const nextMinimumStock = computed(() => toNumber(minimumStockValue.value));
const nextMaximumStock = computed(() => toNumber(maximumStockValue.value));
const nextReorderQuantity = computed(() => toNumber(reorderQuantityValue.value));

const salesVelocityDisplay = computed(() => formatUnitsPerDay(props.salesVelocityUnitsPerDay));
const incomingLabel = computed(() => props.incomingUnavailable
  ? translate("Incoming unavailable")
  : translate("Incoming: {value} units", { value: props.incomingUnits })
);

function changed(current: number | null, next: number | null): boolean {
  return current !== next;
}

function validNumber(value: number | null): value is number {
  return value !== null && value >= 0;
}

function validInteger(value: number | null): value is number {
  return validNumber(value) && Number.isInteger(value);
}

const minimumStockChanged = computed(() => changed(minimumStockNumber.value, nextMinimumStock.value));
const maximumStockChanged = computed(() => changed(maximumStockNumber.value, nextMaximumStock.value));
const reorderQuantityChanged = computed(() => changed(reorderQuantityNumber.value, nextReorderQuantity.value));
const canSave = computed(() => {
  if(props.isSaving || !minimumStockChanged.value && !maximumStockChanged.value && !reorderQuantityChanged.value) {return false;}
  if(minimumStockChanged.value && !validNumber(nextMinimumStock.value)) {return false;}
  if(maximumStockChanged.value && !validInteger(nextMaximumStock.value)) {return false;}
  if(reorderQuantityChanged.value && !validInteger(nextReorderQuantity.value)) {return false;}

  return true;
});

const chartDomain = computed(() => {
  const values = props.trendPoints.map((point) => point.atp);
  if(minimumStockNumber.value !== null) {values.push(minimumStockNumber.value);}
  if(maximumStockNumber.value !== null) {values.push(maximumStockNumber.value);}
  const min = Math.min(...values);
  const max = Math.max(...values);

  if(!Number.isFinite(min) || !Number.isFinite(max)) {return null;}

  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
});

const chartRange = computed(() => {
  if(!props.trendPoints.length) {return null;}
  const timestamps = props.trendPoints.map((point) => point.timestamp);
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);

  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
});

function xFor(timestamp: number): number {
  const range = chartRange.value;
  if(!range) {return CHART_WIDTH / 2;}

  return CHART_PADDING + ((timestamp - range.min) / (range.max - range.min)) * (CHART_WIDTH - (CHART_PADDING * 2));
}

function yFor(value: number): number {
  const domain = chartDomain.value;
  if(!domain) {return CHART_HEIGHT / 2;}

  return CHART_PADDING + ((domain.max - value) / (domain.max - domain.min)) * (CHART_HEIGHT - (CHART_PADDING * 2));
}

const trendPath = computed(() => props.trendPoints
  .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.timestamp)} ${yFor(point.atp)}`)
  .join(" ")
);
const currentMarker = computed(() => {
  const latest = props.trendPoints.at(-1);
  return latest ? { x: xFor(latest.timestamp), y: yFor(latest.atp) } : null;
});
const minimumStockLineY = computed(() => minimumStockNumber.value === null ? null : yFor(minimumStockNumber.value));
const maximumStockLineY = computed(() => maximumStockNumber.value === null ? null : yFor(maximumStockNumber.value));

function saveChanges() {
  if(!canSave.value) {return;}
  const payload: { minimumStock?: number; maximumStock?: number; reorderQuantity?: number } = {};
  if(minimumStockChanged.value && validNumber(nextMinimumStock.value)) {payload.minimumStock = nextMinimumStock.value;}
  if(maximumStockChanged.value && validInteger(nextMaximumStock.value)) {payload.maximumStock = nextMaximumStock.value;}
  if(reorderQuantityChanged.value && validInteger(nextReorderQuantity.value)) {payload.reorderQuantity = nextReorderQuantity.value;}
  emit("save", payload);
}
</script>

<style scoped>
.replenishment-skeleton,
.replenishment-inputs {
  display: grid;
  gap: var(--spacer-sm, 12px);
}

.replenishment-inputs {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
}

.replenishment-metrics,
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs, 8px);
  align-items: center;
}

.card-actions {
  justify-content: flex-end;
}

.trend-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 8rem;
  overflow: hidden;
}

.trend-frame svg {
  width: 100%;
  max-width: 35rem;
}
</style>
