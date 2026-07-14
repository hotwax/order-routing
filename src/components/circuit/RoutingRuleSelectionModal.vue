<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button :aria-label="translate('Close')" @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Select Routing Context") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
      <ion-item button v-for="rule in routingRules" :key="rule.orderRoutingId || rule.routingGroupId" @click="selectRule(rule)">
        <ion-label>
          <h2>{{ rule.routingName }}</h2>
          <p v-if="rule.description">{{ rule.description }}</p>
          <p v-else>{{ rule.groupName || rule.routingGroupId }}</p>
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
    await orderRoutingStore().fetchOrderRoutingGroups();
    await orderRoutingStore().fetchOrderRoutingGroupsDetails();
    const routingGroups = orderRoutingStore().getRoutingGroups
    routingRules.value = routingGroups.flatMap((group: any) => {
      const activeRoutings = (group.routings || []).filter((routing: any) => routing.statusId !== "ROUTING_ARCHIVED");
      if (!activeRoutings.length) {
        return [{
          routingGroupId: group.routingGroupId,
          groupName: group.groupName,
          routingName: group.groupName,
          description: translate("No active routings")
        }];
      }

      return activeRoutings.map((routing: any) => ({
        routingGroupId: group.routingGroupId,
        orderRoutingId: routing.orderRoutingId,
        groupName: group.groupName,
        routingName: routing.routingName,
        description: group.groupName,
        label: `${group.groupName} / ${routing.routingName}`
      }));
    });
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
