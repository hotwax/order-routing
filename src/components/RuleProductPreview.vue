<template>
  <ion-card class="preview-card">
    <ion-card-header>
      <div class="preview-head">
        <div>
          <ion-card-title>{{ translate("Matched products") }}</ion-card-title>
          <ion-card-subtitle>{{ translate("Products this rule will apply to") }}</ion-card-subtitle>
        </div>
        <ion-note v-if="!isLoading">{{ translate("products found", { count: total }) }}</ion-note>
      </div>
    </ion-card-header>

    <div class="preview-toolbar">
      <ion-searchbar :placeholder="translate('Search')" :value="searchQuery" :debounce="400" @ionInput="updateSearchQuery($event)" />
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

    <MatchedProductFilters />

    <div class="facility-select-container" v-if="availableFacilities.length">
      <ion-item lines="none">
        <ion-select v-model="selectedFacilityId" :label="translate('Preview facility')" interface="popover" placeholder="Select Facility">
          <ion-select-option v-for="facility in availableFacilities" :key="facility.facilityId" :value="facility.facilityId">
            {{ facility.facilityName || facility.facilityId }}
          </ion-select-option>
        </ion-select>
      </ion-item>
    </div>

    <ion-card-content class="preview-body">
      <div class="empty-state" v-if="isLoading">
        <ion-spinner name="crescent" />
      </div>
      <template v-else-if="products.length">
        <div class="list-item" v-for="product in products" :key="product.productId" :style="{ '--columns-desktop': selectedFacilityId ? 6 : 1 }">
          <div class="product-cell">
            <ion-item lines="none">
              <ion-thumbnail slot="start">
                <DxpShopifyImg :src="product.mainImageUrl" />
              </ion-thumbnail>
              <ion-label>
                {{ product.parentProductName || product.productName || product.productId }}
                <p>{{ product.productId }}</p>
              </ion-label>
            </ion-item>
            <!-- Why each product matched: its Solr tags and product features (capped, scan-friendly) -->
            <div class="row-meta" v-if="toArray(product.tags).length || toArray(product.productFeatures).length">
              <div class="meta-line" v-if="toArray(product.tags).length">
                <ion-icon class="meta-icon" :icon="pricetagOutline" :aria-label="translate('Tags')" />
                <ion-chip class="meta-chip" v-for="tag in visibleItems(product.tags)" :key="tag">{{ tag }}</ion-chip>
                <ion-note class="meta-more" v-if="extraCount(product.tags)">{{ translate("+ {count} more", { count: extraCount(product.tags) }) }}</ion-note>
              </div>
              <div class="meta-line" v-if="toArray(product.productFeatures).length">
                <ion-icon class="meta-icon" :icon="optionsOutline" :aria-label="translate('Features')" />
                <ion-chip class="meta-chip" v-for="feature in visibleItems(product.productFeatures)" :key="feature">{{ feature }}</ion-chip>
                <ion-note class="meta-more" v-if="extraCount(product.productFeatures)">{{ translate("+ {count} more", { count: extraCount(product.productFeatures) }) }}</ion-note>
              </div>
            </div>
          </div>
          <template v-if="selectedFacilityId">
            <div v-if="isInventoryLoading" style="grid-column: span 5; display: flex; justify-content: center;">
              <ion-spinner name="crescent" size="small" />
            </div>
            <template v-else-if="inventoryConfigs[product.productId]">
              <div>
                <ion-label>
                  {{ inventoryConfigs[product.productId].computedLastInventoryCount }}
                  <p>{{ translate("ATP") }}</p>
                </ion-label>
              </div>
              <div>
                <ion-label>
                  {{ inventoryConfigs[product.productId].lastInventoryCount }}
                  <p>{{ translate("QOH") }}</p>
                </ion-label>
              </div>
              <div>
                <ion-label>
                  {{ inventoryConfigs[product.productId].minimumStock || "-" }}
                  <p>{{ translate("Minimum Stock") }}</p>
                </ion-label>
              </div>
              <div>
                <ion-label>
                  {{ inventoryConfigs[product.productId].allowPickup || "-" }}
                  <p>{{ translate("Allow Pickup") }}</p>
                </ion-label>
              </div>
              <div>
                <ion-label>
                  {{ inventoryConfigs[product.productId].allowBrokering || "-" }}
                  <p>{{ translate("Allow Brokering") }}</p>
                </ion-label>
              </div>
            </template>
            <template v-else>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
            </template>
          </template>
        </div>
      </template>
      <div class="empty-state" v-else>
        <ion-icon :icon="cubeOutline" />
        <p>{{ translate("No products match these filters yet.") }}</p>
      </div>
    </ion-card-content>
  </ion-card>
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
  IonThumbnail
} from "@ionic/vue";
import { caretBackOutline, caretForwardOutline, cubeOutline, optionsOutline, pricetagOutline } from 'ionicons/icons';
import { DxpShopifyImg, translate, api } from '@common';
import MatchedProductFilters from "@/components/MatchedProductFilters.vue";
import { useAtpProductStore } from "@/store/atpProductStore";

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
}>();

const productStore = useAtpProductStore();

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
.preview-card {
  margin: 0;
}

.preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacer-xs);
}

.preview-head ion-note {
  flex-shrink: 0;
  white-space: nowrap;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
  padding-inline: var(--spacer-sm);
}

.preview-toolbar ion-searchbar {
  flex: 1;
  padding: 0;
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
}

.list-item:last-child {
  border-bottom: none;
}

.list-item ion-thumbnail {
  --size: 40px;
  --border-radius: 6px;
}

.product-cell {
  min-width: 0;
}

.product-cell > ion-item {
  width: 100%;
}

.row-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* Indent to line up under the product name (past the 40px thumbnail + item padding) */
  padding: 0 var(--spacer-sm) var(--spacer-xs) 56px;
}

.meta-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.meta-icon {
  font-size: 15px;
  color: var(--ion-color-medium);
  flex-shrink: 0;
}

.meta-chip {
  height: 22px;
  font-size: 11px;
  margin: 0;
}

.meta-more {
  font-size: 11px;
}

.facility-select-container {
  padding-inline: var(--spacer-sm);
  margin-bottom: var(--spacer-xs);
}

.facility-select-container ion-item {
  --background: var(--ion-color-light);
  border-radius: 8px;
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
