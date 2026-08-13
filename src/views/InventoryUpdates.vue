<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Inventory updates") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="loading" :title="translate('Refresh')" @click="refresh">
            <ion-spinner v-if="loading" name="crescent" />
            <ion-icon v-else slot="icon-only" :icon="refreshOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <main class="updates-page">
        <ion-item v-if="lastUpdated" lines="none">
          <ion-label>
            <p>{{ translate("Last refreshed") }}</p>
            {{ commonUtil.formatDateTimeValue(lastUpdated) }}
          </ion-label>
        </ion-item>

        <ion-card v-if="loadError" color="light">
          <ion-card-content>{{ translate(loadError) }}</ion-card-content>
        </ion-card>

        <!--
          Active rule runs is scoped to the selected product store, while the file counts come
          from the Data Manager filtered only by configId and so cover the whole OMS instance.
          Each card states its own scope rather than relying on one page-level note.
        -->
        <div class="kpi-grid">
          <StatCard :title="translate('Active rule runs')" :subtitle="translate('This store')">
            <template #stat><AnimatedNumber :value="stats.activeRuns" /></template>
          </StatCard>
          <StatCard :title="translate('Files waiting')" :subtitle="translate('Across this OMS instance')">
            <template #stat><AnimatedNumber :value="stats.queuedFiles" /></template>
          </StatCard>
          <StatCard :title="translate('Files processing')" :subtitle="translate('Across this OMS instance')">
            <template #stat><AnimatedNumber :value="stats.processingFiles" /></template>
          </StatCard>
          <StatCard :title="translate('Failed files')" :subtitle="translate('Across this OMS instance')">
            <template #stat><AnimatedNumber :value="stats.failedFiles" /></template>
          </StatCard>
        </div>

        <ion-card>
          <ion-card-header>
            <div class="card-head">
              <ion-card-title>{{ translate("Update schedules") }}</ion-card-title>
              <ion-note v-if="nextSchedule" slot="end">
                {{ translate("Next scheduled") }} {{ commonUtil.getRelativeTime(nextSchedule.nextExecutionDateTime) }}
              </ion-note>
            </div>
          </ion-card-header>
          <ion-list v-if="schedules.length" lines="full">
            <ion-item v-for="schedule in schedules" :key="schedule.ruleGroupId">
              <ion-icon
                slot="start"
                :icon="schedule.activeRun ? syncOutline : timeOutline"
                :color="schedule.activeRun ? 'primary' : 'medium'"
              />
              <ion-label class="ion-text-wrap">
                {{ schedule.groupName }}
                <p>{{ schedule.ruleGroupId }}</p>
                <p>{{ schedule.cronDescription || translate("Not scheduled") }}</p>
              </ion-label>
              <ion-label slot="end" class="schedule-status">
                <ion-badge v-if="schedule.activeRun" color="primary">{{ translate("Generating file") }}</ion-badge>
                <ion-badge v-else-if="schedule.paused === 'Y'" color="medium">{{ translate("Paused") }}</ion-badge>
                <template v-else>
                  {{ commonUtil.formatDateTimeValue(schedule.nextExecutionDateTime) }}
                  <p>{{ schedule.executionTimeZone }}</p>
                </template>
              </ion-label>
              <ion-button slot="end" fill="outline" @click="openManage(schedule)">
                {{ translate("Manage") }}
              </ion-button>
            </ion-item>
          </ion-list>
          <ion-card-content v-else>
            {{ translate("No active ATP rule groups found") }}
          </ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <div class="card-head">
              <ion-card-title>{{ translate("ATP file history") }}</ion-card-title>
              <ion-note slot="end">IMP_ATP_PROD_FAC</ion-note>
            </div>
            <ion-segment :value="selectedView" @ionChange="changeView(($event as any).detail.value)">
              <ion-segment-button value="all"><ion-label>{{ translate("All files") }}</ion-label></ion-segment-button>
              <ion-segment-button value="queue"><ion-label>{{ translate("Queued files") }}</ion-label></ion-segment-button>
              <ion-segment-button value="failed"><ion-label>{{ translate("Failed files") }}</ion-label></ion-segment-button>
            </ion-segment>
          </ion-card-header>

          <ion-list v-if="logs.length" lines="full">
            <ion-item v-for="log in logs" :key="log.logId">
              <ion-icon slot="start" :icon="documentTextOutline" color="medium" />
              <ion-label class="ion-text-wrap file-info">
                {{ log.fileName || translate("Rule update file") }}
                <p>{{ log.logId }}</p>
                <p>{{ commonUtil.formatDateTimeValue(log.createdDate) }}</p>
              </ion-label>
              <ion-label class="ion-text-wrap records">
                <template v-if="log.totalRecordCount != null">
                  {{ Number(log.failedRecordCount) || 0 }} / {{ Number(log.totalRecordCount) || 0 }} {{ translate("failed") }}
                </template>
              </ion-label>
              <ion-label slot="end" class="log-status">
                <ion-badge :color="statusColor(log.statusId)">{{ translate(statusLabel(log.statusId)) }}</ion-badge>
                <p>{{ formatFileSize(log.fileSize) }}</p>
                <p v-if="log.createdDate && (log.finishDateTime || log.lastUpdatedTxStamp)">
                  {{ formatRunDuration(log.createdDate, log.finishDateTime || log.lastUpdatedTxStamp) }}
                </p>
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-card-content v-else>{{ translate("No ATP files found") }}</ion-card-content>

          <div class="pagination">
            <ion-button fill="outline" :disabled="pageIndex === 0 || loading" @click="previousPage">
              {{ translate("Previous") }}
            </ion-button>
            <ion-note>{{ translate("Page") }} {{ pageIndex + 1 }} / {{ pageCount }}</ion-note>
            <ion-button fill="outline" :disabled="pageIndex + 1 >= pageCount || loading" @click="nextPage">
              {{ translate("Next") }}
            </ion-button>
          </div>
        </ion-card>
      </main>
    </ion-content>

    <InventoryUpdateJobModal
      :is-open="showManageModal"
      :schedule="selectedSchedule"
      @updated="refresh"
      @close="showManageModal = false"
      @dismissed="handleModalDismissed"
    />
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  onIonViewDidEnter,
  onIonViewDidLeave
} from "@ionic/vue";
import { documentTextOutline, refreshOutline, syncOutline, timeOutline } from "ionicons/icons";
import { computed, ref } from "vue";
import { commonUtil, emitter, StatCard, translate } from "@common";
import AnimatedNumber from "@/components/AnimatedNumber.vue";
import InventoryUpdateJobModal from "@/components/InventoryUpdateJobModal.vue";
import { useInventoryUpdatesStore, type InventoryUpdateSchedule } from "@/store/inventoryUpdates";
import {
  DATA_MANAGER_PAGE_SIZE,
  DATA_MANAGER_STATUSES,
  DATA_MANAGER_STATUS_LABELS,
  FAILED_DATA_MANAGER_STATUSES,
  formatFileSize,
  formatRunDuration,
  QUEUED_DATA_MANAGER_STATUSES
} from "@/utils/inventoryUpdates";

const store = useInventoryUpdatesStore();
const selectedView = ref("all");
const selectedSchedule = ref<InventoryUpdateSchedule | null>(null);
const showManageModal = ref(false);
const pageIndex = ref(0);

const schedules = computed(() => store.schedules);
const logs = computed(() => store.logs);
const stats = computed(() => store.stats);
const loading = computed(() => store.loading);
const lastUpdated = computed(() => store.lastUpdated);
const loadError = computed(() => store.loadError);
const nextSchedule = computed(() => store.nextSchedule);
const pageCount = computed(() => Math.max(Math.ceil(store.logsCount / DATA_MANAGER_PAGE_SIZE), 1));

function statusesForView(view = selectedView.value) {
  if (view === "queue") return [...QUEUED_DATA_MANAGER_STATUSES, "DmlsRunning"];
  if (view === "failed") return FAILED_DATA_MANAGER_STATUSES;
  return DATA_MANAGER_STATUSES;
}

async function refresh() {
  await store.load(pageIndex.value, statusesForView());
}

async function changeView(view: string) {
  selectedView.value = view || "all";
  pageIndex.value = 0;
  await refresh();
}

async function previousPage() {
  pageIndex.value -= 1;
  await refresh();
}

async function nextPage() {
  pageIndex.value += 1;
  await refresh();
}

function statusLabel(statusId: string) {
  return DATA_MANAGER_STATUS_LABELS[statusId] || statusId;
}

function statusColor(statusId: string) {
  return commonUtil.getStatusColor(statusId);
}

function openManage(schedule: InventoryUpdateSchedule) {
  selectedSchedule.value = schedule;
  showManageModal.value = true;
}

function handleModalDismissed() {
  // A dismiss can settle after the user has already opened another schedule. Clearing
  // unconditionally would blank that new selection and fall the modal back to a generic title.
  if (!showManageModal.value) selectedSchedule.value = null;
}

async function handleProductStoreChange() {
  pageIndex.value = 0;
  await refresh();
}

// Refresh is driven by entering the page, the toolbar button, a product store change, and by the
// manage modal after a save or run. A background poll here would cost 5 + 2N requests per tick
// against the OMS for as long as the tab stays open.
onIonViewDidEnter(async () => {
  await refresh();
  emitter.off("productStoreOrConfigChanged", handleProductStoreChange);
  emitter.on("productStoreOrConfigChanged", handleProductStoreChange);
});

onIonViewDidLeave(() => {
  emitter.off("productStoreOrConfigChanged", handleProductStoreChange);
});
</script>

<style scoped>
.updates-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-sm);
  padding: var(--spacer-base);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacer-sm);
}

.card-head {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
}

.card-head ion-note {
  margin-inline-start: auto;
}

.schedule-status,
.log-status {
  text-align: end;
}

.records {
  text-align: center;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacer-sm);
  padding: var(--spacer-sm);
}

@media (max-width: 700px) {
  .records {
    display: none;
  }
}
</style>
