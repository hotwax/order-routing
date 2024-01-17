<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ "Inventory Sort" }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal">{{ $t('Close') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-for="filter in Object.values(inventoryFilterOptions['INV_SORT_PARAM_TYPE'])" :key="filter.enumId">
          <ion-checkbox>{{ filter.description || filter.enumCode }}</ion-checkbox>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonItem, IonList, IonPage, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { useStore } from "vuex";
import { computed } from "vue";

const store = useStore();

const inventoryFilterOptions = computed(() => store.getters["util/getEnums"])

function closeModal() {
  modalController.dismiss({ dismissed: true })
}
</script>
