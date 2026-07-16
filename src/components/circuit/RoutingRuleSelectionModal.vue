<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Select Routing Rule") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
      <ion-item button v-for="rule in routingRules" :key="rule.routingGroupId" @click="selectRule(rule)">
        <ion-label>
          {{ rule.routingName }}
          <p v-if="rule.description">{{ rule.description }}</p>
          <p v-else>{{ rule.routingGroupId }}</p>
        </ion-label>
      </ion-item>
    </ion-list>
    <p class="empty-state" v-if="!routingRules.length && !isLoading">
      {{ translate("No routing rules found") }}
    </p>
    <div v-if="isLoading" class="ion-text-center ion-padding">
      <ion-spinner name="crescent" />
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import { 
  IonButton, 
  IonButtons, 
  IonContent, 
  IonHeader, 
  IonIcon, 
  IonItem, 
  IonLabel, 
  IonList, 
  IonSpinner,
  IonTitle, 
  IonToolbar, 
  modalController 
} from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { translate, commonUtil, logger } from "@common";
import { ref, onMounted } from "vue";
import { productStore } from "@/store/productStore";
import { orderRoutingStore } from "@/store/orderRoutingStore";

const routingRules = ref([]) as any;
const isLoading = ref(false);
const store = productStore();

onMounted(async () => {
  await fetchRoutingRules();
});

const fetchRoutingRules = async () => {
  isLoading.value = true;
  try {
    const payload = {
      productStoreId: store.currentEComStore.productStoreId,
      pageSize: 200
    }
    const resp = await orderRoutingStore().fetchOrderRoutingGroups();
      const routingGroups = orderRoutingStore().getRoutingGroups
      // The API returns routing groups. We'll use these as the "rules" to select.
      routingRules.value = routingGroups.map((group: any) => ({
        ...group,
        routingName: group.groupName // Normalize the name field for display
      }));
  } catch (err) {
    logger.error("Failed to fetch routing rules", err);
  } finally {
    isLoading.value = false;
  }
};

const closeModal = () => {
  modalController.dismiss();
};

const selectRule = (rule: any) => {
  modalController.dismiss(rule);
};
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--ion-color-medium);
}
</style>
