<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Dashboard") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refresh()">
            <ion-icon slot="icon-only" :icon="refreshOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <EmptyState
        v-if="!currentProductStore?.productStoreId"
        :icon="gridOutline"
        :title="translate('No product store selected')"
        :message="translate('Choose a product store to see its routing and sourcing overview.')"
      />
      <DashboardSummary
        v-else
        :brokering="brokering"
        :facility-orders="facilityOrders"
        :facility-orders-date="facilityOrdersDate"
        :facility-orders-is-today="facilityOrdersIsToday"
        :sourcing="sourcing"
        :foundations="foundations"
        :channels="channels"
        :channel-jobs="channelJobs"
        :total-sourcing="totalSourcing"
        @navigate="go"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonMenuButton, IonPage, IonTitle, IonToolbar, onIonViewWillEnter, onIonViewWillLeave } from "@ionic/vue";
import { gridOutline, refreshOutline } from "ionicons/icons";
import { computed } from "vue";
import { emitter, translate } from "@common";
import router from "@/router";
import EmptyState from "@/components/EmptyState.vue";
import DashboardSummary from "@/components/DashboardSummary.vue";
import { useDashboardStore } from "@/store/dashboardStore";
import { useAtpProductStore } from "@/store/atpProductStore";

const dashboardStore = useDashboardStore();
const productStore = useAtpProductStore();

const currentProductStore = computed(() => productStore.getCurrentProductStore);
const sourcing = computed(() => dashboardStore.getSourcing);
const brokering = computed(() => dashboardStore.getBrokering);
const facilityOrders = computed(() => dashboardStore.getFacilityOrders);
const facilityOrdersDate = computed(() => dashboardStore.getFacilityOrdersDate);
const facilityOrdersIsToday = computed(() => dashboardStore.getFacilityOrdersIsToday);
const foundations = computed(() => dashboardStore.getFoundations);
const channels = computed(() => dashboardStore.getChannels);
const channelJobs = computed(() => dashboardStore.getChannelJobs);
const totalSourcing = computed(() => dashboardStore.totalSourcingRules);

onIonViewWillEnter(() => {
  load();
  emitter.on("productStoreOrConfigChanged", load);
});

onIonViewWillLeave(() => {
  emitter.off("productStoreOrConfigChanged", load);
});

async function load() {
  emitter.emit("presentLoader");
  try {
    await dashboardStore.loadDashboard();
  } finally {
    emitter.emit("dismissLoader");
  }
}

function refresh() {
  load();
}

function go(path: string) {
  router.push(path);
}
</script>
