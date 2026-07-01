<template>
  <ion-card class="preview-card">
    <div class="search-container">
      <ion-searchbar :placeholder="translate('Search')" :value="searchQuery" :debounce="400"
        @ionInput="updateSearchQuery($event)" />
    </div>

    <div class="preview-controls-row">
      <div class="products-count">
        <ion-note v-if="!isLoading">{{ translate("products found", { count: total }) }}</ion-note>
      </div>

      <div class="facility-select" v-if="availableFacilities.length">
        <ion-select v-model="selectedFacilityId" label-placement="start" :label="translate('Preview facility:')"
          interface="popover" placeholder="Select Facility">
          <ion-select-option v-for="facility in availableFacilities" :key="facility.facilityId"
            :value="facility.facilityId">
            {{ facility.facilityName || facility.facilityId }}
          </ion-select-option>
        </ion-select>
      </div>

      <div class="pagination" v-if="total > pageSize">
        <ion-button fill="clear" size="small" :disabled="pageIndex === 0 || isLoading" @click="goToPreviousPage">
          <ion-icon slot="icon-only" :icon="caretBackOutline" />
        </ion-button>
        <ion-note color="medium">{{ pageIndex + 1 }} / {{ pageCount }}</ion-note>
        <ion-button fill="clear" size="small" :disabled="pageIndex >= pageCount - 1 || isLoading" @click="goToNextPage">
          <ion-icon slot="icon-only" :icon="caretForwardOutline" />
        </ion-button>
      </div>
    </div>
  </ion-card>
  <div class="empty-state" v-if="isLoading">
    <ion-spinner name="crescent" />
  </div>
  <template v-else-if="products.length">
    <div class="list-item" :class="{ 'has-facility': selectedFacilityId }" v-for="product in products"
      :key="product.productId">
      <ion-item lines="none">
        <ion-thumbnail slot="start">
          <DxpShopifyImg :src="product.mainImageUrl" />
        </ion-thumbnail>
        <ion-label>
          {{ getPrimaryProductIdentifier(productIdentificationPref, product) }}
          <p>{{ getSecondaryProductIdentifier(productIdentificationPref, product) }}</p>
        </ion-label>
      </ion-item>
      <div class="product-tags">
        <div v-if="getHittingTags(product).length">
          <ion-chip v-for="tag in getHittingTags(product).slice(0, ROW_META_CAP)" :key="tag">
            <ion-icon :icon="pricetagOutline" :aria-label="translate('Tags')" />
            <ion-label>{{ tag }}</ion-label>
          </ion-chip>
          <ion-note v-if="getHittingTags(product).length > ROW_META_CAP">{{ translate("+ {count} more", {
            count: getHittingTags(product).length - ROW_META_CAP
            }) }}</ion-note>
        </div>
      </div>
      <div class="product-features">
        <div v-if="getHittingFeatures(product).length">
          <ion-chip v-for="feature in getHittingFeatures(product).slice(0, ROW_META_CAP)" :key="feature">
            <ion-icon :icon="optionsOutline" :aria-label="translate('Features')" />
            <ion-label>{{ feature }}</ion-label>
          </ion-chip>
          <ion-note v-if="getHittingFeatures(product).length > ROW_META_CAP">{{ translate("+ {count} more", {
            count: getHittingFeatures(product).length - ROW_META_CAP }) }}</ion-note>
        </div>
      </div>
      <template v-if="selectedFacilityId">
        <div v-if="isInventoryLoading" class="tablet">
          <ion-spinner name="crescent" size="small" />
        </div>
        <template v-else-if="inventoryConfigs[product.productId]">
          <div class="tablet">
            <ion-label>
              {{ inventoryConfigs[product.productId].computedLastInventoryCount }}
              <p>{{ translate("ATP") }}</p>
            </ion-label>
          </div>
          <div class="tablet">
            <ion-label>
              {{ inventoryConfigs[product.productId].lastInventoryCount }}
              <p>{{ translate("QOH") }}</p>
            </ion-label>
          </div>
          <div>
            <ion-row class="ion-align-items-center ion-justify-content-center">
              <ion-note color="medium">{{ getAllowPickupTransition(product).oldVal }}</ion-note>
              <ion-icon :icon="arrowForwardOutline" size="small" />
              <ion-note :color="getAllowPickupTransition(product).isChanged ? 'primary' : 'dark'">{{ getAllowPickupTransition(product).newVal }}</ion-note>
            </ion-row>
            <ion-label>
              <p>{{ translate("Allow Pickup") }}</p>
            </ion-label>
          </div>
        </template>
        <template v-else>
          <div class="tablet">-</div>
          <div class="tablet">-</div>
          <div>-</div>
        </template>
      </template>
      <div></div>
    </div>
  </template>
  <div class="empty-state" v-else>
    <ion-icon :icon="cubeOutline" />
    <p>{{ translate("No products match these filters yet.") }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonRow,
  IonThumbnail
} from "@ionic/vue";
import { arrowForwardOutline, caretBackOutline, caretForwardOutline, cubeOutline, optionsOutline, pricetagOutline } from 'ionicons/icons';
import { DxpShopifyImg, translate, api, commonUtil } from '@common';
import { useAtpProductStore } from "@/store/atpProductStore";
import { productStore as useProductStore } from "@/store/productStore";
import { getPrimaryProductIdentifier, getSecondaryProductIdentifier } from "@/utils/productIdentifier";

// Cap how many tag/feature chips a row shows before collapsing the rest into a "+N more" note.
const ROW_META_CAP = 3;

// Solr multi-valued fields come back as arrays, single values as scalars; normalize to a clean array.
function toArray(value: any): string[] {
  if (Array.isArray(value)) return value.filter((entry) => entry != null && entry !== "").map(String);
  if (value == null || value === "") return [];
  return [String(value)];
}

function visibleItems(value: any): string[] {
  return toArray(value).slice(0, ROW_META_CAP);
}

function extraCount(value: any): number {
  return Math.max(toArray(value).length - ROW_META_CAP, 0);
}

const props = defineProps<{
  selectedSegment?: string;
  selectedFacilityGroups?: {
    included: any[];
    excluded: any[];
  };
  selectedConfigFacilities?: string[];
  areAllSelected?: boolean;
  isPickupAllowed?: boolean;
}>();

const productStore = useAtpProductStore();
const productIdentifierStore = useProductStore();

const pageSize = 25;
const products = ref<any[]>([]);
const total = ref(0);
const pageIndex = ref(0);
const isLoading = ref(false);
const searchQuery = ref("");

const configFacilities = computed(() => productStore.getConfigFacilities);
const facilities = computed(() => productStore.getFacilities);
const appliedFilters = computed(() => productStore.getAppliedFilters);
const appliedFiltersOperator = computed(() => productStore.getAppliedFiltersOperator);
const pageCount = computed(() => Math.max(Math.ceil(total.value / pageSize), 1));
const productIdentificationPref = computed(() => productIdentifierStore.getProductIdentificationPref);

const availableFacilities = ref<any[]>([]);
const selectedFacilityId = ref("");
const inventoryConfigs = ref<Record<string, any>>({});
const isInventoryLoading = ref(false);

function dedupe(list: any[]) {
  const seen = new Map<string, any>();
  list.forEach((facility: any) => {
    if (facility?.facilityId && !seen.has(facility.facilityId)) seen.set(facility.facilityId, facility);
  });
  return Array.from(seen.values()).sort((a, b) => (a.facilityName || a.facilityId).localeCompare(b.facilityName || b.facilityId));
}

function getAllowPickupTransition(product: any) {
  const config = inventoryConfigs.value[product.productId];
  const oldVal = config?.allowPickup || "-";
  const newVal = props.isPickupAllowed ? "Y" : "N";
  const isChanged = oldVal !== newVal;
  return {
    oldVal,
    newVal,
    isChanged
  };
}

function getHittingTags(product: any): string[] {
  const productTags = toArray(product.tags);
  const filterTags = toArray(appliedFilters.value?.included?.tags);
  if (!filterTags.length) return [];
  return productTags.filter(tag => filterTags.includes(tag));
}

function getHittingFeatures(product: any): string[] {
  const productFeatures = toArray(product.productFeatures);
  const filterFeatures = toArray(appliedFilters.value?.included?.productFeatures);
  if (!filterFeatures.length) return [];
  return productFeatures.filter(feature => filterFeatures.includes(feature));
}

let watchId = 0;
watch(
  [
    () => props.selectedSegment,
    () => props.selectedFacilityGroups,
    () => props.selectedConfigFacilities,
    () => props.areAllSelected,
    facilities,
    configFacilities
  ],
  async () => {
    const currentId = ++watchId;
    if (props.areAllSelected) {
      if (props.selectedSegment === 'RG_PICKUP_FACILITY') {
        availableFacilities.value = dedupe(facilities.value);
      } else if (props.selectedSegment === 'RG_PICKUP_CHANNEL') {
        availableFacilities.value = dedupe(configFacilities.value);
      } else {
        availableFacilities.value = [];
      }
    } else {
      if (props.selectedSegment === 'RG_PICKUP_FACILITY') {
        const included = props.selectedFacilityGroups?.included || [];
        const excluded = props.selectedFacilityGroups?.excluded || [];

        const includedResults = await Promise.all(
          included.map((group: any) => productStore.fetchFacilitiesForGroup(group.facilityGroupId))
        );
        if (currentId !== watchId) return;
        const resolvedIncluded = dedupe(includedResults.flat());

        const excludedResults = await Promise.all(
          excluded.map((group: any) => productStore.fetchFacilitiesForGroup(group.facilityGroupId))
        );
        if (currentId !== watchId) return;
        const excludedIds = new Set(excludedResults.flat().map((f: any) => f.facilityId));

        availableFacilities.value = resolvedIncluded.filter((f: any) => !excludedIds.has(f.facilityId));
      } else if (props.selectedSegment === 'RG_PICKUP_CHANNEL') {
        const selectedIds = props.selectedConfigFacilities || [];
        availableFacilities.value = dedupe(
          configFacilities.value.filter((f: any) => selectedIds.includes(f.facilityId))
        );
      } else {
        availableFacilities.value = [];
      }
    }

    if (selectedFacilityId.value && !availableFacilities.value.some((f: any) => f.facilityId === selectedFacilityId.value)) {
      selectedFacilityId.value = "";
    }
  },
  { deep: true, immediate: true }
);

let inventoryFetchId = 0;
async function fetchInventoryConfigs() {
  if (!selectedFacilityId.value || !products.value.length) {
    inventoryConfigs.value = {};
    return;
  }

  const currentId = ++inventoryFetchId;
  isInventoryLoading.value = true;
  const configs: Record<string, any> = {};
  // Resolve in small concurrent batches so a full page (up to pageSize products)
  // doesn't fire that many requests at once.
  const batchSize = 5;
  for (let i = 0; i < products.value.length; i += batchSize) {
    const batch = products.value.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (product) => {
        try {
          const resp = await api({
            url: "oms/productFacilities/search",
            method: "GET",
            params: {
              keyword: product.productId,
              facilityId: selectedFacilityId.value
            }
          }) as any;
          if (resp.data?.products?.length) {
            configs[product.productId] = resp.data.products[0].inventoryConfig || resp.data.products[0];
          }
        } catch (err) {
          console.error("Failed to fetch config for product", product.productId, err);
        }
      })
    );
    // A newer fetch started while we were awaiting — drop this stale run.
    if (currentId !== inventoryFetchId) return;
  }
  inventoryConfigs.value = configs;
  isInventoryLoading.value = false;
}

watch([selectedFacilityId, products], () => {
  fetchInventoryConfigs();
});

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => loadPreview());

// Refresh whenever the rule's product filters change. Debounced so rapid edits collapse into one query.
watch([appliedFilters, appliedFiltersOperator], () => {
  pageIndex.value = 0;
  scheduleReload();
}, { deep: true });

function scheduleReload() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadPreview(), 350);
}

async function loadPreview() {
  isLoading.value = true;
  const result = await productStore.previewProducts({
    viewSize: pageSize,
    viewIndex: pageIndex.value,
    keyword: searchQuery.value.trim() || undefined
  });
  products.value = result.products;
  total.value = result.total;
  isLoading.value = false;
}

function updateSearchQuery(event: CustomEvent<{ value?: string | null }>) {
  searchQuery.value = event.detail.value || "";
  pageIndex.value = 0;
  loadPreview();
}

function goToPreviousPage() {
  if (pageIndex.value === 0) return;
  pageIndex.value -= 1;
  loadPreview();
}

function goToNextPage() {
  if (pageIndex.value >= pageCount.value - 1) return;
  pageIndex.value += 1;
  loadPreview();
}

</script>

<style scoped>



.preview-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacer-sm);
  padding: var(--spacer-xs) var(--spacer-sm);
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.products-count {
  flex: 1;
}

.facility-select {
  display: flex;
  align-items: center;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.preview-body {
  max-height: 60vh;
  overflow-y: auto;
}

.list-item {
  border-bottom: 1px solid var(--ion-color-light-shade);
  align-items: center;
  --columns-mobile: 1;
  --columns-tablet: 4;
  --columns-desktop: 7;
}

.list-item.has-facility {
  --columns-tablet: 9;
  --columns-desktop: 12;
}

@media (min-width: 700px) {
  .list-item > ion-item:first-child {
    grid-column: span 2;
  }
}

@media (min-width: 991px) {
  .list-item > ion-item:first-child {
    grid-column: span 3;
  }
  .product-tags,
  .product-features {
    grid-column: span 2;
  }
}

.list-item:last-child {
  border-bottom: none;
}

/* Spinner container needs to span across all inventory columns */
.list-item > div:has(ion-spinner) {
  display: flex;
  justify-content: center;
}

@media (min-width: 700px) {
  .list-item.has-facility > div:has(ion-spinner) {
    grid-column: 5 / -1;
  }
}

@media (min-width: 991px) {
  .list-item.has-facility > div:has(ion-spinner) {
    grid-column: 8 / -1;
  }
}

/* Tags and Features styling in separate columns */
.product-tags,
.product-features {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--spacer-xs) 0;
}

.product-tags > div,
.product-features > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.product-tags ion-icon,
.product-features ion-icon {
  font-size: 15px;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.product-tags ion-chip,
.product-features ion-chip {
  margin: 0;
}

.product-tags ion-note,
.product-features ion-note {
  font-size: 11px;
}



.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacer-xs);
  padding: var(--spacer-2xl) var(--spacer-base);
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  font-size: 32px;
}


</style>
