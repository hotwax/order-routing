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
        <ion-input v-model="minimumStock" label="Safety stock"></ion-input>
      </ion-item>
      <ion-item>
        <ion-input v-model="daysToShip" label="Days to Ship"></ion-input>
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
const minimumStock = ref(0);
const daysToShip = ref(0);

function closeModal() {
  modalController.dismiss();
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
    params["minimumStock"] = minimumStock.value
  }

  if(daysToShip.value === 0 || daysToShip.value) {
    params["daysToShip"] = daysToShip.value
  }

  const selectedProductIds = props.selectedProducts.map((product: any) => product.productId)
  try {
    // TODO: define a multi service for this
    for(const productId of selectedProductIds) {
      await api({
        url: "oms/productFacilities",
        method: "POST",
        data: {
          ...params,
          productId
        }
      })
    }
    modalController.dismiss({ updated: true });
    commonUtil.showToast(translate("Inventory config update for selected products"))
  } catch(err) {
    logger.error("Failed to update inventory config for product facilities");
  }
}
</script>