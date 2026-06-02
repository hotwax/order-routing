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
      <ion-item>
        <ion-select v-model="selectedFacilityId" :label="translate('Facility')" interface="popover">
          <ion-select-option v-for="facility in productStoreFacilities" :key="facility.facilityId + facility.productStoreId" :value="facility.facilityId">{{ facility.facilityName }}</ion-select-option>
        </ion-select>
      </ion-item>

      <section>
        <ion-item>
          <ion-label>
            <h1>{{ productName }}</h1>
            <p>{{ productSubtitle }}</p>
          </ion-label>
        </ion-item>
      </section>

      <section>
        <ion-item>
          <ion-label>{{ "Inventory Configuration" }}</ion-label>
          <ion-button slot="end" fill="clear">
            {{ "Edit" }}
          </ion-button>
        </ion-item>
        <ion-item>
          <ion-label>{{ "AllowBrokering" }}</ion-label>
          <ion-label slot="end">{{ "Y" }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-label>{{ "Allow Pickup" }}</ion-label>
          <ion-label slot="end">{{ "Y" }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-label>{{ "Threshold" }}</ion-label>
          <ion-label slot="end">{{ 0 }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-label>{{ "Safety Stock" }}</ion-label>
          <ion-label slot="end">{{ 0 }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-label>{{ "QOH" }}</ion-label>
          <ion-label slot="end">{{ 0 }}</ion-label>
        </ion-item>
        <ion-item>
          <ion-label>{{ "ATP" }}</ion-label>
          <ion-label slot="end">{{ 0 }}</ion-label>
        </ion-item>
      </section>
      <section class="ion-margin panel logs-panel">
        <div class="section-title">
          <h2>{{ translate("Inventory Logs") }}</h2>
        </div>

        <ion-list>
          <ion-item class="line-item">
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
              <p>{{ "Quantity On Hand" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ "Available To Promise" }}</p>
            </ion-label>
          </ion-item>

          <ion-item class="line-item" v-for="log in inventoryLogs" :key="log.inventoryItemId">
            <ion-label>
              <p>{{ log.inventoryItemId }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.datetimeReceived }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.facilityId }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.locationSeqId }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.comments || "-" }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.quantityOnHandTotal }}</p>
            </ion-label>
            <ion-label>
              <p>{{ log.availableToPromiseTotal }}</p>
            </ion-label>
          </ion-item>

          <p v-if="!inventoryLogs.length" class="empty-state">
            {{ "No inventory logs found" }}
          </p>
        </ion-list>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import router from '../router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  onIonViewDidEnter
} from '@ionic/vue';
import { translate } from '@common';
import { useProductFacility } from '@/composables/useProductFacility';
import { productStore } from '@/store/productStore';
import { productStore as productInfoStore } from '@/store/product';

const route = router.currentRoute.value;
const isLoading = ref(false);

const productId = computed(() => String(route.params.productId || ''));
const product = computed(() => productInfoStore().getProductById(productId.value))
const selectedFacilityId = ref("");
const productStoreFacilities = computed(() => productStore().productStoreFacilities)

const { inventoryLogs } = useProductFacility();

const productName = computed(() => {
  if (isLoading.value) return translate('Loading product');
  return product.value?.internalName || product.value?.productName || product.value?.parentProductName || translate('Product not found');
});

const productSubtitle = computed(() => product.value?.productName || product.value?.parentProductName || product.value?.title || '-');

onIonViewDidEnter(async () => {
  selectedFacilityId.value = productStoreFacilities.value[0].facilityId
  await fetchInventoryLogs();
});

watch(selectedFacilityId, fetchInventoryLogs)

async function fetchInventoryLogs() {
  await useProductFacility().fetchInventoryLogs({
    productId: productId.value,
    facilityId: selectedFacilityId.value,
    pageSize: 250
  });
}
</script>

<style scoped>
ion-content {
  --padding-bottom: 80px;
}

.detail-grid {
  max-width: 1280px;
  padding: var(--spacer-base, 16px);
}

.summary-row ion-col {
  display: flex;
}

.panel {
  width: 100%;
  border: 1px solid var(--ion-color-step-150, #d7d8da);
  border-radius: 8px;
  background: var(--ion-item-background, var(--ion-background-color));
  overflow: hidden;
}

.panel-header {
  display: flex;
  gap: var(--spacer-base, 16px);
  align-items: center;
  padding: var(--spacer-base, 16px);
  border-bottom: 1px solid var(--ion-color-step-150, #d7d8da);
}

.product-image {
  display: grid;
  place-items: center;
  flex: 0 0 96px;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border-radius: 8px;
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

@media (max-width: 576px) {
  .panel-header {
    align-items: flex-start;
  }

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
