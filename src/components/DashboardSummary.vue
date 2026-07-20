<template>
  <main class="dashboard">
    <!-- Routing performance -->
    <ion-card class="brokering-stats" button router-link="/brokering">
      <ion-card-header>
        <div class="card-head">
          <ion-card-title>{{ translate("Routing") }}</ion-card-title>
          <ion-note slot="end">{{ brokering.total }} {{ brokering.total === 1 ? translate("group") : translate("groups") }}</ion-note>
        </div>
      </ion-card-header>
      <template v-if="brokering.lastGroupRun">
        <div class="metric">
          <h1>{{ lastGroupRunBrokerRate }}<span class="metric-unit">%</span></h1>
          <ion-text color="medium"><p class="metric-label">{{ translate("broker rate") }} {{ translate("last run") }}</p></ion-text>
        </div>
        <ion-list lines="none" class="stat-list">
          <ion-item>
            <ion-label class="ion-text-wrap">
              {{ translate("Items routed") }}
              <p>{{ brokering.lastGroupRun.groupName }}</p>
            </ion-label>
            <ion-label slot="end">{{ brokering.lastGroupRun.brokeredItemCount }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ translate("In queue now") }}</ion-label>
            <ion-label slot="end">{{ brokering.queueDepth }}</ion-label>
          </ion-item>
          <ion-item v-if="brokering.oldestQueued" lines="none">
            <ion-label class="ion-text-wrap">
              {{ translate("Oldest queued order") }}
              <p>{{ brokering.oldestQueued.orderName }} · {{ brokering.oldestQueued.customerName }}</p>
              <p>{{ brokering.oldestQueued.facilityName }}<template v-if="brokering.oldestQueued.salesChannelDesc"> · {{ brokering.oldestQueued.salesChannelDesc }}</template></p>
              <p>{{ commonUtil.getDateAndTime(brokering.oldestQueued.orderDate) }}</p>
            </ion-label>
            <ion-note slot="end" color="danger">{{ oldestQueuedAge }}</ion-note>
          </ion-item>
        </ion-list>
        <div class="groups">
          <ion-chip outline color="success" v-if="brokering.scheduled"><ion-label>{{ translate("{count} scheduled", { count: brokering.scheduled }) }}</ion-label></ion-chip>
          <ion-chip outline color="medium" v-if="brokering.paused"><ion-label>{{ translate("{count} paused", { count: brokering.paused }) }}</ion-label></ion-chip>
          <ion-chip outline color="medium" v-if="brokering.draft"><ion-label>{{ translate("{count} draft", { count: brokering.draft }) }}</ion-label></ion-chip>
        </div>
        <ion-item lines="none">
          <ion-icon slot="start" :icon="timeOutline" color="medium" />
          <ion-label color="medium">{{ translate("Last run {time}", { time: commonUtil.getDateAndTime(brokering.lastGroupRun.startDate) }) }}</ion-label>
        </ion-item>
      </template>
      <template v-else>
        <div class="metric">
          <h1>{{ brokering.total }}</h1>
        </div>
        <div class="groups">
          <ion-chip outline color="success"><ion-label>{{ translate("{count} scheduled", { count: brokering.scheduled }) }}</ion-label></ion-chip>
          <ion-chip outline color="medium" v-if="brokering.paused"><ion-label>{{ translate("{count} paused", { count: brokering.paused }) }}</ion-label></ion-chip>
          <ion-chip outline color="medium" v-if="brokering.draft"><ion-label>{{ translate("{count} draft", { count: brokering.draft }) }}</ion-label></ion-chip>
        </div>
        <ion-item lines="none">
          <ion-icon slot="start" :icon="timeOutline" color="medium" />
          <ion-label color="medium">{{ translate("No run history") }}</ion-label>
        </ion-item>
      </template>
    </ion-card>

    <!-- Facility orders -->
    <ion-card class="facility-orders">
      <ion-card-header>
        <div class="card-head">
          <ion-card-title>{{ translate("Facility orders") }}</ion-card-title>
          <ion-note slot="end">{{ facilityOrdersIsToday ? translate("today") : facilityOrdersDate }}</ion-note>
        </div>
        <ion-segment v-if="facilityOrders.length" :value="sortMode" @ionChange="sortMode = ($event.detail.value as string)">
          <ion-segment-button value="orders">
            <ion-label>{{ translate("Most orders") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="utilization">
            <ion-label>{{ translate("Nearest limit") }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-card-header>
      <ion-card-content v-if="facilityOrders.length">
        <div class="bar-chart">
          <div class="bar-row" v-for="facility in sortedFacilityOrders" :key="facility.facilityId">
            <ion-label class="bar-label">{{ facility.facilityName }}</ion-label>
            <ion-progress-bar :value="barWidth(facility) / 100" :color="facility.utilization >= 100 ? 'danger' : 'primary'" class="bar-progress" />
            <ion-note class="bar-value">
              <template v-if="facility.maximumOrderLimit != null">{{ facility.orderCount }}/{{ facility.maximumOrderLimit }}</template>
              <template v-else>{{ facility.orderCount }}/{{ "∞" }}</template>
            </ion-note>
          </div>
        </div>
      </ion-card-content>
      <ion-card-content v-else>
        <p>{{ translate("No facility orders found") }}</p>
      </ion-card-content>
    </ion-card>

    <!-- Sourcing rules -->
    <ion-card>
      <ion-card-header>
        <div class="card-head">
          <ion-card-title>{{ translate("Sourcing rules") }}</ion-card-title>
          <ion-note slot="end">{{ totalSourcing }}</ion-note>
        </div>
      </ion-card-header>
      <ion-list lines="full">
        <ion-item v-for="s in sourcing" :key="s.key" button :detail="true" @click="emit('navigate', s.route)">
          <ion-label class="ion-text-wrap">
            {{ translate(s.label) }}
            <p>{{ metricLine(s) }}</p>
          </ion-label>
          <ion-note slot="end">{{ s.count }}</ion-note>
        </ion-item>
      </ion-list>
    </ion-card>

    <!-- Inventory channels + publish jobs -->
    <ion-card button @click="emit('navigate', '/inventory-channels')">
      <ion-card-header>
        <div class="card-head">
          <ion-card-title>{{ translate("Inventory channels") }}</ion-card-title>
          <ion-note slot="end">{{ foundations.channels }}</ion-note>
        </div>
      </ion-card-header>
      <ion-list lines="full" v-if="channels.length">
        <ion-item v-for="channel in channels" :key="channel.facilityGroupId">
          <ion-label>{{ channel.facilityGroupName || channel.facilityGroupId }}</ion-label>
          <ion-icon slot="end" :icon="isChannelRunning(channel) ? playOutline : pauseOutline" color="medium" />
        </ion-item>
      </ion-list>
      <ion-card-content v-else>
        <p>{{ translate("No inventory channels yet") }}</p>
      </ion-card-content>
    </ion-card>
  </main>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonIcon, IonItem, IonLabel, IonList, IonNote, IonProgressBar, IonSegment, IonSegmentButton, IonText } from "@ionic/vue";
import { computed, ref } from "vue";
import { pauseOutline, playOutline, timeOutline } from "ionicons/icons";
import { commonUtil, translate } from "@common";
import type { BrokeringState, FacilityOrder } from "@/store/dashboardStore";
import { DateTime } from "luxon";

const sortMode = ref("orders");

const props = defineProps<{
  brokering: BrokeringState;
  facilityOrders: FacilityOrder[];
  facilityOrdersDate: string | null;
  sourcing: { key: string; label: string; route: string; metric: string; count: number; total: number; blocking: number }[];
  foundations: { channels: number };
  channels: any[];
  channelJobs: any[];
  totalSourcing: number;
}>();

const sortedFacilityOrders = computed(() => {
  const list = [...props.facilityOrders];
  if (sortMode.value === "utilization") {
    list.sort((a, b) => {
      if (b.utilization !== a.utilization) return b.utilization - a.utilization;
      return b.orderCount - a.orderCount;
    });
  } else {
    list.sort((a, b) => b.orderCount - a.orderCount);
  }
  return list;
});

const facilityOrdersIsToday = computed(() => DateTime.now().toFormat("yyyy-MM-dd") === props.facilityOrdersDate)

function barWidth(facility: FacilityOrder) {
  if (facility.maximumOrderLimit != null && facility.maximumOrderLimit > 0) {
    return Math.min(100, facility.utilization);
  }
  const max = props.facilityOrders.reduce((m, f) => Math.max(m, f.orderCount), 0);
  return max > 0 ? (facility.orderCount / max) * 100 : 0;
}

const emit = defineEmits<{ (e: "navigate", path: string): void }>();

const lastGroupRunBrokerRate = computed(() => {
  const run = props.brokering.lastGroupRun;
  if (!run || !run.orderItemCount) return 0;
  return Math.round((run.brokeredItemCount / run.orderItemCount) * 100);
});

const oldestQueuedAge = computed(() => {
  const orderDate = props.brokering.oldestQueued?.orderDate;
  return orderDate ? commonUtil.getRelativeTime(orderDate) : "";
});

const TYPE_LABELS: Record<string, string> = {
  CHANNEL_FAC_GROUP: "Channels",
  PICKUP: "Store pickup",
  SHIPPING: "Shipping",
  WAREHOUSE: "Warehouse",
  FACILITY_GROUP: "Generic",
  FULFILLMENT: "Fulfillment"
};

function typeLabel(t: string) {
  return TYPE_LABELS[t] ? translate(TYPE_LABELS[t]) : t;
}

function metricLine(s: { metric: string; total: number; blocking: number }) {
  if (s.metric === "threshold") return translate("{count} units held back", { count: s.total });
  if (s.metric === "safetyStock") return translate("{count} units reserved", { count: s.total });
  if (s.metric === "pickup") return translate("{count} blocking pickup", { count: s.blocking });
  if (s.metric === "shipping") return translate("{count} blocking shipping", { count: s.blocking });
  return "";
}

function isChannelRunning(channel: any) {
  return props.channelJobs.some((job: any) => {
    const runtimeData = getJobRuntimeData(job);
    const facilityGroupId = runtimeData?.facilityGroupId || job.facilityGroupId;
    return facilityGroupId === channel.facilityGroupId && job.statusId === "SERVICE_PENDING";
  });
}

function getJobRuntimeData(job: any) {
  if (typeof job.runtimeData !== "string") return job.runtimeData;
  try {
    return JSON.parse(job.runtimeData || "{}");
  } catch {
    return {};
  }
}

</script>

<style scoped>
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacer-sm);
  padding: var(--spacer-base);
  align-items: start;
}

.card-head {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
}

.card-head ion-note {
  margin-inline-start: auto;
}

.brokering-stats .metric {
  padding-inline: var(--spacer-sm);
}

.brokering-stats .groups {
  padding-inline: var(--spacer-sm);
  
}

.metric-unit {
  font-size: 0.5em;
  font-weight: normal;
}

.metric-label {
  margin: 0;
}

.stat-list {
  margin: var(--spacer-xs) 0;
  padding: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-2xs);
  margin-top: var(--spacer-xs);
}

.sub {
  display: flex;
  align-items: center;
  gap: var(--spacer-2xs);
  margin: var(--spacer-xs) 0 0;
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: grid;
  grid-template-columns: 120px 1fr 40px;
  align-items: center;
  gap: 8px;
}

.bar-label {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-progress {
  height: 12px;
  border-radius: 6px;
}

.bar-value {
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
</style>
