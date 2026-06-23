<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Adjust Config") }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-list>
      <ion-item>
        <ion-select v-model="allowBrokering" :label="translate('Allow Brokering')" placeholder="Select" interface="popover">
          <ion-select-option value="Y">{{ "Y" }}</ion-select-option>
          <ion-select-option value="N">{{ "N" }}</ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-select v-model="allowPickup" :label="translate('Allow Pickup')" placeholder="Select" interface="popover">
          <ion-select-option value="Y">{{ "Y" }}</ion-select-option>
          <ion-select-option value="N">{{ "N" }}</ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-input type="number" min="0" placeholder="0" v-model="minimumStock" label="Safety stock" @keydown="restrictDecimalAndNegative"></ion-input>
      </ion-item>
      <ion-item>
        <ion-input type="number" min="0" placeholder="0" v-model="daysToShip" label="Days to Ship" @keydown="restrictDecimalAndNegative"></ion-input>
      </ion-item>
    </ion-list>
  </ion-content>

  <ion-fab vertical="bottom" horizontal="end" slot="fixed">
    <ion-fab-button @click="updateConfig()">
      <ion-icon :icon="saveOutline" />
    </ion-fab-button>
  </ion-fab>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonSelect, IonSelectOption, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { closeOutline, saveOutline } from "ionicons/icons";
import { api, commonUtil, logger, translate } from '@common';
import { ref } from "vue";

const props = defineProps(["selectedProducts", "selectedFacility"])

const allowPickup = ref("");
const allowBrokering = ref("")
const minimumStock = ref();
const daysToShip = ref();

function closeModal() {
  modalController.dismiss();
}

function restrictDecimalAndNegative(event: KeyboardEvent) {
  const keys = ['e', 'E', '-', '+', '.', ','];
  if (keys.includes(event.key)) {
    event.preventDefault();
  }
}

async function updateConfig() {
  const params = {
    facilityId: props.selectedFacility
  } as Record<string, string | number>

  if(allowBrokering.value) {
    params["allowBrokering"] = allowBrokering.value
  }

  if(allowPickup.value) {
    params["allowPickup"] = allowPickup.value
  }

  if(minimumStock.value === 0 || minimumStock.value) {
    const minStockVal = Number(minimumStock.value);
    if (minStockVal < 0 || !Number.isInteger(minStockVal)) {
      commonUtil.showToast(translate("Safety stock must be a non-negative integer."));
      return;
    }
    params["minimumStock"] = minStockVal;
  }

  if(daysToShip.value === 0 || daysToShip.value) {
    const daysToShipVal = Number(daysToShip.value);
    if (daysToShipVal < 0 || !Number.isInteger(daysToShipVal)) {
      commonUtil.showToast(translate("Days to Ship must be a non-negative integer."));
      return;
    }
    params["daysToShip"] = daysToShipVal;
  }

  const selectedProductIds = props.selectedProducts.map((product: any) => product.productId)
  try {
    const payload = []
    for(const productId of selectedProductIds) {
      payload.push({
        ...params,
        productId
      })
    }
    await api({
      url: "oms/productFacilities",
      method: "POST",
      data: payload
    })
    modalController.dismiss({ updated: true });
    commonUtil.showToast(translate("Inventory config update for selected products"))
  } catch(err) {
    logger.error("Failed to update inventory config for product facilities");
  }
}
</script>