<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Dashboard") }}</ion-title>
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
        :routing="routing"
        :facility-orders="facilityOrders"
        :facility-orders-date="facilityOrdersDate"
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
import { IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar, onIonViewWillEnter, onIonViewWillLeave } from "@ionic/vue";
import { gridOutline } from "ionicons/icons";
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
const routing = computed(() => dashboardStore.getRouting);
const facilityOrders = computed(() => dashboardStore.getFacilityOrders);
const facilityOrdersDate = computed(() => dashboardStore.getFacilityOrdersDate);
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

function go(path: string) {
  router.push(path);
}
</script>
