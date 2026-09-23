<template>
  <div>
    <ion-item lines="none">
      <ion-select :label="translate('Status')" interface="popover" :value="statusId" @ionChange="onFilter($event.detail.value)">
        <ion-select-option value="">{{ translate('All') }}</ion-select-option>
        <ion-select-option value="BRSIM_QUEUED">{{ translate('Queued') }}</ion-select-option>
        <ion-select-option value="BRSIM_RUNNING">{{ translate('Running') }}</ion-select-option>
        <ion-select-option value="BRSIM_COMPLETE">{{ translate('Complete') }}</ion-select-option>
        <ion-select-option value="BRSIM_FAILED">{{ translate('Failed') }}</ion-select-option>
      </ion-select>
      <ion-button slot="end" fill="clear" @click="reload">{{ translate('Refresh') }}</ion-button>
    </ion-item>

    <div v-if="error" class="ion-padding">
      <ion-text color="danger">{{ error }}</ion-text>
      <ion-button fill="outline" size="small" @click="reload">{{ translate('Retry') }}</ion-button>
    </div>
    <div v-if="loading" class="ion-padding"><ion-spinner name="crescent" /> {{ translate('Loading simulations…') }}</div>
    <div v-else-if="!runs.length && !error" class="ion-padding ion-text-center">
      <p>{{ translate('No past simulations yet') }}</p>
    </div>

    <ion-list v-else-if="runs.length">
      <ion-item v-for="run in runs" :key="run.simulationId" button detail @click="router.push(`/simulate/history/${run.simulationId}`)">
        <ion-label>
          <h2>{{ run.routingGroupId }}</h2>
          <p>{{ run.runType }} · {{ run.brokeredItemCount || 0 }}/{{ run.attemptedItemCount || 0 }} {{ translate('brokered') }}</p>
        </ion-label>
        <ion-badge slot="end" :color="run.statusId === 'BRSIM_FAILED' ? 'danger' : run.statusId === 'BRSIM_COMPLETE' ? 'success' : 'medium'">
          {{ String(run.statusId || '').replace('BRSIM_', '') }}
        </ion-badge>
      </ion-item>
    </ion-list>
    <div v-if="totalCount > pageSize" class="history-pagination">
      <ion-button fill="clear" :disabled="pageIndex === 0 || loading" @click="changePage(-1)">{{ translate('Previous') }}</ion-button>
      <ion-text>{{ pageIndex * pageSize + 1 }}–{{ Math.min((pageIndex + 1) * pageSize, totalCount) }} / {{ totalCount }}</ion-text>
      <ion-button fill="clear" :disabled="(pageIndex + 1) * pageSize >= totalCount || loading" @click="changePage(1)">{{ translate('Next') }}</ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { translate } from "@common";
import { IonBadge, IonButton, IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonSpinner, IonText } from "@ionic/vue";
import { listSimulations } from "@/services/SimulationService";
import type { PersistedSimulation } from "@/services/SimulationService";
import { productStore } from "@/store/productStore";
import { simulationSetupError } from "@/services/SimulationSetupService";

const router = useRouter();
const statusId = ref("");
const loading = ref(false);
const error = ref("");
const runs = ref<Array<PersistedSimulation["simulation"] & { runType?: string }>>([]);
const pageSize = 25;
const pageIndex = ref(0);
const totalCount = ref(0);
const productStoreId = computed(() => String(productStore().getCurrentEComStore?.productStoreId || ""));
let requestNumber = 0;

async function reload() {
  const current = ++requestNumber;
  loading.value = true;
  error.value = "";
  runs.value = [];
  totalCount.value = 0;
  try {
    if (!productStoreId.value) throw new Error("Choose a product store to view its simulation history.");
    const result = await listSimulations({
      productStoreId: productStoreId.value, statusId: statusId.value || undefined,
      pageIndex: pageIndex.value, pageSize,
    });
    if (current === requestNumber) {
      runs.value = result.simulationList;
      totalCount.value = Number(result.totalCount || 0);
    }
  } catch (cause: any) {
    if (current === requestNumber) error.value = simulationSetupError(cause);
  } finally {
    if (current === requestNumber) loading.value = false;
  }
}
function onFilter(value: string) { statusId.value = value || ""; pageIndex.value = 0; reload(); }
function changePage(delta: number) { pageIndex.value += delta; reload(); }
watch(productStoreId, () => { pageIndex.value = 0; reload(); }, { immediate: true });
</script>

<style scoped>
.history-pagination { display: flex; align-items: center; justify-content: space-between; }
</style>
