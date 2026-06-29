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
              <ion-skeleton-text animated style="width: 50%; height: 22px;" />
              <ion-skeleton-text animated style="width: 35%; height: 14px; margin-top: 6px;" />
            </template>
            <template v-else>
              <h1>{{ primaryIdentifier }}</h1>
              <p v-if="secondaryIdentifier">{{ secondaryIdentifier }}</p>
              <p class="product-name" v-if="productName">{{ productName }}</p>
            </template>
          </div>
          <ion-item class="facility-select" lines="none">
            <ion-select :label="translate('Facility')" label-placement="stacked" v-model="selectedFacilityId" interface="popover">
              <ion-select-option v-for="facility in productStoreFacilities" :key="facility.facilityId + facility.productStoreId" :value="facility.facilityId">{{ facility.facilityName }}</ion-select-option>
            </ion-select>
          </ion-item>
        </section>

        <!-- Operational summary scoped to the selected facility: Inventory (primary) + Configuration (supporting) -->
        <section class="summary-cards">
          <ion-card class="ion-no-margin">
            <div class="card-header">
              <ion-card-header>
                <ion-card-title>{{ translate("Inventory") }}</ion-card-title>
              </ion-card-header>
              <ion-button slot="end" fill="clear" @click="openInventoryEditModal">
                {{ translate("Adjust") }}
              </ion-button>
            </div>
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
            <div class="card-header">
              <ion-card-header>
                <ion-card-title>{{ translate("Configuration") }}</ion-card-title>
              </ion-card-header>
              <ion-button fill="clear" @click="openConfigEditModal">
                {{ translate("Edit") }}
              </ion-button>
            </div>
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

        <!-- Inventory history: each row reads as a movement (Log / Facility / Comment / ATP / QOH) -->
        <section class="history-section">
          <ion-list-header>
            <ion-label>{{ translate("Inventory history") }}</ion-label>
          </ion-list-header>

          <div class="history-list" v-if="inventoryLogs.length">
            <div class="history-row" v-for="(log, index) in inventoryLogs" :key="`${log.inventoryItemId}-${index}`">
              <div class="history-cell">
                <p class="cell-label">{{ translate("Log") }}</p>
                <p class="cell-primary">{{ log.inventoryItemId }}</p>
                <p class="cell-secondary">{{ formatDateTime(log.effectiveDate) }}</p>
              </div>
              <div class="history-cell">
                <p class="cell-label">{{ translate("Facility") }}</p>
                <p class="cell-primary">{{ facilityName(log.facilityId) }}</p>
                <p class="cell-secondary" v-if="log.locationSeqId">{{ log.locationSeqId }}</p>
              </div>
              <div class="history-cell comment">
                <p class="cell-label">{{ translate("Comment") }}</p>
                <p>{{ log.description || "-" }}</p>
              </div>
              <div class="history-cell">
                <p class="cell-label">{{ translate("ATP") }}</p>
                <p class="movement">
                  <span :class="diffClass(log.availableToPromiseDiff)">{{ signed(log.availableToPromiseDiff) }}</span>
                  <ion-icon :icon="arrowForwardOutline" />
                  <span>{{ runningTotal(log.lastAvailableToPromise, log.availableToPromiseDiff) }}</span>
                </p>
              </div>
              <div class="history-cell">
                <p class="cell-label">{{ translate("QOH") }}</p>
                <p class="movement">
                  <span :class="diffClass(log.quantityOnHandDiff)">{{ signed(log.quantityOnHandDiff) }}</span>
                  <ion-icon :icon="arrowForwardOutline" />
                  <span>{{ runningTotal(log.lastQuantityOnHand, log.quantityOnHandDiff) }}</span>
                </p>
              </div>
            </div>
          </div>

          <p v-else class="empty-state">
            {{ translate("No inventory logs found") }}
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
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonListHeader,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  modalController,
  onIonViewDidEnter
} from '@ionic/vue';
import { arrowForwardOutline, cubeOutline } from 'ionicons/icons';
import { commonUtil, translate } from '@common';
import { DateTime } from 'luxon';
import { useProductFacility } from '@/composables/useProductFacility';
import { productStore } from '@/store/productStore';
import { productStore as productInfoStore } from '@/store/product';
import ProductFacilityConfigEditModal from '@/components/ProductFacilityConfigEditModal.vue';
import ProductInventoryEdit from '@/components/ProductInventoryEdit.vue';

function formatDateTime(value: any): string {
  if (!value) return '-';
  const dt = typeof value === 'number'
    ? DateTime.fromMillis(value)
    : DateTime.fromISO(String(value));
  return dt.isValid ? dt.toLocaleString({ ...DateTime.DATETIME_MED, hourCycle: 'h12' }) : String(value);
}

const route = router.currentRoute.value;
const isLoading = ref(false);

const productId = computed(() => String(route.params.productId || ''));
const product = computed(() => productInfoStore().getProductById(productId.value))
const selectedFacilityId = ref("");
const productStoreFacilities = computed(() => productStore().productStoreFacilities)
const productIdentificationPref = computed(() => productStore().getProductIdentificationPref)

const { inventoryLogs } = useProductFacility();
const inventoryConfig = ref<any>({});

// Header identity uses the configured product identifier preference, falling back to the product id.
const primaryIdentifier = computed(() =>
  commonUtil.getProductIdentificationValue(productIdentificationPref.value?.primaryId, product.value) || product.value?.productId || ''
);

const secondaryIdentifier = computed(() =>
  commonUtil.getProductIdentificationValue(productIdentificationPref.value?.secondaryId, product.value) || ''
);

const productName = computed(() =>
  product.value?.internalName || product.value?.productName || product.value?.parentProductName || ''
);

function facilityName(facilityId: string) {
  const facility = productStoreFacilities.value.find((f: any) => f.facilityId === facilityId)
  return facility?.facilityName || facilityId || '-'
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
  await fetchInventoryConfig();
  await fetchInventoryLogs();
});

watch(selectedFacilityId, async () => {
  await fetchInventoryConfig();
  await fetchInventoryLogs();
});

async function fetchInventoryConfig() {
  const { fetchProductFacility, productFacility } = useProductFacility();
  await fetchProductFacility({
    keyword: productId.value,
    facilityId: selectedFacilityId.value
  });
  inventoryConfig.value = productFacility.value?.[0] ?? null;
}

async function fetchInventoryLogs() {
  await useProductFacility().fetchInventoryLogs({
    productId: productId.value,
    facilityId: selectedFacilityId.value,
    pageSize: 250
  });
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
  font-size: 32px;
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

.product-identity h1 {
  margin: 0;
  font-size: 20px;
  line-height: 1.25;
}

.product-identity p {
  margin: 2px 0 0;
  color: var(--ion-color-medium);
  font-size: 14px;
}

.product-identity .product-name {
  color: var(--ion-color-dark);
}

.facility-select {
  flex: 0 0 auto;
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
}

.history-list {
  border: 1px solid var(--ion-color-step-150, #d7d8da);
  border-radius: 8px;
  overflow: hidden;
}

.history-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-sm, 8px) var(--spacer-base, 16px);
  padding: var(--spacer-sm, 8px) var(--spacer-base, 16px);
  border-bottom: 1px solid var(--ion-color-step-100, #e0e0e0);
}

.history-row:last-child {
  border-bottom: none;
}

.history-cell {
  flex: 1 1 120px;
  min-width: 0;
}

.history-cell.comment {
  flex: 2 1 200px;
}

.cell-label {
  margin: 0 0 2px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ion-color-medium);
}

.history-cell p {
  margin: 0;
}

.cell-primary {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.cell-secondary {
  color: var(--ion-color-medium);
  font-size: 13px;
}

.movement {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.movement ion-icon {
  font-size: 14px;
  color: var(--ion-color-medium);
}

.diff-positive {
  color: var(--ion-color-success, #2dd36f);
  font-weight: 600;
}

.diff-negative {
  color: var(--ion-color-danger, #eb445a);
  font-weight: 600;
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
    font-size: 24px;
  }

  .facility-select {
    width: 100%;
  }
}
</style>
