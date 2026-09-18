<!-- src/components/simulation/PastSimulationsList.vue -->
<template>
  <div>
    <ion-item lines="none">
      <ion-select :label="translate('Status')" interface="popover" :value="statusId" @ionChange="onFilter('statusId', $event.detail.value)">
        <ion-select-option :value="''">{{ translate("All") }}</ion-select-option>
        <ion-select-option value="COMPLETE">{{ translate("Complete") }}</ion-select-option>
        <ion-select-option value="FAILED">{{ translate("Failed") }}</ion-select-option>
      </ion-select>
      <ion-note v-if="sim.listRefreshing" slot="end" color="medium">{{ translate("Refreshing…") }}</ion-note>
    </ion-item>

    <div v-if="scopeError || sim.listError" class="ion-padding">
      <ion-text color="danger">{{ scopeError || sim.listError }}</ion-text>
      <ion-button v-if="!scopeError" fill="outline" size="small" @click="reload">{{ translate("Retry") }}</ion-button>
    </div>

    <div v-if="sim.listLoading" class="ion-padding">
      <ion-spinner name="crescent" /> {{ translate("Loading simulations…") }}
    </div>

    <div v-else-if="!sim.list.length && !sim.listError && !scopeError" class="ion-padding ion-text-center">
      <p>{{ translate("No past simulations yet") }}</p>
      <ion-note>{{ translate("Run a simulation to see it here.") }}</ion-note>
    </div>

    <ion-list v-else-if="!scopeError && sim.list.length">
      <ion-item v-for="h in sim.list" :key="h.simulationId" button detail @click="open(h.simulationId)">
        <ion-label>
          {{ h.routingGroupId }}
          <ion-badge :color="historyIdentity(h).kind === 'variation' ? 'tertiary' : 'medium'">
            {{ translate(historyIdentity(h).kind === "variation" ? "Variation" : "Baseline") }}
          </ion-badge>
          <ion-badge v-if="h.statusId === 'FAILED'" color="danger">{{ translate("Failed") }}</ion-badge>
          <p>{{ historyIdentity(h).kind === "variation" ? historyIdentity(h).label + " · " : "" }}{{ h.runType }} · {{ h.brokeredItemCount }}/{{ h.attemptedItemCount }} {{ translate("brokered") }} · {{ commonUtil.getDateAndTime(h.createdDate) }}</p>
        </ion-label>
      </ion-item>
    </ion-list>
  </div>
</template>

<script setup lang="ts">
import { IonBadge, IonButton, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonSpinner, IonText } from "@ionic/vue";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { translate, commonUtil } from "@common";
import { usePastSimulationStore } from "@/store/pastSimulationStore";
import { simulationStore } from "@/store/simulationStore";
import type { PastSimHeader } from "@/types/simulation";
import { persistedSimulationIdentity } from "@/utils/simulationResults";

const router = useRouter();
const sim = usePastSimulationStore();
const statusId = ref("");
const scopeError = ref("");

// Scope to the sim product store (where simulations are persisted), not the OMS demo placeholder.
// One shared resolution (env > OMS fallback) so this can't drift from the submit/list paths.
const productStoreId = computed<string>(() => simulationStore().resolveProductStoreId());

function reload() {
  if (!productStoreId.value) {
    scopeError.value = translate("Select a product store to load simulation history.");
    return;
  }
  scopeError.value = "";
  sim.loadList({ productStoreId: productStoreId.value, statusId: statusId.value || undefined, pageIndex: 0, pageSize: 25 });
}
function onFilter(_key: string, value: string) { statusId.value = value; reload(); }
function open(id: string) { router.push(`/simulate/history/${id}`); }
function historyIdentity(header: PastSimHeader) { return persistedSimulationIdentity(header); }

onMounted(reload);
watch(productStoreId, (next, previous) => {
  if (next !== previous) reload();
});
</script>
