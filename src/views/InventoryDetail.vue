<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/inventory" />
        </ion-buttons>
        <ion-title>{{ translate("Inventory Detail") }}</ion-title>
        <ion-select slot="end" v-model="selectedFacilityId" aria-label="Facility" placeholder="Select Facility" interface="popover">
          <ion-select-option v-for="facility in productStoreFacilities" :key="facility.facilityId + facility.productStoreId" :value="facility.facilityId">{{ facility.facilityName }}</ion-select-option>
        </ion-select>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="detail-layout">
        <section class="product-panel">
          <ion-item lines="none">
            <div class="product-image" slot="start">
              <img v-if="product.mainImageUrl" :src="product.mainImageUrl" :alt="productName" />
              <ion-skeleton-text v-else-if="isLoading" animated />
            </div>
            <div class="product-title">
              <ion-skeleton-text v-if="isLoading" animated style="width: 40%; height: 10px;" />
              <p v-else>{{ product.productId }}</p>
              <ion-skeleton-text v-if="isLoading" animated style="width: 60%; height: 20px;" />
              <h1 v-else>{{ productName }}</h1>
              <ion-skeleton-text v-if="isLoading" animated style="width: 40%; height: 14px; margin-top: 4px;" />
              <p v-else>{{ productSubtitle }}</p>
            </div>
          </ion-item>

          <ion-card class="ion-no-margin ion-margin-top">
            <div class="card-header">
              <ion-card-header>
                <ion-card-title>{{ translate("Inventory") }}</ion-card-title>
              </ion-card-header>
              <ion-button slot="end" fill="clear" @click="openInventoryEditModal">
                {{ translate("Edit") }}
              </ion-button>
            </div>
            <ion-item>
              <ion-label>{{ translate("QOH") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig.inventoryConfig?.qoh ?? "-" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("ATP") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig.inventoryConfig?.atp ?? "-" }}</ion-label>
            </ion-item>
          </ion-card>
        </section>

        <div class="config-column">
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
              <ion-label slot="end">{{ inventoryConfig.inventoryConfig?.allowBrokering ?? "Y" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Allow Pickup") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig.inventoryConfig?.allowPickup ?? "Y" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Safety stock") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig.inventoryConfig?.minimumStock ?? "-" }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-label>{{ translate("Days to Ship") }}</ion-label>
              <ion-label slot="end">{{ inventoryConfig.inventoryConfig?.daysToShip ?? "-" }}</ion-label>
            </ion-item>
          </ion-card>
        </div>
      </div>
      <div>
        <section class="ion-margin panel logs-panel">
          <div class="list-item">
            <ion-label>
              <p>{{ "Id" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "Date Time Received" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "Facility Id" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "Location Seq Id" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "Comments" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "ATP diff" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "QOH Diff" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "ATP Total" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "QOH Total" }}</p>
            </ion-label>
          </div>

          <div class="list-item" v-for="log in inventoryLogs" :key="log.inventoryItemId">
            <ion-label>
              <p>{{ log.inventoryItemId }}</p>
            </ion-label>
            <ion-label>
              <p>{{ formatDateTime(log.effectiveDate) }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.facilityId }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.locationSeqId }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.description || "-" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.availableToPromiseDiff }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.quantityOnHandDiff }}</p>
            </ion-label>
            <ion-label>
              <p>{{ (log.lastAvailableToPromise || 0) + log.availableToPromiseDiff }}</p>
            </ion-label>
            <ion-label>
              <p>{{ (log.lastQuantityOnHand || 0) + log.quantityOnHandDiff }}</p>
            </ion-label>
          </div>

          <p v-if="!inventoryLogs.length" class="empty-state">
            {{ "No inventory logs found" }}
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
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  modalController,
  onIonViewDidEnter
} from '@ionic/vue';
import { translate } from '@common';
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

const { inventoryLogs } = useProductFacility();
const inventoryConfig = ref<any>({});

const productName = computed(() =>
  product.value?.internalName || product.value?.productName || product.value?.parentProductName || ''
);

const productSubtitle = computed(() =>
  product.value?.parentProductName || product.value?.productName || product.value?.title || ''
);

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

.detail-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacer-base, 16px);
  padding: var(--spacer-base, 16px);
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  align-items: start;
}

.product-panel,
.config-panel {
  height: fit-content;
}

.config-column {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-base, 16px);
}

.detail-grid {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--spacer-base, 16px);
}

.summary-row ion-col {
  display: flex;
}

.panel {
  border: 1px solid var(--ion-color-step-150, #d7d8da);
  border-radius: 8px;
}

.product-image {
  display: grid;
  place-items: center;
  flex: 0 0 96px;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 8px;
  margin: 8px;
  background: var(--ion-color-step-100, #f4f5f8);
  color: var(--ion-color-medium);
  font-size: 32px;
  font-weight: 700;
}

.product-image :deep(img),
.product-image ion-skeleton-text {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-title {
  min-width: 0;
}

.product-title h1,
.section-title h2 {
  margin: 4px 0;
  font-size: 20px;
  line-height: 1.25;
}

.product-title p {
  margin: 0;
  color: var(--ion-color-medium);
}

.section-title {
  padding: var(--spacer-base, 16px);
  border-bottom: 1px solid var(--ion-color-step-150, #d7d8da);
}

ion-item {
  --min-height: 58px;
}

ion-note[slot="end"] {
  max-width: 55%;
  color: var(--ion-color-dark);
  text-align: end;
  white-space: normal;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
}

.logs-panel {
  margin-top: var(--spacer-base, 16px);
}

ion-badge {
  min-width: 48px;
  text-align: center;
}

.list-item {
  display: grid;
  align-items: center;
  justify-items: center;
  --columns-desktop: 9;
  --col-calc: var(--columns-desktop);
  --implicit-columns: calc(var(--col-calc) - 1);
  grid-template-columns: repeat(var(--implicit-columns), 1fr) max-content;
  border-bottom: 1px solid var(--ion-color-medium);
}

.card-header {
  display: flex;
  justify-content: space-between;
}

@media (max-width: 768px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 991px) {
  .list-item {
    --col-calc: var(--columns-desktop);
    padding-block: var(--spacer-sm);
    padding-inline: var(--spacer-sm);
  }
}

@media (max-width: 576px) {
  .product-image {
    flex-basis: 72px;
    width: 72px;
    height: 72px;
  }

  ion-note[slot="end"] {
    max-width: 45%;
  }
}
</style>
