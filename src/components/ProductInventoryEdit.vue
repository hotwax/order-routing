<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Adjust inventory") }}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <ion-item lines="none">
      <ion-select v-model="selectedVarianceReason" :label="translate('Reason')" label-placement="fixed" placeholder="Select" interface="popover">
        <ion-select-option v-for="reason in varianceReasons" :key="reason.value" :value="reason.value">
          {{ translate(reason.label) }}
        </ion-select-option>
      </ion-select>
    </ion-item>

    <ion-segment :value="varianceAction" @ionChange="varianceAction = ($event.detail.value as any)">
      <ion-segment-button value="ADD">
        <ion-label>{{ translate("Add") }}</ion-label>
      </ion-segment-button>
      <ion-segment-button value="REMOVE">
        <ion-label>{{ translate("Remove") }}</ion-label>
      </ion-segment-button>
    </ion-segment>

    <ion-item>
      <ion-input type="number" min="0" inputmode="numeric" v-model="variance" placeholder="Enter variance" :label="'Variance'"></ion-input>
    </ion-item>
  </ion-content>

  <ion-fab vertical="bottom" horizontal="end" slot="fixed">
    <ion-fab-button @click="updateInventory()">
      <ion-icon :icon="saveOutline" />
    </ion-fab-button>
  </ion-fab>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { closeOutline, saveOutline } from "ionicons/icons";
import { api, commonUtil, logger, translate } from '@common';
import { onMounted, ref } from "vue";
import { useUserStore } from "@/store/userStore";

const props = defineProps(["selectedProducts", "selectedFacility", "currentConfig"])

const variance = ref(0) as any;
const varianceAction = ref("ADD")
const varianceReasons = ref<Array<any>>([]);
const selectedVarianceReason = ref("")

function closeModal() {
  modalController.dismiss();
}

onMounted(async () => {
  await getVarianceReasonEnums();
})

const getVarianceReasonEnums = async () => {
  const resp = await api({
    url: 'admin/enums',
    method: 'GET',
    params: {
      enumTypeId: 'IID_REASON',
      pageNoLimit: true
    }
  });
  varianceReasons.value = resp?.data?.map((enumItem: any) => ({
    label: enumItem.description,
    value: enumItem.enumId
  })) || [];

};

async function updateInventory() {
  if (!selectedVarianceReason.value) {
    commonUtil.showToast(translate("Please select a variance reason."));
    return;
  }
  try {
    console.log('props.selectedProducts', props.selectedProducts)
    const reasonEnumId = selectedVarianceReason.value;
    const varianceList = props.selectedProducts
      .map((item: any) => {
        return {
          inventoryItemId: props.currentConfig ? props.currentConfig.inventoryItemId : (item.inventoryItemId || item.inventoryConfig?.inventoryItemId),
          productId: item.productId,
          facilityId: props.selectedFacility,
          reasonEnumId,
          quantity: varianceAction.value === "REMOVE" ? variance.value * (-1) : variance.value,
          comments: "Variance Logged from Order Routing App inventory screen"
        };
      });

    console.log('varianceList', varianceList)

    await api({
      url: "inventory-cycle-count/recordVariance",
      method: "POST",
      data: {
        partyId: useUserStore().current?.partyId || "",
        varianceList
      }
    })
    
    commonUtil.showToast(translate("Variance logged successfully."));
    modalController.dismiss({ updated: true })
  } catch (error) {
    commonUtil.showToast(translate("Failed to log variance. Please try again."));
    logger.error("Error logging variance:", error);
  }
}
</script>