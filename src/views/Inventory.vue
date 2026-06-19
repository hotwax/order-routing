<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title data-testid="closed-page-title">{{ translate("Inventory")}}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content data-testid="closed-content">      
      <ion-list data-testid="closed-list">
        <div class="filters">
          <ion-searchbar :placeholder="translate('Search')" :value="searchQuery" :debounce="300" @ionInput="updateSearchQuery($event)" data-testid="inventory-search-bar"/>
          <ion-item>
            <ion-select v-model="selectedFacility" :label="translate('Facility')" interface="popover">
              <ion-select-option v-for="facility in productStoreFacilities" :key="facility.facilityId + facility.productStoreId" :value="facility.facilityId">{{ facility.facilityName }}</ion-select-option>
            </ion-select>
          </ion-item>
        </div>
        <div class="pagination">
          <ion-button fill="clear" slot="icon-only" :disabled="pageIndex === 0 || isLoading" @click="goToPreviousPage">
            <ion-icon :icon="caretBackOutline" />
          </ion-button>
          <ion-note color="medium">{{ pageIndex + 1 }} / {{ pageCount }}</ion-note>
          <ion-button fill="clear" slot="icon-only" :disabled="pageIndex >= pageCount - 1 || isLoading" @click="goToNextPage">
            <ion-icon :icon="caretForwardOutline" />
          </ion-button>
        </div>
        <p v-if="!products?.length" class="empty-state" data-testid="closed-empty-state">
          {{ translate("No products found") }}
        </p>
        <template v-else>
          <ion-item lines="none">
            <ion-checkbox :checked="allSelected" :indeterminate="!allSelected && isAnyProductSelected" label-placement="end" @ionChange="selectAllProducts($event.detail.checked)">{{ "Select all" }}</ion-checkbox>
          </ion-item>
          <div class="list-item" v-for="product in products" :key="product.productId" @click="viewInventoryDetail(product.productId)">
            <ion-item>
              <ion-checkbox :checked="product.isChecked" slot="start" @click.stop @ionChange="product.isChecked = $event.detail.checked"></ion-checkbox>
              <ion-thumbnail data-testid="assigned-detail-product-thumbnail">
                <DxpShopifyImg :src="productById(product.productId).mainImageUrl" data-testid="assigned-detail-product-img"/>
              </ion-thumbnail>
              <ion-label>
                <h2 data-testid="assigned-detail-product-primary-id">{{ product.parentProductName }}</h2>
                <p data-testid="assigned-detail-product-secondary-id">{{ product.productId }}</p>
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
                {{ "Add Config" }}
              </ion-button>
            </template>
          </div>
        </template>
      </ion-list>
    </ion-content>
    <ion-footer v-if="isAnyProductSelected">
      <ion-toolbar class="footer-actions">
        <ion-buttons>
          <ion-button @click="openBulkInventoryEditModal">{{ "Adjust Inventory" }}</ion-button>
          <ion-button @click="openProductFacilityConfigModal()">{{ "Adjust Config" }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import router from '../router';
import { IonButtons, IonButton, IonCheckbox, IonFooter, IonIcon, IonNote, IonPage, IonHeader, IonLabel, IonTitle, IonToolbar, IonContent, IonList, IonItem, IonSearchbar, IonSelect, IonSelectOption, IonThumbnail, onIonViewDidEnter, onIonViewDidLeave, modalController } from '@ionic/vue';
import { DxpShopifyImg, emitter, translate } from '@common';
import { productStore } from '@/store/productStore';
import { productStore as productInfoStore } from '@/store/product';
import { useAtpProductStore } from '@/store/atpProductStore';
import { caretBackOutline, caretForwardOutline } from 'ionicons/icons';
import { useProductFacility } from '@/composables/useProductFacility';
import ProductInventoryEdit from '@/components/ProductInventoryEdit.vue';
import ProductFacilityConfigEditModal from '@/components/ProductFacilityConfigEditModal.vue';

const PAGE_SIZE = 50;
const pageIndex = ref(0);
const total = ref(0);
const isLoading = ref(false);

const { productFacility: products } = useProductFacility();

const searchQuery = ref("");
const selectedFacility = ref("");

const productStoreFacilities = computed(() => productStore().productStoreFacilities)
const productById = computed(() => (productId: string) => productInfoStore().getProductById(productId))
const pageCount = computed(() => Math.max(Math.ceil(total.value / PAGE_SIZE), 1));

const isAnyProductSelected = computed(() => products.value.some((product: any) => product.isChecked))
const allSelected = computed(() => products.value.every((product: any) => product.isChecked))

async function onProductStoreOrConfigChanged() {
  const productStoreId = useAtpProductStore().currentProductStore?.productStoreId;
  if (productStoreId) {
    productStore().$patch({
      currentEComStore: { productStoreId }
    });
  }
  pageIndex.value = 0;
  await productStore().fetchProductStoreFacilities();
  
  const facilityId = productStoreFacilities.value?.some((f: any) => f.facilityId === productStore().selectedInventoryFacilityId)
    ? productStore().selectedInventoryFacilityId
    : productStoreFacilities.value?.[0]?.facilityId;

  if (selectedFacility.value === facilityId) {
    await fetchProductFacility();
  } else {
    selectedFacility.value = facilityId || '';
  }
}

onIonViewDidEnter(async () => {
  await onProductStoreOrConfigChanged();
  emitter.on("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
})

onIonViewDidLeave(() => {
  emitter.off("productStoreOrConfigChanged", onProductStoreOrConfigChanged);
})

watch(selectedFacility, (facilityId) => {
  productStore().setSelectedInventoryFacilityId(facilityId)
  fetchProductFacility()
})

function selectAllProducts(checked: boolean) {
  products.value.map((product: any) => product.isChecked = checked)
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

  total.value = await useProductFacility().fetchProductFacility(params);
  isLoading.value = false
}

async function updateSearchQuery(event: CustomEvent<{ value?: string | null }>) {
  searchQuery.value = event.detail.value || ''
  pageIndex.value = 0
  await fetchProductFacility()
}

async function goToPreviousPage() {
  if (pageIndex.value === 0) return

  pageIndex.value -= 1
  await fetchProductFacility()
}

async function goToNextPage() {
  if (pageIndex.value >= pageCount.value - 1) return

  pageIndex.value += 1
  await fetchProductFacility()
}

function viewInventoryDetail(productId: string) {
  router.push(`/inventory/${productId}`)
}

async function openBulkInventoryEditModal() {
  const bulkInventoryEditModal = await modalController.create({
    component: ProductInventoryEdit,
    componentProps: {
      selectedFacility: selectedFacility.value,
      selectedProducts: products.value.filter((product: any) => product.isChecked)
    }
  })

  bulkInventoryEditModal.onDidDismiss().then((data) => {
    data?.data?.updated && fetchProductFacility();
  })

  await bulkInventoryEditModal.present()
}

async function openProductFacilityConfigModal(selectedProducts?: any[]) {
  const productFacilityConfigEditModal = await modalController.create({
    component: ProductFacilityConfigEditModal,
    componentProps: {
      selectedFacility: selectedFacility.value,
      selectedProducts: selectedProducts ? selectedProducts : products.value.filter((product: any) => product.isChecked)
    }
  })

  productFacilityConfigEditModal.onDidDismiss().then((data) => {
    data?.data?.updated && fetchProductFacility();
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
}

.list-item > ion-item {
  width: 100%;
}

.filters {
  display: flex;
}

.filters > * {
  flex: 1;
}

.filters ion-button {
  flex: unset;
  margin-inline-start: var(--spacer-sm);
}

.pagination {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
}

ion-toolbar::part(content) {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
</style>
