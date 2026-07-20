<template>
  <ion-card>
    <ion-card-header>
      <ion-card-title>{{ translate("Product Identifier") }}</ion-card-title>
    </ion-card-header>

    <ion-card-content>
      {{ translate("Choosing a product identifier allows you to view products with your preferred identifiers.") }}
    </ion-card-content>

    <ion-item :disabled="!userStore.hasPermission('COMMON_ADMIN')">
      <ion-select :label="translate('Primary')" interface="popover" :placeholder="translate('primary identifier')" :value="productIdentificationPref.primaryId" @ionChange="setProductIdentificationPref($event.detail.value, 'primaryId')">
        <ion-select-option v-for="identification in productIdentificationOptions" :key="identification.goodIdentificationTypeId" :value="identification.goodIdentificationTypeId">{{ translate(identification.description || identification.goodIdentificationTypeId) }}</ion-select-option>
      </ion-select>
    </ion-item>
    <ion-item lines="none" :disabled="!userStore.hasPermission('COMMON_ADMIN')">
      <ion-select :label="translate('Secondary')" interface="popover" :placeholder="translate('secondary identifier')" :value="productIdentificationPref.secondaryId" @ionChange="setProductIdentificationPref($event.detail.value, 'secondaryId')">
        <ion-select-option v-for="identification in productIdentificationOptions" :key="identification.goodIdentificationTypeId" :value="identification.goodIdentificationTypeId">{{ translate(identification.description || identification.goodIdentificationTypeId) }}</ion-select-option>
        <ion-select-option value="">{{ translate("None") }}</ion-select-option>
      </ion-select>
    </ion-item>
    <template v-if="currentSampleProduct">
      <ion-item lines="full" color="light">
        <ion-label color="medium">{{ translate("Preview Product Identifier") }}</ion-label>
      </ion-item>
      <ion-item lines="none">
        <ion-thumbnail slot="start">
          <DxpShopifyImg size="small" :src="currentSampleProduct.mainImageUrl" />
        </ion-thumbnail>
        <ion-label>
          {{ getPrimaryProductIdentifier(productIdentificationPref, currentSampleProduct) }}
          <p>{{ getSecondaryProductIdentifier(productIdentificationPref, currentSampleProduct) }}</p>
        </ion-label>
        <ion-button size="default" fill="clear" @click="shuffle">
          <ion-icon slot="icon-only" :icon="shuffleOutline" />
        </ion-button>
      </ion-item>
    </template>
  </ion-card>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption, IonThumbnail } from "@ionic/vue";
import { computed, onMounted } from "vue";
import { DxpShopifyImg, translate } from "@common";
import { shuffleOutline } from "ionicons/icons";
import { productStore } from "@/store/productStore";
import { useUserStore } from "@/store/userStore";
import { getPrimaryProductIdentifier, getSecondaryProductIdentifier } from "@/utils/productIdentifier";

const store = productStore();
const userStore = useUserStore();

const currentEComStore = computed(() => store.getCurrentEComStore);
const productIdentificationPref = computed(() => store.getProductIdentificationPref);
const productIdentificationOptions = computed(() => store.getProductIdentificationOptions);
const currentSampleProduct = computed(() => store.getCurrentSampleProduct) as any;

// The preference itself is already loaded by fetchProductStoreSettings when the store
// loads / changes, so here we only need the identifier options and a sample product preview.
onMounted(() => {
  store.prepareProductIdentifierOptions();
  store.fetchSampleProducts();
})

function setProductIdentificationPref(value: string, id: string) {
  if (!currentEComStore.value?.productStoreId) return;
  const updatedPreference = { ...productIdentificationPref.value } as any;
  updatedPreference[id] = value;
  store.setProductStoreSetting(currentEComStore.value.productStoreId, "PRDT_IDEN_PREF", updatedPreference);
}

function shuffle() {
  store.shuffleProduct();
}
</script>
