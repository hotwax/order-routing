<template>
  <ion-card class="ion-no-margin">
    <ion-card-header>
      <ion-card-title>{{ translate("Replenishment") }}</ion-card-title>
    </ion-card-header>

    <ion-card-content>
      <template v-if="isLoading">
        <div class="replenishment-skeleton">
          <ion-skeleton-text animated />
          <ion-skeleton-text animated />
          <ion-skeleton-text animated />
        </div>
      </template>

      <template v-else>
        <div class="metric-chips">
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
              inputmode="numeric"
              :label="translate('Reorder point')"
              :value="reorderPointValue"
              @ionInput="reorderPointValue = String($event.detail.value ?? '')"
              @keydown="isValidPositiveNumber"
            />
          </ion-item>

          <ion-item>
            <ion-input
              type="number"
              min="0"
              inputmode="numeric"
              :label="translate('Maximum stock')"
              :value="maximumStockDisplay"
              :placeholder="translate('Unavailable')"
              disabled
            />
          </ion-item>
          <p v-if="!hasMaximumStock" class="field-helper">{{ translate("Maximum stock is not available from Maarg yet") }}</p>

          <ion-item>
            <ion-input
              type="number"
              min="0"
              inputmode="numeric"
              :label="translate('Reorder quantity')"
              :value="reorderQuantityDisplay"
              :placeholder="translate('Unavailable')"
              disabled
            />
          </ion-item>
          <p v-if="!hasReorderQuantity" class="field-helper">{{ translate("Reorder quantity is not available from Maarg yet") }}</p>
        </div>

        <div class="trend-frame">
          <svg v-if="trendPath || currentMarker" viewBox="0 0 320 128" role="img" :aria-label="translate('ATP trend')">
            <line
              v-if="reorderPointLineY !== null"
              x1="8"
              x2="312"
              :y1="reorderPointLineY"
              :y2="reorderPointLineY"
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
            <path v-if="trendPath" :d="trendPath" fill="none" stroke="currentColor" stroke-width="2" />
            <circle v-if="currentMarker" :cx="currentMarker.x" :cy="currentMarker.y" r="4" fill="currentColor" />
          </svg>
          <p v-else>{{ translate("No inventory movement yet") }}</p>
        </div>

        <div class="card-actions">
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
  IonSkeletonText
} from "@ionic/vue";
import { translate } from "@common";
import { computed, ref, watch } from "vue";
import { TrendPoint, formatUnitsPerDay, toNumber } from "@/utils/replenishmentMetrics";

const props = defineProps<{
  productId: string;
  facilityId: string;
  minimumStock: string | number | null | undefined;
  maximumStock?: string | number | null;
  reorderQuantity?: string | number | null;
  salesVelocityUnitsPerDay: number;
  incomingUnits: number;
  incomingUnavailable: boolean;
  trendPoints: TrendPoint[];
  isLoading: boolean;
  isSaving: boolean;
  restockHref: string | null;
}>();

const emit = defineEmits<{
  (event: "save", payload: { minimumStock: number }): void;
}>();

const CHART_WIDTH = 320;
const CHART_HEIGHT = 128;
const CHART_PADDING = 8;

const reorderPointValue = ref("");

watch(
  () => props.minimumStock,
  (value) => {
    reorderPointValue.value = value === null || value === undefined ? "" : String(value);
  },
  { immediate: true }
);

const currentMinimumStock = computed(() => toNumber(props.minimumStock));
const nextMinimumStock = computed(() => toNumber(reorderPointValue.value));
const maximumStockNumber = computed(() => toNumber(props.maximumStock));
const reorderQuantityNumber = computed(() => toNumber(props.reorderQuantity));

const hasMaximumStock = computed(() => maximumStockNumber.value !== null);
const hasReorderQuantity = computed(() => reorderQuantityNumber.value !== null);
const maximumStockDisplay = computed(() => hasMaximumStock.value ? String(maximumStockNumber.value) : "");
const reorderQuantityDisplay = computed(() => hasReorderQuantity.value ? String(reorderQuantityNumber.value) : "");
const salesVelocityDisplay = computed(() => formatUnitsPerDay(props.salesVelocityUnitsPerDay));
const incomingLabel = computed(() => props.incomingUnavailable
  ? translate("Incoming unavailable")
  : translate("Incoming: {value} units", { value: props.incomingUnits })
);

const canSave = computed(() => {
  const nextValue = nextMinimumStock.value;
  if (props.isSaving || nextValue === null || nextValue < 0 || !Number.isInteger(nextValue)) return false;
  return nextValue !== currentMinimumStock.value;
});

const chartDomain = computed(() => {
  const values = props.trendPoints.map((point) => point.atp);
  if (currentMinimumStock.value !== null) values.push(currentMinimumStock.value);
  if (maximumStockNumber.value !== null) values.push(maximumStockNumber.value);

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
});

const chartRange = computed(() => {
  if (!props.trendPoints.length) return null;

  const timestamps = props.trendPoints.map((point) => point.timestamp);
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);

  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
});

function xFor(timestamp: number): number {
  const range = chartRange.value;
  if (!range) return CHART_WIDTH / 2;

  const width = CHART_WIDTH - (CHART_PADDING * 2);
  return CHART_PADDING + ((timestamp - range.min) / (range.max - range.min)) * width;
}

function yFor(value: number): number {
  const domain = chartDomain.value;
  if (!domain) return CHART_HEIGHT / 2;

  const height = CHART_HEIGHT - (CHART_PADDING * 2);
  return CHART_PADDING + ((domain.max - value) / (domain.max - domain.min)) * height;
}

const trendPath = computed(() => {
  if (!props.trendPoints.length) return "";

  return props.trendPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.timestamp)} ${yFor(point.atp)}`)
    .join(" ");
});

const currentMarker = computed(() => {
  const latestPoint = props.trendPoints[props.trendPoints.length - 1];
  if (!latestPoint) return null;

  return {
    x: xFor(latestPoint.timestamp),
    y: yFor(latestPoint.atp)
  };
});

const reorderPointLineY = computed(() => currentMinimumStock.value === null ? null : yFor(currentMinimumStock.value));
const maximumStockLineY = computed(() => maximumStockNumber.value === null ? null : yFor(maximumStockNumber.value));

function isValidPositiveNumber(event: KeyboardEvent) {
  if (event.key.length === 1 && !/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
  }
}

function saveChanges() {
  const minimumStock = nextMinimumStock.value;
  if (minimumStock === null || !canSave.value) return;

  emit("save", { minimumStock });
}
</script>

<style scoped>
.replenishment-skeleton,
.replenishment-inputs {
  display: grid;
  gap: 12px;
}

.metric-chips,
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.card-actions {
  justify-content: flex-end;
}

.trend-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 144px;
  overflow: hidden;
}

.trend-frame svg {
  width: 100%;
  max-width: 560px;
  min-height: 128px;
}

.field-helper {
  margin: -4px 0 0;
}
</style>
