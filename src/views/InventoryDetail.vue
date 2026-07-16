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
        <!-- Product-first header: product identity & variant selection -->
        <div class="header">
          <div class="product-image">
            <ion-skeleton-text v-if="isLoading" animated />
            <DxpShopifyImg v-else :src="product.mainImageUrl" />
          </div>

          <div class="product-info">
            <div class="ion-padding">
              <template v-if="isLoading">
                <ion-skeleton-text animated style="width: 50%; height: 20px;" />
                <ion-skeleton-text animated style="width: 35%; height: 14px; margin-top: 6px;" />
              </template>
              <template v-else>
                <h2>{{ primaryIdentifier }}</h2>
                <p v-if="secondaryIdentifier">{{ secondaryIdentifier }}</p>
                <p class="product-name" v-if="productName">{{ productName }}</p>
              </template>
            </div>

            <!-- Variant selector chips -->
            <div class="product-features" v-if="!isLoading && visibleFeatures.length">
              <ion-list v-for="[feature, featureOptions] in visibleFeatures" :key="feature">
                <ion-list-header>{{ feature }}</ion-list-header>
                <ion-item lines="none">
                  <ion-row>
                    <ion-chip :outline="selectedFeatures[feature] !== option" :key="option" v-for="option in featureOptions" @click="selectedFeatures[feature] !== option && applyFeature(option, feature)">
                      <ion-label class="ion-text-wrap">{{ option }}</ion-label>
                    </ion-chip>
                  </ion-row>
                </ion-item>
              </ion-list>
            </div>
          </div>

          <ion-card>
            <!-- Facility selector as the top item of the card -->
            <ion-item class="facility-select" lines="full">
              <ion-label>
                <p class="overline">{{ translate("Facility") }}</p>
                <ion-card-title>{{ currentFacilityName || translate("Select facility") }}</ion-card-title>
              </ion-label>
              <ion-button slot="end" fill="outline" color="dark" :disabled="!productStoreFacilities.length" @click="openFacilitySwitcher()">
                {{ translate("Change location") }}
              </ion-button>
            </ion-item>

            <!-- Inventory section divider -->
            <ion-item-divider color="light">
              <ion-label>{{ translate("Inventory") }}</ion-label>
              <ion-button slot="end" fill="clear" @click="openInventoryEditModal">
                {{ translate("Adjust") }}
              </ion-button>
            </ion-item-divider>

            <ion-item>
              <ion-label>{{ translate("QOH") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig?.inventoryConfig?.qoh ?? "-" }}</ion-label>
            </ion-item>
            <ion-item lines="full">
              <ion-label>{{ translate("ATP") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig?.inventoryConfig?.atp ?? "-" }}</ion-label>
            </ion-item>

            <!-- Configuration section divider -->
            <ion-item-divider color="light">
              <ion-label>{{ translate("Configuration") }}</ion-label>
              <ion-button slot="end" fill="clear" @click="openConfigEditModal">
                {{ translate("Edit") }}
              </ion-button>
            </ion-item-divider>

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
        </div>

        <!-- Inventory history: each row is a classified movement (the record that impacted stock).
             Collapsed = type + reference + date + ATP/QOH delta; expanded = before→after balances,
             source-record fields, and a deep link into the owning app via Fast Travel. -->
        <section class="history-section">
          <h1>{{ facilityName(selectedFacilityId) }} {{ translate("inventory history") }}</h1>

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
          <ion-accordion-group multiple @ionChange="onHistoryAccordionChange">
            <ion-accordion
              v-for="(m, index) in pagedMovements"
              :key="`${m.raw.inventoryItemDetailSeqId}-${index}`"
              :value="`${m.raw.inventoryItemDetailSeqId}-${index}`"
            >
              <ion-item slot="header" lines="full">
                <ion-icon slot="start" :icon="m.icon" :color="m.color" />
                <ion-label class="movement-header">
                  <p class="overline">{{ translate(m.label) }}</p>
                  {{ m.referenceLabel }}
                  <p class="movement-sub">{{ formatDateTime(m.raw.effectiveDate) }}</p>
                </ion-label>
                <div slot="end" class="header-deltas">
                  <span class="delta-pill">
                    <small>{{ translate("ATP") }}</small>
                    <span>
                      {{ runningTotal(m.raw.lastAvailableToPromise, m.raw.availableToPromiseDiff) }}
                      <span :class="diffClass(m.raw.availableToPromiseDiff)">({{ signed(m.raw.availableToPromiseDiff) }})</span>
                    </span>
                  </span>
                  <span class="delta-pill">
                    <small>{{ translate("QOH") }}</small>
                    <span>
                      {{ runningTotal(m.raw.lastQuantityOnHand, m.raw.quantityOnHandDiff) }}
                      <span :class="diffClass(m.raw.quantityOnHandDiff)">({{ signed(m.raw.quantityOnHandDiff) }})</span>
                    </span>
                  </span>
                </div>
              </ion-item>

              <div slot="content" class="movement-content">
                <!-- Business impact + who did it: resolved lazily on expand, cached per row. Shows a
                     skeleton while loading, the resolved lines when present, or "Not available" when a
                     backend source isn't there yet. -->
                <div class="impact-block" v-if="isEnrichable(m)">
                  <p class="impact-title overline">{{ translate("Business impact") }}</p>
                  <dl class="source-grid" v-if="impactFor(m)?.loading">
                    <dt>{{ translate("Who / impact") }}</dt>
                    <dd><ion-skeleton-text :animated="true" style="width: 180px; height: 14px;" /></dd>
                  </dl>
                  <dl class="source-grid" v-else-if="impactFor(m)?.data && !impactFor(m)?.data?.empty">
                    <template v-if="impactFor(m)?.data?.customerName">
                      <dt>{{ translate("Customer") }}</dt><dd>{{ impactFor(m)?.data?.customerName }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.supplierName">
                      <dt>{{ translate("Supplier") }}</dt><dd>{{ impactFor(m)?.data?.supplierName }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.orderDate">
                      <dt>{{ translate("Ordered") }}</dt><dd>{{ formatDateTime(impactFor(m)?.data?.orderDate) }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.unitPrice != null">
                      <dt>{{ translate("Sold at") }}</dt><dd>{{ money(impactFor(m)?.data?.unitPrice) }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.averageCost != null">
                      <dt>{{ translate("Weighted avg cost") }}</dt><dd>{{ money(impactFor(m)?.data?.averageCost) }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.issuedQuantity != null">
                      <dt>{{ translate("Shipped qty") }}</dt><dd>{{ impactFor(m)?.data?.issuedQuantity }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.receivedQuantity != null">
                      <dt>{{ translate("Received qty") }}</dt><dd>{{ impactFor(m)?.data?.receivedQuantity }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.shippedBy">
                      <dt>{{ translate("Shipped by") }}</dt><dd>{{ impactFor(m)?.data?.shippedBy }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.receivedBy">
                      <dt>{{ translate("Received by") }}</dt><dd>{{ impactFor(m)?.data?.receivedBy }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.countedBy">
                      <dt>{{ translate("Counted by") }}</dt><dd>{{ impactFor(m)?.data?.countedBy }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.acceptedBy">
                      <dt>{{ translate("Variance accepted by") }}</dt><dd>{{ impactFor(m)?.data?.acceptedBy }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.loggedBy">
                      <dt>{{ translate("Logged by") }}</dt><dd>{{ impactFor(m)?.data?.loggedBy }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.rejectionReasonDesc">
                      <dt>{{ translate("Rejection reason") }}</dt><dd>{{ impactFor(m)?.data?.rejectionReasonDesc }}</dd>
                    </template>
                    <template v-if="impactFor(m)?.data?.comments">
                      <dt>{{ translate("Comments") }}</dt><dd>{{ impactFor(m)?.data?.comments }}</dd>
                    </template>
                  </dl>
                  <p class="muted impact-empty" v-else-if="impactFor(m)?.data?.empty">{{ translate("Not available") }}</p>
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
                    <dt>{{ translate("Unit cost") }}</dt><dd>{{ money(m.raw.unitCost) }}</dd>
                  </template>
                  <dt>{{ translate("Inventory item") }}</dt>
                  <dd>{{ m.raw.inventoryItemId }}<span class="muted"> · {{ translate("detail") }} {{ m.raw.inventoryItemDetailSeqId }}</span><span v-if="m.raw.locationSeqId" class="muted"> · {{ m.raw.locationSeqId }}</span></dd>
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
  IonItemDivider,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonPage,
  IonRow,
  IonSearchbar,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  modalController,
  onIonViewDidEnter
} from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline, cubeOutline, openOutline, layersOutline } from 'ionicons/icons';
import { api, logger, translate, DxpShopifyImg, commonUtil } from '@common';
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
import { useInventory } from '@/composables/useInventory';
import { useSalesOrder } from '@/composables/useSalesOrder';

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

// Money to 2dp when numeric; otherwise passed through (never blank).
function money(value: any): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : String(value ?? '');
}

// The "business impact + who did it" resolved lazily per expanded row. All fields optional and
// already display-ready (actor ids are name-resolved before they land here, falling back to the raw
// id). `empty: true` means we looked but the backend had nothing to show → the UI reads "Not available".
interface MovementImpact {
  customerName?: string;
  supplierName?: string;
  orderDate?: string | number;
  unitPrice?: string | number;      // price a sales line was sold at
  averageCost?: string | number;    // resulting weighted-average cost after a cost-bearing receipt
  issuedQuantity?: string | number; // transfer: units shipped out
  receivedQuantity?: string | number; // transfer: units received in
  shippedBy?: string;
  receivedBy?: string;
  countedBy?: string;
  acceptedBy?: string;
  loggedBy?: string;
  rejectionReasonDesc?: string;
  comments?: string;
  empty?: boolean;
}

// Movement types that gain extra detail on expand. Others (return/rollover/receipt/adjustment) already
// show everything known from the raw row, so expanding them fires no request.
const ENRICHABLE_TYPES = new Set(["SALES_ORDER", "TRANSFER", "PURCHASE", "CYCLE_COUNT", "MANUAL_VARIANCE"]);

const HISTORY_PAGE_SIZE = 20;

const route = router.currentRoute.value;
const isLoading = ref(false);

// Local source of truth for the displayed variant, seeded once from the route. Variant chips
// mutate this in place (see applyFeature) instead of navigating: under Ionic, a route change to a
// new /inventory/:productId pushes a whole new page onto the outlet stack and remounts the view.
const productId = ref(String(route.params.productId || ''));
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
// Lazy per-row "business impact + who did it": resolved only when a row is expanded and cached per
// row (by its InventoryItemDetail PK). Each composable owns one slice of the resolution + its own
// cache; useUserNames turns actor userLoginIds into display names shared across every slice.
const inventoryApi = useInventory();
const salesOrderApi = useSalesOrder();
const movementImpact = ref<Record<string, { loading: boolean; data: MovementImpact | null }>>({});
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

const variants = ref<any[]>([]);
const features = ref<Record<string, string[]>>({});
const selectedFeatures = ref<Record<string, string>>({});

// Get feature value helper
function getFeatureValue(productFeatures: string[], featureType: string): string {
  if (!productFeatures) return "";
  const found = productFeatures.find((f: string) => f.startsWith(featureType + "/"));
  return found ? found.split("/")[1] : "";
}

// Populate features & selectedFeatures
function updateVariantSelection() {
  const currentProduct = product.value;
  if (!currentProduct) return;

  // A real variant has exactly one value per feature type; the group's virtual product lists them
  // all. Only single-valued types count as a "selected" chip, so on the virtual product nothing is
  // pre-selected (rather than arbitrarily highlighting the last-listed size/color).
  const currentFeatures: Record<string, string> = {};
  const featureValueCounts: Record<string, number> = {};
  (currentProduct.productFeatures || []).forEach((featureItem: string) => {
    const type = featureItem.split("/")[0];
    if (type) featureValueCounts[type] = (featureValueCounts[type] || 0) + 1;
  });
  (currentProduct.productFeatures || []).forEach((featureItem: string) => {
    const parts = featureItem.split("/");
    if (parts.length === 2 && featureValueCounts[parts[0]] === 1) {
      currentFeatures[parts[0]] = parts[1];
    }
  });
  selectedFeatures.value = currentFeatures;

  const allFeatures: Record<string, string[]> = {};
  variants.value.forEach((v: any) => {
    if (v.productFeatures) {
      v.productFeatures.forEach((featureItem: string) => {
        const parts = featureItem.split("/");
        if (parts.length === 2) {
          const type = parts[0];
          const val = parts[1];
          if (!allFeatures[type]) {
            allFeatures[type] = [];
          }
          if (!allFeatures[type].includes(val)) {
            allFeatures[type].push(val);
          }
        }
      });
    }
  });

  if (allFeatures['Size']) {
    allFeatures['Size'] = sortSizes(allFeatures['Size']);
  }

  features.value = allFeatures;
}

const visibleFeatures = computed(() => {
  return Object.entries(features.value).filter(([, options]) => options.length > 1);
});

// Seed the selector synchronously during setup so the first paint after an Ionic remount
// already shows the variant chips instead of blanking until fetchVariantDetails() resolves.
seedVariantsFromCache(product.value?.groupId);

function sortSizes(sizes: string[]): string[] {
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
  return [...sizes].sort((a, b) => {
    const idxA = order.indexOf(a.toUpperCase());
    const idxB = order.indexOf(b.toUpperCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

// Synchronously reconstruct the sibling list from already-cached products so the variant
// selector can paint on the first render. Ionic remounts this page on every variant
// navigation, so without this seed `variants` starts empty and the selector blanks out until
// fetchVariantDetails()'s network call resolves — that gap is the "selector flashing in and out".
function seedVariantsFromCache(parentId?: string) {
  if (!parentId) return;
  const cachedSiblings = Object.values(productInfoStore().products)
    .filter((p: any) => p && p.groupId === parentId);
  if (cachedSiblings.length) {
    variants.value = cachedSiblings;
    updateVariantSelection();
  }
}

async function fetchVariantDetails() {
  const currentProduct = product.value;
  const parentId = currentProduct?.groupId;
  if (!parentId) {
    variants.value = [];
    features.value = {};
    return;
  }

  // Paint from cache first (a no-op on the first load of a group), then refresh from Solr.
  seedVariantsFromCache(parentId);

  try {
    const resp = await api({
      url: "searchProducts",
      method: "post",
      baseURL: commonUtil.getOmsURL(),
      data: {
        filters: [`groupId: ${parentId}`],
        viewSize: 100
      }
    }) as any;
    if (resp?.data?.response?.docs && !commonUtil.hasError(resp)) {
      variants.value = resp.data.response.docs;

      // Cache these variant products in the productInfoStore so they are instantly accessible
      const variantProductsMap = resp.data.response.docs.reduce((acc: any, v: any) => {
        acc[v.productId] = v;
        return acc;
      }, {});
      productInfoStore().products = { ...productInfoStore().products, ...variantProductsMap };

      updateVariantSelection();
    }
  } catch (err) {
    logger.error("Failed to fetch product variants", err);
  }
}

function applyFeature(option: string, feature: string) {
  const updatedFeatures = { ...selectedFeatures.value, [feature]: option };

  // Only real variants are selectable. The group's virtual product (productId === groupId) lists
  // every feature value, so getFeatureValue returns its first-listed one and it would spuriously
  // match combinations — landing on the virtual product ("random product") instead of a variant.
  const selectableVariants = variants.value.filter((v: any) => v.productId !== v.groupId);

  let foundVariant = selectableVariants.find((v: any) =>
    Object.entries(updatedFeatures).every(([fKey, fVal]) => getFeatureValue(v.productFeatures, fKey) === fVal)
  );

  if (!foundVariant) {
    foundVariant = selectableVariants.find((v: any) => {
      return getFeatureValue(v.productFeatures, feature) === option;
    });
  }

  if (foundVariant && foundVariant.productId !== productId.value) {
    // Switch variant in place — no router navigation, so Ionic keeps the current page instead of
    // pushing a new one onto the stack. The watch(productId) below refreshes product/config/history.
    productId.value = foundVariant.productId;
    // Keep the address bar in sync (refresh / deep-link / share) without going through the router.
    const href = router.resolve({ name: 'Inventory detail', params: { productId: foundVariant.productId } }).href;
    window.history.replaceState(window.history.state, '', href);
  }
}

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
  // Only show the loading skeleton when the product isn't already cached — on a remount into a
  // cached variant this keeps the header/selector from flashing to skeletons and back.
  const cachedProduct = productInfoStore().getProductById(productId.value);
  if (!cachedProduct || !Object.keys(cachedProduct).length) {
    isLoading.value = true;
    await productInfoStore().fetchProducts([productId.value]);
    isLoading.value = false;
  }
  // Non-blocking fetch of sibling variants!
  fetchVariantDetails();
  loadReasonEnums();
  await fetchInventoryConfig();
  await loadInventoryHistory();
});

watch(productId, async (newProductId) => {
  if (!newProductId) return;

  // Try to load cached product to avoid layout shift / spinner flash
  const cachedProduct = productInfoStore().getProductById(newProductId);
  if (!cachedProduct || !Object.keys(cachedProduct).length) {
    isLoading.value = true;
    await productInfoStore().fetchProducts([newProductId]);
    isLoading.value = false;
  }

  const hasVariant = variants.value.some((v: any) => v.productId === newProductId);
  if (!hasVariant) {
    // Sibling variants not loaded/matching, fetch in background (non-blocking)
    fetchVariantDetails();
  } else {
    // Sibling variants already loaded, update chip highlights instantly
    updateVariantSelection();
  }
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

// Lazy business-impact resolution: only fetch when a row is expanded (ionChange fires with the
// currently-open accordion value[s]); results are cached per row so re-opening is free.
function isEnrichable(m: any): boolean {
  return !!m && ENRICHABLE_TYPES.has(m.typeKey);
}

// Stable per-row key = the InventoryItemDetail PK, so caching survives paging/filtering.
function movementRowKey(m: any): string {
  return `${m.raw.inventoryItemId}::${m.raw.inventoryItemDetailSeqId}`;
}

function impactFor(m: any) {
  return m ? movementImpact.value[movementRowKey(m)] : undefined;
}

function onHistoryAccordionChange(event: any) {
  const open = event?.detail?.value;
  const openValues: string[] = Array.isArray(open) ? open : (open ? [open] : []);
  openValues.forEach((value) => {
    const idx = pagedMovements.value.findIndex((m: any, i: number) => `${m.raw.inventoryItemDetailSeqId}-${i}` === value);
    const m = idx >= 0 ? pagedMovements.value[idx] : null;
    if (isEnrichable(m)) loadMovementImpact(m);
  });
}

async function loadMovementImpact(m: any) {
  const key = movementRowKey(m);
  if (movementImpact.value[key]) return; // already loading or loaded
  movementImpact.value = { ...movementImpact.value, [key]: { loading: true, data: null } };
  let data: MovementImpact | null = null;
  try {
    data = await resolveMovementImpact(m);
  } catch (err) {
    logger.error("Failed to resolve movement impact", err);
  }
  movementImpact.value = { ...movementImpact.value, [key]: { loading: false, data } };
}

// True when we resolved something but found no displayable field (→ show "Not available").
function isEmptyImpact(impact: MovementImpact): boolean {
  return !Object.keys(impact).some((k) => k !== "empty" && (impact as any)[k] != null && (impact as any)[k] !== "");
}

// Dispatch per movement type to the right source(s), then bake actor ids into display names. Every
// lookup degrades to null/omitted, so a missing or not-yet-shipped backend API never breaks the row.
async function resolveMovementImpact(m: any): Promise<MovementImpact | null> {
  const raw = m.raw;

  if (m.typeKey === "SALES_ORDER" || m.typeKey === "TRANSFER" || m.typeKey === "PURCHASE") {
    const impact: MovementImpact = {};

    // Seed from the order summary already loaded for the list (Solr) — shows date/customer/status
    // instantly with no extra call, so an order row always has *something* even if the detail is thin.
    if (m.order?.orderDate) impact.orderDate = m.order.orderDate;
    if (m.order?.customerPartyName) impact.customerName = m.order.customerPartyName;

    const oi = await salesOrderApi.fetchOrderImpact({
      orderId: raw.orderId,
      orderTypeId: m.order?.orderTypeId,
      orderItemSeqId: raw.orderItemSeqId,
      shipGroupSeqId: raw.shipGroupSeqId
    });
    if (oi) {
      if (oi.orderDate) impact.orderDate = oi.orderDate;
      if (oi.customerName) impact.customerName = oi.customerName;
      if (oi.supplierName) impact.supplierName = oi.supplierName;
      if (m.typeKey === "SALES_ORDER") {
        if (oi.unitPrice != null) impact.unitPrice = oi.unitPrice;
        if (oi.shippedBy) impact.shippedBy = oi.shippedBy; // sales picker name arrives resolved
      } else if (m.typeKey === "PURCHASE") {
        if (oi.unitPrice != null) impact.unitPrice = oi.unitPrice;
      } else if (m.typeKey === "TRANSFER") {
        if (oi.issuedQuantity != null) impact.issuedQuantity = oi.issuedQuantity;
        if (oi.receivedQuantity != null) impact.receivedQuantity = oi.receivedQuantity;
      }
      if (oi.rejectionReasonEnumId) {
        impact.rejectionReasonDesc = reasonDescById.value[oi.rejectionReasonEnumId] || oi.rejectionReasonEnumId;
      }
    }
    // Weighted-average-cost impact: only a cost-bearing receipt (PO/TO received with a unit cost)
    // moves ProductAverageCost, so only look it up then.
    if ((m.typeKey === "PURCHASE" || m.typeKey === "TRANSFER") && raw.unitCost) {
      const ac = await inventoryApi.fetchAverageCost(raw.productId || productId.value, raw.facilityId || selectedFacilityId.value);
      if (ac?.averageCost != null) impact.averageCost = ac.averageCost;
    }
    return isEmptyImpact(impact) ? { empty: true } : impact;
  }

  if (m.typeKey === "CYCLE_COUNT") {
    const audit = await inventoryApi.fetchCycleCountAudit(raw.physicalInventoryId);
    await inventoryApi.resolveNames([audit?.countedByUserLoginId, audit?.acceptedByUserLoginId]);
    if (!audit) return { empty: true };
    const impact: MovementImpact = {};
    if (audit.countedByUserLoginId) impact.countedBy = inventoryApi.displayName(audit.countedByUserLoginId);
    if (audit.acceptedByUserLoginId) impact.acceptedBy = inventoryApi.displayName(audit.acceptedByUserLoginId);
    return isEmptyImpact(impact) ? { empty: true } : impact;
  }

  if (m.typeKey === "MANUAL_VARIANCE") {
    const va = await inventoryApi.fetchVarianceAudit(raw.inventoryItemId, raw.physicalInventoryId);
    await inventoryApi.resolveNames([va?.changeByUserLoginId]);
    if (!va) return { empty: true };
    const impact: MovementImpact = {};
    if (va.changeByUserLoginId) impact.loggedBy = inventoryApi.displayName(va.changeByUserLoginId);
    if (va.comments) impact.comments = va.comments;
    return isEmptyImpact(impact) ? { empty: true } : impact;
  }

  return null;
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

.header {
  display: grid;
  grid-template-columns: 200px 1fr 1fr;
  grid-gap: var(--spacer-sm, 16px);
  padding: var(--spacer-sm, 16px) var(--spacer-sm, 16px) var(--spacer-xl, 48px);
  align-items: start;
}

.product-image img,
.product-image ion-skeleton-text {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
}

.product-info {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
}

.product-name {
  color: var(--ion-color-dark);
}

@media (max-width: 991px) {
  .header {
    grid: 1fr max-content / auto;
    padding: 0;
  }

  .product-image {
    grid-row: 1 / 3;
    grid-column: 1 / 2;
  }

  .product-image img,
  .product-image ion-skeleton-text {
    width: 100%;
    height: 50vh;
  }

  .product-info {
    grid-row: 2 / 3;
    grid-column: 1 / 2;
    backdrop-filter: blur(20px);
    background: linear-gradient(to bottom, #ffffff7d, white);
    padding: 16px 0;
  }
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

/* Business-impact block: the WHO + $ + context resolved lazily on expand, set apart from the raw
   reference grid below it. */
.impact-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 12px;
  margin-bottom: 2px;
  border-bottom: 1px solid var(--ion-color-step-150, #d7d8da);
}

.impact-title {
  margin: 0;
  color: var(--ion-color-medium);
}

.impact-empty {
  margin: 0;
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


</style>
