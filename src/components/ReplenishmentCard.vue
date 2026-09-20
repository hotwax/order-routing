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
        <div class="replenishment-layout">
          <div class="replenishment-controls" data-testid="replenishment-controls">
            <div class="replenishment-metrics">
              <ion-chip button data-testid="sales-velocity-trigger" @click="openSalesVelocityPopover">
                <ion-label>{{ translate("Sales velocity: {value} units / day", { value: salesVelocityDisplay }) }}</ion-label>
              </ion-chip>
              <ion-chip button data-testid="incoming-transfers-trigger" :disabled="incomingUnavailable" @click="isIncomingTransfersModalOpen = true">
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

            <div class="replenishment-save-action" data-testid="replenishment-save">
              <ion-button :disabled="!canSave" @click="saveChanges">
                {{ isSaving ? translate("Saving") : translate("Save changes") }}
              </ion-button>
            </div>
          </div>

          <div class="trend-frame" data-testid="replenishment-trend">
            <div v-if="trendPath" class="trend-heading">
              <strong>{{ translate("ATP history") }}</strong>
              <ion-note>{{ translate("Last 30 days") }} · {{ latestTrendPoint ? translate("Latest ATP: {value}", { value: formatQuantity(latestTrendPoint.atp) }) : "" }}</ion-note>
            </div>
            <svg v-if="trendPath" :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`" role="img" :aria-label="chartAriaLabel">
              <title>{{ chartAriaLabel }}</title>
              <text x="12" :y="(PLOT_TOP + PLOT_BOTTOM) / 2" class="chart-axis-title" transform="rotate(-90 12 81)">ATP</text>
              <g v-for="tick in yAxisTicks" :key="tick.value">
                <line :x1="PLOT_LEFT" :x2="PLOT_RIGHT" :y1="tick.y" :y2="tick.y" class="chart-grid-line" />
                <text :x="PLOT_LEFT - 8" :y="tick.y + 3" text-anchor="end" class="chart-axis-label">{{ formatQuantity(tick.value) }}</text>
              </g>
              <g v-for="guide in chartGuides" :key="guide.id">
                <line :x1="PLOT_LEFT" :x2="PLOT_RIGHT" :y1="guide.y" :y2="guide.y" class="chart-guide-line" />
                <text :x="PLOT_LEFT + 4" :y="Math.max(PLOT_TOP + 10, guide.y - 4)" class="chart-guide-label">{{ guide.label }}</text>
              </g>
              <path :d="trendPath" fill="none" stroke="currentColor" stroke-width="2" />
              <circle v-if="currentMarker" :cx="currentMarker.x" :cy="currentMarker.y" r="4" fill="currentColor" />
              <text v-for="tick in dateAxisTicks" :key="tick.timestamp" :x="tick.x" :y="PLOT_BOTTOM + 20" text-anchor="middle" class="chart-axis-label">{{ formatTrendDate(tick.timestamp) }}</text>
            </svg>
            <p v-else>{{ translate("No ATP trend data available") }}</p>
          </div>
        </div>

        <ion-popover
          :event="salesVelocityPopoverEvent"
          :is-open="isSalesVelocityPopoverOpen"
          data-testid="sales-velocity-popover"
          @did-dismiss="isSalesVelocityPopoverOpen = false"
        >
          <ion-list>
            <ion-item>
              <ion-label>{{ translate("In Store") }}</ion-label>
              <ion-note slot="end">{{ formatQuantity(salesVelocityBreakdown.inStoreUnits) }} {{ translate("units") }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("In Store Ship to Home") }}</ion-label>
              <ion-note slot="end">{{ formatQuantity(salesVelocityBreakdown.inStoreShipToHomeUnits) }} {{ translate("units") }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Online") }}</ion-label>
              <ion-note slot="end">{{ formatQuantity(salesVelocityBreakdown.onlineUnits) }} {{ translate("units") }}</ion-note>
            </ion-item>
          </ion-list>
        </ion-popover>

        <ion-modal
          :is-open="isIncomingTransfersModalOpen"
          data-testid="incoming-transfers-modal"
          @did-dismiss="isIncomingTransfersModalOpen = false"
        >
          <ion-header>
            <ion-toolbar>
              <ion-buttons slot="start">
                <ion-button
                  :aria-label="translate('Close')"
                  fill="clear"
                  @click="isIncomingTransfersModalOpen = false"
                >
                  <ion-icon slot="icon-only" :icon="closeOutline" />
                </ion-button>
              </ion-buttons>
              <ion-title>{{ translate("Incoming transfers") }}</ion-title>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <ion-list>
              <template v-if="incomingTransfers.length">
                <ion-item-divider>
                  <ion-label>{{ translate("Transfer orders") }}</ion-label>
                </ion-item-divider>
                <ion-item v-for="transfer in incomingTransfers" :key="transfer.orderId">
                  <ion-label>
                    {{ transfer.orderName || transfer.orderId }}
                    <p>{{ translate("From") }} {{ transferSourceName(transfer) }}</p>
                  </ion-label>
                  <ion-note slot="end">{{ formatQuantity(transfer.units) }} {{ translate("units") }}</ion-note>
                  <ion-button slot="end" fill="outline" :href="transferOrderHref(transfer.orderId) || undefined">
                    {{ translate("Open in Transfers") }}
                  </ion-button>
                </ion-item>
              </template>
              <template v-if="requestedTransfers.length">
                <ion-item-divider>
                  <ion-label>{{ translate("Requested transfers") }}</ion-label>
                </ion-item-divider>
                <ion-item v-for="transfer in requestedTransfers" :key="transfer.inventoryTransferId">
                  <ion-label>
                    {{ transfer.inventoryTransferId }}
                    <p>{{ translate("From") }} {{ transferSourceName(transfer) }}</p>
                  </ion-label>
                  <ion-note slot="end">{{ formatQuantity(transfer.units) }} {{ translate("units") }}</ion-note>
                  <ion-button slot="end" fill="outline" :href="requestedTransferHref || undefined">
                    {{ translate("Open in Transfers") }}
                  </ion-button>
                </ion-item>
              </template>
              <ion-item v-if="!incomingTransfers.length && !requestedTransfers.length">
                <ion-label>{{ translate("No incoming transfer orders") }}</ion-label>
              </ion-item>
            </ion-list>
          </ion-content>
        </ion-modal>

      </template>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItemDivider,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPopover,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { buildAppUrl, translate } from "@common";
import { computed, ref, watch } from "vue";
import { type SalesVelocityBreakdown, type TrendPoint, formatUnitsPerDay, toNumber } from "@/utils/replenishmentMetrics";
import { type IncomingTransfer, type RequestedTransfer } from "@/composables/useReplenishmentMetrics";

type ConfigValue = string | number | null | undefined;

const props = defineProps<{
  productId: string;
  facilityId: string;
  minimumStock: ConfigValue;
  maximumStock?: ConfigValue;
  reorderQuantity?: ConfigValue;
  facilityNames?: Record<string, string>;
  incomingTransfers?: IncomingTransfer[];
  requestedTransfers?: RequestedTransfer[];
  salesVelocityUnitsPerDay: number;
  salesVelocityBreakdown?: SalesVelocityBreakdown;
  incomingUnits: number;
  incomingUnavailable: boolean;
  trendPoints: TrendPoint[];
  isLoading: boolean;
  isSaving: boolean;
}>();

const emit = defineEmits<{
  (event: "save", payload: { minimumStock?: number; maximumStock?: number; reorderQuantity?: number }): void;
}>();

const CHART_WIDTH = 360;
const CHART_HEIGHT = 176;
const PLOT_LEFT = 40;
const PLOT_RIGHT = CHART_WIDTH - 30;
const PLOT_TOP = 20;
const PLOT_BOTTOM = CHART_HEIGHT - 34;
const MINIMUM_CHART_MAXIMUM = 5;

const minimumStockValue = ref("");
const maximumStockValue = ref("");
const reorderQuantityValue = ref("");
const isIncomingTransfersModalOpen = ref(false);
const isSalesVelocityPopoverOpen = ref(false);
const salesVelocityPopoverEvent = ref<Event | undefined>();

function openSalesVelocityPopover(event: Event) {
  salesVelocityPopoverEvent.value = event;
  isSalesVelocityPopoverOpen.value = true;
}

function displayValue(value: ConfigValue): string {
  return value === null || value === undefined ? "" : String(value);
}

function resetDraftValues() {
  minimumStockValue.value = displayValue(props.minimumStock);
  maximumStockValue.value = displayValue(props.maximumStock);
  reorderQuantityValue.value = displayValue(props.reorderQuantity);
}

function clearDraftValues() {
  minimumStockValue.value = "";
  maximumStockValue.value = "";
  reorderQuantityValue.value = "";
}

watch([
  () => props.productId,
  () => props.facilityId,
], () => {
  clearDraftValues();
});

watch([
  () => props.minimumStock,
  () => props.maximumStock,
  () => props.reorderQuantity,
], () => {
  resetDraftValues();
}, { immediate: true });

const minimumStockNumber = computed(() => toNumber(props.minimumStock));
const maximumStockNumber = computed(() => toNumber(props.maximumStock));
const reorderQuantityNumber = computed(() => toNumber(props.reorderQuantity));
const nextMinimumStock = computed(() => toNumber(minimumStockValue.value));
const nextMaximumStock = computed(() => toNumber(maximumStockValue.value));
const nextReorderQuantity = computed(() => toNumber(reorderQuantityValue.value));

const salesVelocityDisplay = computed(() => formatUnitsPerDay(props.salesVelocityUnitsPerDay));
const salesVelocityBreakdown = computed<SalesVelocityBreakdown>(() => props.salesVelocityBreakdown ?? {
  inStoreUnits: 0,
  inStoreShipToHomeUnits: 0,
  onlineUnits: 0,
  totalUnits: 0,
  unitsPerDay: 0,
});
const incomingTransfers = computed(() => props.incomingTransfers ?? []);
const requestedTransfers = computed(() => props.requestedTransfers ?? []);
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
  if(nextMinimumStock.value !== null) {values.push(nextMinimumStock.value);}
  if(nextMaximumStock.value !== null) {values.push(nextMaximumStock.value);}
  const min = 0;
  const max = Math.max(...values, min, MINIMUM_CHART_MAXIMUM);

  if(!Number.isFinite(max)) {return null;}

  return min === max ? { min, max: 1 } : { min, max };
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

  return PLOT_LEFT + ((timestamp - range.min) / (range.max - range.min)) * (PLOT_RIGHT - PLOT_LEFT);
}

function yFor(value: number): number {
  const domain = chartDomain.value;
  if(!domain) {return CHART_HEIGHT / 2;}

  return PLOT_TOP + ((domain.max - value) / (domain.max - domain.min)) * (PLOT_BOTTOM - PLOT_TOP);
}

const trendPath = computed(() => props.trendPoints
  .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.timestamp)} ${yFor(point.atp)}`)
  .join(" ")
);
const currentMarker = computed(() => {
  const latest = props.trendPoints.at(-1);
  return latest ? { x: xFor(latest.timestamp), y: yFor(latest.atp) } : null;
});
const latestTrendPoint = computed(() => props.trendPoints.at(-1) ?? null);
const chartGuides = computed(() => [
  nextMinimumStock.value === null ? null : {
    id: "reorder-point",
    label: translate("Reorder point: {value}", { value: formatQuantity(nextMinimumStock.value) }),
    value: nextMinimumStock.value,
  },
  nextMaximumStock.value === null ? null : {
    id: "maximum-stock",
    label: translate("Maximum stock: {value}", { value: formatQuantity(nextMaximumStock.value) }),
    value: nextMaximumStock.value,
  },
].filter((guide): guide is { id: string; label: string; value: number } => guide !== null).map((guide) => ({ ...guide, y: yFor(guide.value) })));
const yAxisTicks = computed(() => {
  const domain = chartDomain.value;
  if(!domain) {return [];}

  return [domain.max, (domain.min + domain.max) / 2, domain.min].map((value) => ({ value, y: yFor(value) }));
});
const dateAxisTicks = computed(() => {
  const range = chartRange.value;
  if(!range) {return [];}

  return [range.min, (range.min + range.max) / 2, range.max].map((timestamp) => ({ timestamp, x: xFor(timestamp) }));
});
const chartAriaLabel = computed(() => {
  const first = props.trendPoints[0];
  const latest = latestTrendPoint.value;
  if(!first || !latest) {return translate("No ATP trend data available");}

  return translate("ATP history from {start} to {end}. Latest ATP: {value}.", {
    start: formatTrendDate(first.timestamp),
    end: formatTrendDate(latest.timestamp),
    value: formatQuantity(latest.atp),
  });
});

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function transferSourceName(transfer: IncomingTransfer | RequestedTransfer): string {
  if(transfer.sourceFacilityName) {return transfer.sourceFacilityName;}
  if(!transfer.sourceFacilityId) {return translate("Not available");}
  return props.facilityNames?.[transfer.sourceFacilityId] || transfer.sourceFacilityId;
}

function transferOrderHref(orderId: string): string | null {
  return buildAppUrl("transfers", `/order-detail/${encodeURIComponent(orderId)}`);
}

const requestedTransferHref = buildAppUrl("transfers", "/tabs/inventory-transfers");

function formatTrendDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

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
.replenishment-layout,
.replenishment-controls,
.replenishment-inputs {
  display: grid;
  gap: var(--spacer-sm, 12px);
}

.replenishment-inputs {
  grid-template-columns: minmax(0, 1fr);
}

.replenishment-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs, 8px);
  align-items: center;
}

.replenishment-save-action {
  display: flex;
  justify-content: flex-end;
}

.trend-frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacer-xs, 8px);
  min-height: 8rem;
  overflow: hidden;
}

.trend-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacer-sm, 12px);
  width: 100%;
}

.trend-frame svg {
  width: 100%;
  max-width: 35rem;
}

.chart-axis-title,
.chart-axis-label,
.chart-guide-label {
  fill: currentColor;
  font-size: 9px;
}

.chart-grid-line {
  stroke: currentColor;
  stroke-opacity: 0.2;
  stroke-width: 1;
}

.chart-guide-line {
  stroke: currentColor;
  stroke-dasharray: 4 4;
  stroke-opacity: 0.7;
  stroke-width: 1;
}

.chart-guide-label {
  font-weight: 600;
}

@media (min-width: 60rem) {
  .replenishment-layout {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    align-items: start;
  }

  .replenishment-metrics {
    flex-wrap: nowrap;
  }

  .trend-frame svg {
    max-width: none;
  }
}
</style>
