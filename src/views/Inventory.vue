<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title data-testid="closed-page-title">{{ translate("Inventory")}}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content data-testid="closed-content">
      <ion-list data-testid="closed-list">
        <ion-card>
          <ion-card-content class="filter-card-content">
            <ion-searchbar :placeholder="translate('Search')" :value="searchQuery" :debounce="300" @ionInput="updateSearchQuery($event)" data-testid="inventory-search-bar"/>
            <div class="filter-controls">
              <ion-item lines="none">
                <ion-select v-model="selectedFacility" :label="translate('Facility')" interface="popover">
                  <ion-select-option v-for="facility in productStoreFacilities" :key="facility.facilityId + facility.productStoreId" :value="facility.facilityId">{{ facility.facilityName }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="none">
              <ion-select v-model="allowPickupFilter" :label="translate('Allow Pickup')" interface="popover" @ionChange="applyServerFilters">
                  <ion-select-option value="all">{{ translate("All") }}</ion-select-option>
                  <ion-select-option value="Y">{{ "Y" }}</ion-select-option>
                  <ion-select-option value="N">{{ "N" }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="none">
              <ion-select v-model="allowBrokeringFilter" :label="translate('Allow Brokering')" interface="popover" @ionChange="applyServerFilters">
                  <ion-select-option value="all">{{ translate("All") }}</ion-select-option>
                  <ion-select-option value="Y">{{ "Y" }}</ion-select-option>
                  <ion-select-option value="N">{{ "N" }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item lines="none" class="safety-stock-filter">
                <ion-select v-model="safetyStockOperator" :label="translate('Safety stock')" aria-label="Safety stock comparison" interface="popover" @ionChange="applyServerFilters">
                  <ion-select-option value="all">{{ translate("All") }}</ion-select-option>
                  <ion-select-option value="lessThan">Less than</ion-select-option>
                  <ion-select-option value="equals">Equals</ion-select-option>
                  <ion-select-option value="greaterThan">Greater than</ion-select-option>
                </ion-select>
                <ion-note v-if="safetyStockOperator !== 'all'">Qty</ion-note>
                <ion-input v-if="safetyStockOperator !== 'all'" v-model="safetyStockValue" type="number" min="0" inputmode="numeric" :debounce="300" aria-label="Safety stock quantity" @ionInput="applyServerFilters" />
              </ion-item>
              <ion-item lines="none">
              <ion-select v-model="sortBy" :label="translate('Sort')" interface="popover" @ionChange="applyServerFilters">
                  <ion-select-option value="default">Default</ion-select-option>
                  <ion-select-option value="productAsc">Product A-Z</ion-select-option>
                  <ion-select-option value="productDesc">Product Z-A</ion-select-option>
                  <ion-select-option value="atpAsc">ATP low to high</ion-select-option>
                  <ion-select-option value="atpDesc">ATP high to low</ion-select-option>
                  <ion-select-option value="qohAsc">QOH low to high</ion-select-option>
                  <ion-select-option value="qohDesc">QOH high to low</ion-select-option>
                  <ion-select-option value="safetyStockAsc">Safety stock low to high</ion-select-option>
                  <ion-select-option value="safetyStockDesc">Safety stock high to low</ion-select-option>
                </ion-select>
              </ion-item>
            </div>

        <ion-item lines="none">
          <ion-checkbox slot="start" v-if="selectMode" :checked="allCurrentPageSelected" :indeterminate="someCurrentPageSelected && !allCurrentPageSelected" @ionChange="toggleCurrentPageSelection($event.detail.checked)"></ion-checkbox>
          <ion-label>{{ translate("products found", { count: total }) }}</ion-label>
          <div slot="end" class="pagination">
            <ion-button fill="clear" slot="icon-only" :disabled="pageIndex === 0 || isLoading" @click="goToPreviousPage">
              <ion-icon :icon="caretBackOutline" />
            </ion-button>
            <ion-note color="medium">{{ pageIndex + 1 }} / {{ pageCount }}</ion-note>
            <ion-button fill="clear" slot="icon-only" :disabled="pageIndex >= pageCount - 1 || isLoading" @click="goToNextPage">
              <ion-icon :icon="caretForwardOutline" />
            </ion-button>
            <ion-button v-if="products.length" fill="clear" size="small" @click="toggleSelectMode">
              {{ selectMode ? translate("Done") : translate("Select") }}
            </ion-button>
          </div>
        </ion-item>
        <p v-if="!products.length" class="empty-state" data-testid="closed-empty-state">
          {{ translate("No products found") }}
        </p>
        <template v-else>
          <div class="list-item" v-for="product in products" :key="product.productId" @click="onRowClick(product.productId)">
            <ion-item lines="none">
              <ion-checkbox v-if="selectMode" :checked="isSelected(product.productId)" slot="start" @click.stop="toggleProductSelection(product.productId)"></ion-checkbox>
              <ion-thumbnail slot="start" data-testid="assigned-detail-product-thumbnail">
                <DxpShopifyImg :src="productById(product.productId).mainImageUrl" data-testid="assigned-detail-product-img"/>
              </ion-thumbnail>
              <ion-label>
                <h2 data-testid="assigned-detail-product-primary-id">{{ getPrimaryProductIdentifier(product) }}</h2>
                <p data-testid="assigned-detail-product-secondary-id">{{ getSecondaryProductIdentifier(product) }}</p>
              </ion-label>
            </ion-item>
            <template v-if="product.inventoryConfig">
              <div>
                <ion-label>
                  {{ product.inventoryConfig.atp }}
                  <p>{{ translate("ATP") }}</p>
                </ion-label>
              </div>
              <div>
                <ion-label>
                  {{ product.inventoryConfig.qoh }}
                  <p>{{ translate("QOH") }}</p>
                </ion-label>
              </div>
              <div>
                <ion-label>
                  {{ product.inventoryConfig.minimumStock || "-" }}
                  <p>{{ translate("Safety Stock") }}</p>
                </ion-label>
              </div>
              <div>
                <ion-label>
                  {{ product.inventoryConfig.allowPickup || "-" }}
                  <p>{{ translate("Allow Pickup") }}</p>
                </ion-label>
              </div>
              <div>
                <ion-label>
                  {{ product.inventoryConfig.allowBrokering || "-" }}
                  <p>{{ translate("Allow Brokering") }}</p>
                </ion-label>
              </div>
            </template>
            <template v-else>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <ion-button fill="clear" size="small" @click.stop="openProductFacilityConfigModal([product])">
                {{ translate("Add Config") }}
              </ion-button>
            </template>
          </div>
        </template>
          </ion-card-content>
        </ion-card>
      </ion-list>
    </ion-content>
    <ion-footer v-if="selectMode">
      <ion-toolbar class="footer-actions">
        <ion-buttons slot="start">
          <ion-button disabled>{{ selectedProductIds.length }} {{ translate("selected") }}</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button :disabled="!selectedProductIds.length" @click="openBulkInventoryEditModal">{{ translate("Adjust inventory") }}</ion-button>
          <ion-button :disabled="!selectedProductIds.length" @click="openProductFacilityConfigModal()">{{ translate("Adjust config") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import router from '../router';
import { IonButtons, IonButton, IonCard, IonCardContent, IonCheckbox, IonFooter, IonIcon, IonInput, IonNote, IonPage, IonHeader, IonLabel, IonTitle, IonToolbar, IonContent, IonList, IonItem, IonSearchbar, IonSelect, IonSelectOption, IonThumbnail, onIonViewDidEnter, onIonViewDidLeave, modalController } from '@ionic/vue';
import { DxpShopifyImg, emitter, translate } from '@common';
import { productStore } from '@/store/productStore';
import { productStore as productInfoStore } from '@/store/product';
import { useAtpProductStore } from '@/store/atpProductStore';
import { caretBackOutline, caretForwardOutline } from 'ionicons/icons';
import { useProductFacility } from '@/composables/useProductFacility';
import ProductInventoryEdit from '@/components/ProductInventoryEdit.vue';
import ProductFacilityConfigEditModal from '@/components/ProductFacilityConfigEditModal.vue';
import { getPrimaryProductIdentifier as getPrimaryIdentifier, getSecondaryProductIdentifier as getSecondaryIdentifier } from '@/utils/productIdentifier';

const PAGE_SIZE = 50;
const pageIndex = ref(0);
const total = ref(0);
const isLoading = ref(false);

const { productFacility: products } = useProductFacility();

const searchQuery = ref("");
const selectedFacility = ref("");
const allowPickupFilter = ref("all");
const allowBrokeringFilter = ref("all");
const safetyStockOperator = ref("all");
const safetyStockValue = ref("");
const sortBy = ref("default");

// Select mode: rows browse by default and only become selectable after the user enters select mode.
// Selection is tracked by stable product id, not by mutating row objects (#448).
const selectMode = ref(false);
const selectedProductIds = ref<string[]>([]);

const productStoreFacilities = computed(() => productStore().productStoreFacilities)
const productById = computed(() => (productId: string) => productInfoStore().getProductById(productId))
const productIdentificationPref = computed(() => productStore().getProductIdentificationPref)
const pageCount = computed(() => Math.max(Math.ceil(total.value / PAGE_SIZE), 1));

const currentPageProductIds = computed(() => products.value.map((product: any) => product.productId))
const allCurrentPageSelected = computed(() => currentPageProductIds.value.length > 0 && currentPageProductIds.value.every((id: string) => selectedProductIds.value.includes(id)))
const someCurrentPageSelected = computed(() => currentPageProductIds.value.some((id: string) => selectedProductIds.value.includes(id)))
const selectedProducts = computed(() => products.value.filter((product: any) => selectedProductIds.value.includes(product.productId)))

async function onProductStoreOrConfigChanged() {
  const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
  if (productStoreId) {
    productStore().setEcomStore({ productStoreId });
  }
  pageIndex.value = 0;
  await productStore().fetchProductStoreFacilities();

  const facilityId = (productStoreFacilities.value?.some((f: any) => f.facilityId === productStore().selectedInventoryFacilityId)
    ? productStore().selectedInventoryFacilityId
    : productStoreFacilities.value?.[0]?.facilityId) || '';

  if (selectedFacility.value === facilityId) {
    await fetchProductFacility();
  } else {
    selectedFacility.value = facilityId;
  }
}

onIonViewDidEnter(async () => {
  await onProductStoreOrConfigChanged();
  emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
  emitter.on("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
})

onIonViewDidLeave(() => {
  emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
})

watch(selectedFacility, (facilityId) => {
  productStore().setSelectedInventoryFacilityId(facilityId)
  selectedProductIds.value = []
  pageIndex.value = 0
  fetchProductFacility()
})

function enterSelectMode() {
  selectMode.value = true
}

function exitSelectMode() {
  selectMode.value = false
  selectedProductIds.value = []
}

function toggleSelectMode() {
  selectMode.value ? exitSelectMode() : enterSelectMode()
}

function isSelected(productId: string) {
  return selectedProductIds.value.includes(productId)
}

function toggleProductSelection(productId: string) {
  if (selectedProductIds.value.includes(productId)) {
    selectedProductIds.value = selectedProductIds.value.filter((id: string) => id !== productId)
  } else {
    selectedProductIds.value = [...selectedProductIds.value, productId]
  }
}

function toggleCurrentPageSelection(checked: boolean) {
  if (checked) {
    const missingIds = currentPageProductIds.value.filter((id: string) => !selectedProductIds.value.includes(id))
    if (!missingIds.length) return;
    selectedProductIds.value = [...selectedProductIds.value, ...missingIds]
  } else {
    if (!currentPageProductIds.value.some((id: string) => selectedProductIds.value.includes(id))) return;
    selectedProductIds.value = selectedProductIds.value.filter((id: string) => !currentPageProductIds.value.includes(id))
  }
}

function onRowClick(productId: string) {
  selectMode.value ? toggleProductSelection(productId) : viewInventoryDetail(productId)
}

function applyServerFilters() {
  pageIndex.value = 0
  selectedProductIds.value = []
  fetchProductFacility()
}

function getOrderByField() {
  if (sortBy.value === "productAsc") return "productId";
  if (sortBy.value === "productDesc") return "-productId";
  if (sortBy.value === "atpAsc") return "atp";
  if (sortBy.value === "atpDesc") return "-atp";
  if (sortBy.value === "qohAsc") return "qoh";
  if (sortBy.value === "qohDesc") return "-qoh";
  if (sortBy.value === "safetyStockAsc") return "minimumStock";
  if (sortBy.value === "safetyStockDesc") return "-minimumStock";
  return "";
}

async function fetchProductFacility() {
  if (!selectedFacility.value) return;

  isLoading.value = true
  const params = {
    pageSize: PAGE_SIZE,
    pageIndex: pageIndex.value
  } as Record<string, string | number>

  if(searchQuery.value.trim()) {
    params["keyword"] = searchQuery.value.trim();
  }

  if(selectedFacility.value) {
    params["facilityId"] = selectedFacility.value;
  }

  if(allowPickupFilter.value !== "all") {
    params["allowPickup"] = allowPickupFilter.value;
  }

  if(allowBrokeringFilter.value !== "all") {
    params["allowBrokering"] = allowBrokeringFilter.value;
  }

  if(safetyStockOperator.value !== "all" && safetyStockValue.value !== "") {
    params["minimumStock"] = safetyStockValue.value;
    params["minimumStock_op"] = safetyStockOperator.value;
  }

  const orderByField = getOrderByField();
  if(orderByField) {
    params["orderByField"] = orderByField;
  }

  total.value = await useProductFacility().fetchProductFacility(params);

  // Hydrate product info (image URLs, names) for the returned product ids so row thumbnails render.
  // productFacilities/search does not return image data, so without this the product info store has
  // no entry and DxpShopifyImg gets an empty src (issue #438). fetchProducts() skips already-cached ids.
  const productIds = [...new Set((products.value || []).map((product: any) => product.productId).filter(Boolean))];
  // Fire-and-forget: don't block the loader on image hydration. productById is reactive, so thumbnails
  // render progressively once the product info store populates; fetchProducts() skips already-cached ids.
  if (productIds.length) {
    productInfoStore().fetchProducts(productIds);
  }

  isLoading.value = false
}

async function updateSearchQuery(event: CustomEvent<{ value?: string | null }>) {
  searchQuery.value = event.detail.value || ''
  pageIndex.value = 0
  selectedProductIds.value = []
  await fetchProductFacility()
}

async function goToPreviousPage() {
  if (pageIndex.value === 0) return

  pageIndex.value -= 1
  selectedProductIds.value = []
  await fetchProductFacility()
}

async function goToNextPage() {
  if (pageIndex.value >= pageCount.value - 1) return

  pageIndex.value += 1
  selectedProductIds.value = []
  await fetchProductFacility()
}

function viewInventoryDetail(productId: string) {
  router.push(`/inventory/${productId}`)
}

function getDisplayProduct(product: any) {
  return { ...product, ...productById.value(product.productId) };
}

function getPrimaryProductIdentifier(product: any) {
  const displayProduct = getDisplayProduct(product);
  return getPrimaryIdentifier(productIdentificationPref.value, displayProduct);
}

function getSecondaryProductIdentifier(product: any) {
  const displayProduct = getDisplayProduct(product);
  return getSecondaryIdentifier(productIdentificationPref.value, displayProduct);
}

async function openBulkInventoryEditModal() {
  if (!selectedProducts.value.length) return;
  const bulkInventoryEditModal = await modalController.create({
    component: ProductInventoryEdit,
    componentProps: {
      selectedFacility: selectedFacility.value,
      selectedProducts: selectedProducts.value
    }
  })

  bulkInventoryEditModal.onDidDismiss().then((data) => {
    if (data?.data?.updated) {
      exitSelectMode();
      fetchProductFacility();
    }
  })

  await bulkInventoryEditModal.present()
}

async function openProductFacilityConfigModal(selectedProductsArg?: any[]) {
  const productsForModal = selectedProductsArg ? selectedProductsArg : selectedProducts.value;
  if (!productsForModal.length) return;
  const productFacilityConfigEditModal = await modalController.create({
    component: ProductFacilityConfigEditModal,
    componentProps: {
      selectedFacility: selectedFacility.value,
      selectedProducts: productsForModal
    }
  })

  productFacilityConfigEditModal.onDidDismiss().then((data) => {
    if (data?.data?.updated) {
      exitSelectMode();
      fetchProductFacility();
    }
  })

  await productFacilityConfigEditModal.present()
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.list-item {
  --columns-desktop: 6;
  border-bottom : 1px solid var(--ion-color-medium);
  align-items: center;
  padding-inline-end: var(--spacer-base, 16px);
}

.list-item > ion-item {
  width: 100%;
}

.filter-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-xs);
}

.filter-card-content ion-searchbar {
  padding: 0;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
}

.filter-controls ion-item {
  flex: 1 1 220px;
  min-width: 0;
}

.filter-controls ion-input {
  max-width: 120px;
}

.filter-controls ion-item.safety-stock-filter {
  flex: 2 1 360px;
}

.safety-stock-filter ion-select {
  min-width: 140px;
}

.safety-stock-filter ion-label {
  flex: 0 0 auto;
  margin-inline-end: var(--spacer-xs);
  white-space: nowrap;
}

.safety-stock-filter ion-input {
  flex: 0 0 88px;
  max-width: 88px;
  margin-inline-start: var(--spacer-xs);
}

.safety-stock-filter ion-note {
  margin-inline-start: var(--spacer-xs);
}

.pagination {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pagination .select-toggle {
  margin-inline-start: auto;
}

ion-toolbar::part(content) {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
</style>
