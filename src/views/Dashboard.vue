<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Dashboard") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="!currentProductStore?.productStoreId" :aria-label="translate('Refresh')" @click="load()">
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
        :message="translate('Choose a product store to see its routing and inventory diagnostics.')"
      />
      <DashboardDiagnostics v-else />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { emitter, translate } from "@common";
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonMenuButton, IonPage, IonTitle, IonToolbar, onIonViewWillEnter, onIonViewWillLeave } from "@ionic/vue";
import { gridOutline, refreshOutline } from "ionicons/icons";
import { computed } from "vue";
import DashboardDiagnostics from "@/components/DashboardDiagnostics.vue";
import EmptyState from "@/components/EmptyState.vue";
import { useAtpProductStore } from "@/store/atpProductStore";
import { useRoutingDiagnosticsStore } from "@/store/routingDiagnosticsStore";

const diagnostics = useRoutingDiagnosticsStore();
const productStore = useAtpProductStore();

const currentProductStore = computed(() => productStore.getCurrentProductStore);

onIonViewWillEnter(() => {
  load();
  emitter.on("productStoreOrConfigChanged", onProductStoreChanged);
});

onIonViewWillLeave(() => {
  emitter.off("productStoreOrConfigChanged", onProductStoreChanged);
});

function onProductStoreChanged() {
  load();
}

function load() {
  return diagnostics.load();
}
</script>
