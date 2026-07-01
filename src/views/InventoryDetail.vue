<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/inventory" />
        </ion-buttons>
        <ion-title>{{ translate("Inventory Detail") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="detail-page">
        <!-- Product-first header: product identity plus the facility the data below is scoped to -->
        <section class="product-header">
          <div class="product-image">
            <img v-if="product.mainImageUrl" :src="product.mainImageUrl" :alt="primaryIdentifier" />
            <ion-skeleton-text v-else-if="isLoading" animated />
            <ion-icon v-else :icon="cubeOutline" />
          </div>
          <div class="product-identity">
            <template v-if="isLoading">
              <ion-skeleton-text animated class="skeleton-title" />
              <ion-skeleton-text animated class="skeleton-sub" />
            </template>
            <template v-else>
              <h1>{{ primaryIdentifier }}</h1>
              <p v-if="secondaryIdentifier">{{ secondaryIdentifier }}</p>
              <p class="product-name" v-if="productName">{{ productName }}</p>
            </template>
          </div>
          <ion-item class="facility-select" lines="none">
            <ion-label>
              <p class="overline">{{ translate("Facility") }}</p>
              {{ currentFacilityName || translate("Select facility") }}
            </ion-label>
            <ion-button slot="end" fill="outline" color="dark" :disabled="!productStoreFacilities.length" @click="openFacilitySwitcher()">
              {{ translate("Change location") }}
            </ion-button>
          </ion-item>
        </section>

        <!-- Operational summary scoped to the selected facility: Inventory (primary) + Configuration (supporting) -->
        <section class="summary-cards">
          <ion-card class="ion-no-margin">
            <ion-card-header class="card-header">
              <ion-card-title>{{ translate("Inventory") }}</ion-card-title>
              <ion-button fill="clear" @click="openInventoryEditModal">
                {{ translate("Adjust") }}
              </ion-button>
            </ion-card-header>
            <ion-item>
              <ion-label>{{ translate("QOH") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig?.inventoryConfig?.qoh ?? "-" }}</ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-label>{{ translate("ATP") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig?.inventoryConfig?.atp ?? "-" }}</ion-label>
            </ion-item>
          </ion-card>

          <ion-card class="ion-no-margin">
            <ion-card-header class="card-header">
              <ion-card-title>{{ translate("Configuration") }}</ion-card-title>
              <ion-button fill="clear" @click="openConfigEditModal">
                {{ translate("Edit") }}
              </ion-button>
            </ion-card-header>
            <ion-item>
              <ion-label>{{ translate("Allow Brokering") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig?.inventoryConfig?.allowBrokering ?? "Y" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Allow Pickup") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig?.inventoryConfig?.allowPickup ?? "Y" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Safety stock") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig?.inventoryConfig?.minimumStock ?? "-" }}</ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-label>{{ translate("Days to Ship") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig?.inventoryConfig?.daysToShip ?? "-" }}</ion-label>
            </ion-item>
          </ion-card>
        </section>

        <!-- Inventory history: each row is a classified movement (the record that impacted stock).
             Collapsed = type + reference + date + ATP/QOH delta; expanded = before→after balances,
             source-record fields, and a deep link into the owning app via Fast Travel. -->
        <section class="history-section">
          <h1>{{ translate("Inventory history") }}</h1>

          <div class="history-controls">
            <ion-searchbar
              :placeholder="translate('Search by order name or ID')"
              :value="historyQuery"
              :debounce="150"
              @ionInput="historyQuery = $event.detail.value || ''"
            />
            <div class="type-filters" v-if="typeFilterOptions.length > 1">
              <ion-chip
                v-for="opt in typeFilterOptions"
                :key="opt.value"
                :outline="activeTypeFilter !== opt.value"
                :color="activeTypeFilter === opt.value ? 'primary' : undefined"
                @click="activeTypeFilter = opt.value"
              >
                <ion-icon :icon="opt.icon" :color="activeTypeFilter === opt.value ? undefined : opt.color" />
                <ion-label>{{ translate(opt.label) }}</ion-label>
              </ion-chip>
            </div>

            <div class="date-filters">
              <ion-chip
                v-for="opt in dateRangeOptions"
                :key="opt.value"
                :outline="dateRangePreset !== opt.value"
                :color="dateRangePreset === opt.value ? 'primary' : undefined"
                @click="dateRangePreset = opt.value"
              >
                <ion-label>{{ translate(opt.label) }}</ion-label>
              </ion-chip>
            </div>

            <div class="custom-range" v-if="dateRangePreset === 'CUSTOM'">
              <div class="date-field">
                <span class="overline">{{ translate("From") }}</span>
                <ion-datetime-button datetime="historyFromDate" />
              </div>
              <div class="date-field">
                <span class="overline">{{ translate("To") }}</span>
                <ion-datetime-button datetime="historyToDate" />
              </div>
              <ion-modal :keep-contents-mounted="true">
                <ion-datetime
                  id="historyFromDate"
                  presentation="date"
                  :value="customFrom || undefined"
                  :max="customTo || undefined"
                  show-default-buttons
                  @ionChange="customFrom = ($event.detail.value as string) || ''"
                />
              </ion-modal>
              <ion-modal :keep-contents-mounted="true">
                <ion-datetime
                  id="historyToDate"
                  presentation="date"
                  :value="customTo || undefined"
                  :min="customFrom || undefined"
                  show-default-buttons
                  @ionChange="customTo = ($event.detail.value as string) || ''"
                />
              </ion-modal>
            </div>
          </div>

          <!-- Real loading state: skeleton rows mirroring the collapsed accordion while the history
               fetch (+ order-name enrichment) is in flight, so a slow load never reads as "empty". -->
          <div v-if="isHistoryLoading" class="history-skeleton" aria-hidden="true">
            <div class="skeleton-row" v-for="n in 6" :key="n">
              <ion-skeleton-text :animated="true" class="sk-icon" />
              <div class="sk-main">
                <ion-skeleton-text :animated="true" class="sk-title" />
                <ion-skeleton-text :animated="true" class="sk-sub" />
              </div>
              <div class="sk-deltas">
                <ion-skeleton-text :animated="true" class="sk-delta" />
                <ion-skeleton-text :animated="true" class="sk-delta" />
              </div>
            </div>
          </div>

          <template v-else-if="filteredMovements.length">
          <ion-accordion-group multiple>
            <ion-accordion
              v-for="(m, index) in pagedMovements"
              :key="`${m.raw.inventoryItemDetailSeqId}-${index}`"
              :value="`${m.raw.inventoryItemDetailSeqId}-${index}`"
            >
              <ion-item slot="header" lines="full">
                <ion-icon slot="start" :icon="m.icon" :color="m.color" />
                <ion-label class="movement-header">
                  <div class="movement-title">
                    <ion-chip class="type-chip" :color="m.color" :outline="true">
                      <ion-label>{{ translate(m.label) }}</ion-label>
                    </ion-chip>
                    <span class="reference">{{ m.referenceLabel }}</span>
                  </div>
                  <p class="movement-sub">{{ formatDateTime(m.raw.effectiveDate) }} · {{ facilityName(m.raw.facilityId) }}</p>
                </ion-label>
                <div slot="end" class="header-deltas">
                  <span class="delta-pill">
                    <small>{{ translate("ATP") }}</small>
                    <span :class="diffClass(m.raw.availableToPromiseDiff)">{{ signed(m.raw.availableToPromiseDiff) }}</span>
                  </span>
                  <span class="delta-pill">
                    <small>{{ translate("QOH") }}</small>
                    <span :class="diffClass(m.raw.quantityOnHandDiff)">{{ signed(m.raw.quantityOnHandDiff) }}</span>
                  </span>
                </div>
              </ion-item>

              <div slot="content" class="movement-content">
                <div class="balance-grid">
                  <div class="balance-cell">
                    <span class="overline">{{ translate("ATP") }}</span>
                    <span class="balance-flow">
                      <span>{{ m.raw.lastAvailableToPromise ?? 0 }}</span>
                      <ion-icon :icon="arrowForwardOutline" />
                      <strong>{{ runningTotal(m.raw.lastAvailableToPromise, m.raw.availableToPromiseDiff) }}</strong>
                    </span>
                  </div>
                  <div class="balance-cell">
                    <span class="overline">{{ translate("QOH") }}</span>
                    <span class="balance-flow">
                      <span>{{ m.raw.lastQuantityOnHand ?? 0 }}</span>
                      <ion-icon :icon="arrowForwardOutline" />
                      <strong>{{ runningTotal(m.raw.lastQuantityOnHand, m.raw.quantityOnHandDiff) }}</strong>
                    </span>
                  </div>
                  <div class="balance-cell" v-if="m.raw.accountingQuantityDiff !== undefined && m.raw.accountingQuantityDiff !== null">
                    <span class="overline">{{ translate("Accounting") }}</span>
                    <span class="balance-flow">
                      <span :class="diffClass(m.raw.accountingQuantityDiff)">{{ signed(m.raw.accountingQuantityDiff) }}</span>
                      <ion-icon :icon="arrowForwardOutline" />
                      <strong>{{ m.raw.accountingQuantityTotal ?? "-" }}</strong>
                    </span>
                  </div>
                </div>

                <dl class="source-grid">
                  <template v-if="m.raw.orderId">
                    <dt>{{ translate("Order") }}</dt>
                    <dd>{{ m.order?.orderName || m.raw.orderId }}<span v-if="m.order?.orderName" class="muted"> · {{ m.raw.orderId }}</span></dd>
                    <template v-if="m.order?.orderStatusDesc">
                      <dt>{{ translate("Order status") }}</dt><dd>{{ m.order.orderStatusDesc }}</dd>
                    </template>
                    <template v-if="m.raw.orderItemSeqId">
                      <dt>{{ translate("Order item") }}</dt><dd>{{ m.raw.orderItemSeqId }}<span v-if="m.raw.shipGroupSeqId" class="muted"> · {{ translate("Ship group") }} {{ m.raw.shipGroupSeqId }}</span></dd>
                    </template>
                  </template>
                  <template v-if="m.raw.returnId">
                    <dt>{{ translate("Return") }}</dt><dd>{{ m.raw.returnId }}</dd>
                  </template>
                  <template v-if="m.raw.physicalInventoryId">
                    <dt>{{ translate("Physical inventory") }}</dt><dd>{{ m.raw.physicalInventoryId }}</dd>
                  </template>
                  <template v-if="m.reasonDesc || m.raw.reasonEnumId">
                    <dt>{{ translate("Reason") }}</dt><dd>{{ m.reasonDesc || m.raw.reasonEnumId }}</dd>
                  </template>
                  <template v-if="m.raw.unitCost">
                    <dt>{{ translate("Unit cost") }}</dt><dd>{{ m.raw.unitCost }}</dd>
                  </template>
                  <dt>{{ translate("Inventory item") }}</dt>
                  <dd>{{ m.raw.inventoryItemId }}<span v-if="m.raw.locationSeqId" class="muted"> · {{ m.raw.locationSeqId }}</span></dd>
                </dl>

                <ion-button
                  v-if="m.link"
                  :href="m.link"
                  target="_blank"
                  rel="noopener"
                  fill="outline"
                  size="small"
                  class="movement-link"
                >
                  {{ translate(m.linkLabel) }}
                  <ion-icon slot="end" :icon="openOutline" />
                </ion-button>
              </div>
            </ion-accordion>
          </ion-accordion-group>

          <div class="history-pagination">
            <span class="page-summary">
              {{ translate("{start}–{end} of {total}", { start: pageRangeStart, end: pageRangeEnd, total: filteredMovements.length }) }}
            </span>
            <div class="page-nav" v-if="pageCount > 1">
              <ion-button fill="clear" size="small" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
                <ion-icon slot="icon-only" :icon="chevronBackOutline" />
              </ion-button>
              <span class="page-indicator">{{ translate("Page {current} of {total}", { current: currentPage, total: pageCount }) }}</span>
              <ion-button fill="clear" size="small" :disabled="currentPage >= pageCount" @click="goToPage(currentPage + 1)">
                <ion-icon slot="icon-only" :icon="chevronForwardOutline" />
              </ion-button>
            </div>
          </div>
          </template>

          <p v-else class="empty-state">
            {{ historyQuery || activeTypeFilter !== 'ALL' || dateRangePreset !== 'ALL' ? translate("No movements match your filters") : translate("No inventory logs found") }}
          </p>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import router from '../router';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonSearchbar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  modalController,
  onIonViewDidEnter
} from '@ionic/vue';
import { arrowForwardOutline, chevronBackOutline, chevronForwardOutline, cubeOutline, openOutline, layersOutline } from 'ionicons/icons';
import { api, logger, translate } from '@common';
import { DateTime } from 'luxon';
import { useProductFacility } from '@/composables/useProductFacility';
import { productStore } from '@/store/productStore';
import { productStore as productInfoStore } from '@/store/product';
import { orderRoutingStore } from '@/store/orderRoutingStore';
import ProductFacilityConfigEditModal from '@/components/ProductFacilityConfigEditModal.vue';
import ProductInventoryEdit from '@/components/ProductInventoryEdit.vue';
import FacilitySwitcherModal from '@/components/FacilitySwitcherModal.vue';
import { getPrimaryProductIdentifier, getSecondaryProductIdentifier } from '@/utils/productIdentifier';
import { classifyMovement, MOVEMENT_TYPE_ORDER, movementTypeLabel, movementTypeIcon, movementTypeColor } from '@/utils/inventoryMovement';

// Inventory-log effectiveDate arrives as either epoch millis or an ISO string; normalise to a
// luxon DateTime so both display and date-range filtering share one parse.
function toDateTime(value: any): DateTime | null {
  if (!value) return null;
  const dt = typeof value === 'number' ? DateTime.fromMillis(value) : DateTime.fromISO(String(value));
  return dt.isValid ? dt : null;
}

function formatDateTime(value: any): string {
  const dt = toDateTime(value);
  return dt ? dt.toLocaleString({ ...DateTime.DATETIME_MED, hourCycle: 'h12' }) : (value ? String(value) : '-');
}

const HISTORY_PAGE_SIZE = 20;

const route = router.currentRoute.value;
const isLoading = ref(false);

const productId = computed(() => String(route.params.productId || ''));
const product = computed(() => productInfoStore().getProductById(productId.value))
const selectedFacilityId = ref("");
const productStoreFacilities = computed(() => productStore().productStoreFacilities)
const facilityMap = computed(() => productStoreFacilities.value.reduce((map: any, facility: any) => {
  map[facility.facilityId] = facility.facilityName
  return map
}, {}))
const productIdentificationPref = computed(() => productStore().getProductIdentificationPref)
const currentFacilityName = computed(() => facilityMap.value[selectedFacilityId.value] || '')

// Single composable instance shared by fetchInventoryConfig/fetchInventoryLogs below so they read
// and write the same per-instance state (see useProductFacility for why the singleton was removed).
const productFacilityApi = useProductFacility();
const { inventoryLogs } = productFacilityApi;
const inventoryConfig = ref<any>({});

// Inventory-history enrichment + filtering state.
const isHistoryLoading = ref(true); // starts true so the skeleton shows from mount through the first load (no empty-state flash); toggled by loadInventoryHistory thereafter
const orderSummaries = ref<Record<string, any>>({}); // orderId -> { orderName, orderTypeId, ... }
const reasonDescById = ref<Record<string, string>>({}); // IID_REASON enumId -> description
const historyQuery = ref("");
const activeTypeFilter = ref<string>("ALL");
// Date-range filter: a relative preset (rolling window ending now) or "CUSTOM" with explicit
// from/to dates. "ALL" means no date bound.
const dateRangePreset = ref<string>("ALL");
const customFrom = ref<string>(""); // ion-datetime ISO value, e.g. "2026-06-01"
const customTo = ref<string>("");
const currentPage = ref(1);

const dateRangeOptions = [
  { value: "ALL", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "CUSTOM", label: "Custom" }
];

// Classify each raw log into a movement (source record + presentation), using the resolved order
// summaries and reason descriptions as context.
const movements = computed(() =>
  (inventoryLogs.value || []).map((row: any) =>
    classifyMovement(row, { orderSummaries: orderSummaries.value, reasonDescById: reasonDescById.value })
  )
);

// Type-filter chips: "All" plus only the movement types actually present, in a stable order. Each
// type chip carries the same icon + colour as its rows so the filter maps visually to the movements
// below; "All" gets a neutral icon.
const typeFilterOptions = computed(() => {
  const present = new Set(movements.value.map((m: any) => m.typeKey));
  const options = [{ value: "ALL", label: "All", icon: layersOutline, color: undefined as string | undefined }];
  MOVEMENT_TYPE_ORDER.forEach((typeKey) => {
    if (present.has(typeKey)) {
      options.push({ value: typeKey, label: movementTypeLabel(typeKey), icon: movementTypeIcon(typeKey), color: movementTypeColor(typeKey) });
    }
  });
  return options;
});

// Resolved [start, end] bounds for the active date filter, or null bounds when unconstrained.
const dateBounds = computed<{ start: DateTime | null; end: DateTime | null }>(() => {
  const preset = dateRangePreset.value;
  if (preset === "ALL") return { start: null, end: null };
  if (preset === "CUSTOM") {
    return {
      start: customFrom.value ? DateTime.fromISO(customFrom.value).startOf("day") : null,
      end: customTo.value ? DateTime.fromISO(customTo.value).endOf("day") : null
    };
  }
  return { start: DateTime.now().minus({ days: Number(preset) }).startOf("day"), end: DateTime.now() };
});

const filteredMovements = computed(() => {
  const q = historyQuery.value.trim().toLowerCase();
  const { start, end } = dateBounds.value;
  return movements.value.filter((m: any) => {
    if (activeTypeFilter.value !== "ALL" && m.typeKey !== activeTypeFilter.value) return false;
    if (q && !m.searchText.includes(q)) return false;
    if (start || end) {
      const dt = toDateTime(m.raw.effectiveDate);
      if (!dt) return false;
      if (start && dt < start) return false;
      if (end && dt > end) return false;
    }
    return true;
  });
});

// Client-side pagination over the filtered set (20 per page). The full batch is already loaded and
// enriched, so paging is just a slice — instant, no refetch.
const pageCount = computed(() => Math.max(1, Math.ceil(filteredMovements.value.length / HISTORY_PAGE_SIZE)));

const pagedMovements = computed(() => {
  const startIdx = (currentPage.value - 1) * HISTORY_PAGE_SIZE;
  return filteredMovements.value.slice(startIdx, startIdx + HISTORY_PAGE_SIZE);
});

// First/last result number shown on the current page, for the "X–Y of N" indicator.
const pageRangeStart = computed(() =>
  filteredMovements.value.length ? (currentPage.value - 1) * HISTORY_PAGE_SIZE + 1 : 0
);
const pageRangeEnd = computed(() =>
  Math.min(currentPage.value * HISTORY_PAGE_SIZE, filteredMovements.value.length)
);

function goToPage(page: number) {
  currentPage.value = Math.min(Math.max(1, page), pageCount.value);
}

// Any filter/search change returns to the first page so the user isn't stranded on an empty page.
watch([historyQuery, activeTypeFilter, dateRangePreset, customFrom, customTo], () => {
  currentPage.value = 1;
});

// Keep the page in range when the result set shrinks (e.g. switching facility reloads fewer rows).
watch(pageCount, (count) => {
  if (currentPage.value > count) currentPage.value = count;
});

// Header identity uses the configured product identifier preference, falling back through product identity fields.
const primaryIdentifier = computed(() =>
  getPrimaryProductIdentifier(productIdentificationPref.value, product.value)
);

const secondaryIdentifier = computed(() =>
  getSecondaryProductIdentifier(productIdentificationPref.value, product.value)
);

const productName = computed(() =>
  product.value?.internalName || product.value?.productName || product.value?.parentProductName || ''
);

function facilityName(facilityId: string) {
  return facilityMap.value[facilityId] || facilityId || '-'
}

function signed(value: any) {
  const num = Number(value) || 0
  return num > 0 ? `+${num}` : `${num}`
}

function runningTotal(last: any, diff: any) {
  return (Number(last) || 0) + (Number(diff) || 0)
}

function diffClass(value: any) {
  const num = Number(value) || 0
  return num > 0 ? 'diff-positive' : num < 0 ? 'diff-negative' : ''
}

onIonViewDidEnter(async () => {
  selectedFacilityId.value = productStore().selectedInventoryFacilityId || productStoreFacilities.value[0]?.facilityId || '';
  isLoading.value = true;
  await productInfoStore().fetchProducts([productId.value]);
  isLoading.value = false;
  loadReasonEnums();
  await fetchInventoryConfig();
  await loadInventoryHistory();
});

watch(selectedFacilityId, async () => {
  await fetchInventoryConfig();
  await loadInventoryHistory();
});

async function fetchInventoryConfig() {
  // Exact productId (not keyword): keyword fuzzy-matches a virtual product's variants and would
  // show a variant's inventory for the virtual product. Exact match keeps the detail truthful —
  // a virtual product has no own inventory — and consistent with the facility switcher.
  await productFacilityApi.fetchProductFacility({
    productId: productId.value,
    facilityId: selectedFacilityId.value
  });
  inventoryConfig.value = productFacilityApi.productFacility.value?.[0] ?? null;
}

async function fetchInventoryLogs() {
  await productFacilityApi.fetchInventoryLogs({
    productId: productId.value,
    facilityId: selectedFacilityId.value,
    pageSize: 250
  });
}

// Load the history rows, then resolve the distinct orderIds they reference so the UI can show order
// names and classify sales vs transfer vs purchase. All 250 rows are client-side, so search/filter
// over them is instant once enriched.
async function loadInventoryHistory() {
  isHistoryLoading.value = true;
  try {
    await fetchInventoryLogs();
    const orderIds = [...new Set((inventoryLogs.value || []).filter((l: any) => l.orderId).map((l: any) => l.orderId))];
    orderSummaries.value = orderIds.length ? await orderRoutingStore().fetchOrderSummaries(orderIds) : {};
  } finally {
    isHistoryLoading.value = false;
  }
}

// IID_REASON enum descriptions (e.g. VAR_EXT_RESET → "External reset") for cycle-count/adjustment
// rows. Fetched once per view; failures fall back to the raw enumId / row description.
let reasonsLoaded = false;
async function loadReasonEnums() {
  if (reasonsLoaded) return;
  try {
    const resp = await api({
      url: "admin/enums",
      method: "GET",
      params: { enumTypeId: "IID_REASON", pageNoLimit: true }
    }) as any;
    const map: Record<string, string> = {};
    (resp?.data || []).forEach((enumItem: any) => {
      if (enumItem?.enumId) map[enumItem.enumId] = enumItem.description || enumItem.enumId;
    });
    reasonDescById.value = map;
    reasonsLoaded = true;
  } catch (err) {
    logger.error("Failed to fetch inventory reason enums", err);
  }
}

async function openInventoryEditModal() {
  const modal = await modalController.create({
    component: ProductInventoryEdit,
    componentProps: {
      selectedFacility: selectedFacilityId.value,
      selectedProducts: [{ productId: productId.value }],
      currentConfig: inventoryConfig.value?.inventoryConfig
    }
  });
  await modal.present();
  await modal.onDidDismiss();
  await fetchInventoryConfig();
}

async function openConfigEditModal() {
  const modal = await modalController.create({
    component: ProductFacilityConfigEditModal,
    componentProps: {
      selectedFacility: selectedFacilityId.value,
      selectedProducts: [{ productId: productId.value }],
      currentConfig: inventoryConfig.value?.inventoryConfig
    }
  });
  await modal.present();
  await modal.onDidDismiss();
  await fetchInventoryConfig();
}

async function openFacilitySwitcher() {
  const modal = await modalController.create({
    component: FacilitySwitcherModal,
    componentProps: {
      productId: productId.value,
      currentFacilityId: selectedFacilityId.value,
      facilities: productStoreFacilities.value
    }
  });
  await modal.present();
  const { data } = await modal.onDidDismiss();
  // Selecting a facility updates selectedFacilityId; its watcher refetches config + logs.
  if (data?.facilityId && data.facilityId !== selectedFacilityId.value) {
    selectedFacilityId.value = data.facilityId;
  }
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.detail-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacer-base, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--spacer-base, 16px);
}

/* Product-first header */
.product-header {
  display: flex;
  align-items: center;
  gap: var(--spacer-base, 16px);
  flex-wrap: wrap;
  padding: var(--spacer-base, 16px);
  border: 1px solid var(--ion-color-step-150, #d7d8da);
  border-radius: 8px;
}

.product-image {
  display: grid;
  place-items: center;
  flex: 0 0 88px;
  width: 88px;
  height: 88px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--ion-color-step-100, #f4f5f8);
  color: var(--ion-color-medium);
}

.product-image img,
.product-image ion-skeleton-text {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-identity {
  flex: 1 1 240px;
  min-width: 0;
}


.product-identity p {
  margin: 2px 0 0;
  color: var(--ion-color-medium);
}

.product-identity .product-name {
  color: var(--ion-color-dark);
}

.product-identity .skeleton-title {
  width: 50%;
  height: 22px;
}

.product-identity .skeleton-sub {
  width: 35%;
  height: 14px;
  margin-top: 6px;
}

.facility-select {
  flex: 2 0 375px;
  --background: transparent;
  --padding-start: 0;
}

/* Summary cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacer-base, 16px);
  align-items: start;
}

.card-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

ion-item {
  --min-height: 52px;
}

/* Inventory history */
.history-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-xs, 8px);
}

.history-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-xs, 8px);
}


.type-filters,
.date-filters {
  display: flex;
  flex-wrap: wrap;
}

.custom-range {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-base, 16px);
  align-items: center;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: var(--spacer-xs, 8px);
}

.page-summary {
  color: var(--ion-color-medium);
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.page-indicator {
  color: var(--ion-color-medium);
  min-width: 96px;
  text-align: center;
}

/* Collapsed accordion header */
.movement-header {
  white-space: normal;
}

.movement-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.type-chip {
  height: 22px;
}

.header-deltas {
  display: flex;
  gap: 16px;
  align-items: center;
}

.delta-pill {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}

.delta-pill small {
  color: var(--ion-color-medium);
}

/* Expanded accordion content */
.movement-content {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--ion-color-step-50, #f7f7f7);
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.balance-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.balance-flow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.balance-flow ion-icon {
  color: var(--ion-color-medium);
}

.source-grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}

.source-grid dt {
  color: var(--ion-color-medium);
}

.source-grid dd {
  margin: 0;
  word-break: break-word;
}

.movement-content .muted {
  color: var(--ion-color-medium);
}

.movement-link {
  align-self: flex-start;
}

/* Loading skeleton — mirrors the collapsed accordion header layout (icon · title/sub · deltas) */
.history-skeleton {
  display: flex;
  flex-direction: column;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ion-color-step-150, #d7d8da);
}

.skeleton-row .sk-icon {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  margin: 0;
  border-radius: 6px;
}

.skeleton-row .sk-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row .sk-title {
  width: 45%;
  height: 16px;
  margin: 0;
  border-radius: 4px;
}

.skeleton-row .sk-sub {
  width: 30%;
  height: 12px;
  margin: 0;
  border-radius: 4px;
}

.skeleton-row .sk-deltas {
  flex: 0 0 auto;
  display: flex;
  gap: 16px;
}

.skeleton-row .sk-delta {
  width: 30px;
  height: 26px;
  margin: 0;
  border-radius: 4px;
}

.diff-positive {
  color: var(--ion-color-success, #2dd36f);
}

.diff-negative {
  color: var(--ion-color-danger, #eb445a);
}

.empty-state {
  text-align: center;
  color: var(--ion-color-medium);
  padding: var(--spacer-base, 16px);
}

@media (max-width: 576px) {
  .product-image {
    flex-basis: 64px;
    width: 64px;
    height: 64px;
  }

  .facility-select {
    width: 100%;
  }
}
</style>
