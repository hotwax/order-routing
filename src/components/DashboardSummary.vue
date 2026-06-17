<template>
  <main class="dashboard">
    <!-- Brokering runs -->
    <ion-card button @click="emit('navigate', '/brokering')">
      <ion-card-header>
        <div class="card-head">
          <ion-icon :icon="shuffleOutline" />
          <ion-card-title>{{ translate("Brokering runs") }}</ion-card-title>
        </div>
      </ion-card-header>
      <ion-card-content>
        <h1 class="metric">{{ brokering.total }}</h1>
        <div class="chips">
          <ion-chip outline color="success"><ion-label>{{ brokering.scheduled }} {{ translate("scheduled") }}</ion-label></ion-chip>
          <ion-chip outline color="medium" v-if="brokering.paused"><ion-label>{{ brokering.paused }} {{ translate("paused") }}</ion-label></ion-chip>
          <ion-chip outline color="medium" v-if="brokering.draft"><ion-label>{{ brokering.draft }} {{ translate("draft") }}</ion-label></ion-chip>
          <ion-chip outline color="danger" v-if="brokering.errorCount">
            <ion-icon :icon="alertCircleOutline" />
            <ion-label>{{ brokering.errorCount }} {{ translate("with errors") }}</ion-label>
          </ion-chip>
        </div>
        <ion-text color="medium">
          <p class="sub">
            <ion-icon :icon="timeOutline" />
            {{ brokering.nextRun ? (translate("Next run") + ": " + commonUtil.getDateAndTime(brokering.nextRun)) : translate("No upcoming runs") }}
          </p>
        </ion-text>
      </ion-card-content>
    </ion-card>

    <!-- Sourcing rules -->
    <ion-card>
      <ion-card-header>
        <div class="card-head">
          <ion-icon :icon="optionsOutline" />
          <ion-card-title>{{ translate("Sourcing rules") }}</ion-card-title>
          <ion-note slot="end">{{ totalSourcing }}</ion-note>
        </div>
      </ion-card-header>
      <ion-list lines="full">
        <ion-item v-for="s in sourcing" :key="s.key" button :detail="true" @click="emit('navigate', s.route)">
          <ion-label class="ion-text-wrap">
            <h2>{{ translate(s.label) }}</h2>
            <p>{{ metricLine(s) }}</p>
          </ion-label>
          <ion-note slot="end">{{ s.count }}</ion-note>
        </ion-item>
      </ion-list>
    </ion-card>

    <!-- Facility groups -->
    <ion-card button @click="emit('navigate', '/facility-groups')">
      <ion-card-header>
        <div class="card-head">
          <ion-icon :icon="businessOutline" />
          <ion-card-title>{{ translate("Facility groups") }}</ion-card-title>
        </div>
      </ion-card-header>
      <ion-card-content>
        <h1 class="metric">{{ foundations.facilityGroups }}</h1>
        <div class="chips">
          <ion-chip outline color="medium" v-for="(n, t) in foundations.facilityGroupsByType" :key="t">
            <ion-label>{{ typeLabel(String(t)) }}: {{ n }}</ion-label>
          </ion-chip>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Inventory channels + publish jobs -->
    <ion-card button @click="emit('navigate', '/inventory-channels')">
      <ion-card-header>
        <div class="card-head">
          <ion-icon :icon="globeOutline" />
          <ion-card-title>{{ translate("Inventory channels") }}</ion-card-title>
        </div>
      </ion-card-header>
      <ion-card-content>
        <h1 class="metric">{{ foundations.channels }}</h1>
        <ion-text color="medium">
          <p class="sub">
            <ion-icon :icon="cloudUploadOutline" />
            {{ jobs.total }} {{ translate("publish jobs") }}<span v-if="jobs.running"> · {{ jobs.running }} {{ translate("running") }}</span>
          </p>
        </ion-text>
      </ion-card-content>
    </ion-card>
  </main>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonIcon, IonItem, IonLabel, IonList, IonNote, IonText } from "@ionic/vue";
import { alertCircleOutline, businessOutline, cloudUploadOutline, globeOutline, optionsOutline, shuffleOutline, timeOutline } from "ionicons/icons";
import { commonUtil, translate } from "@common";

const props = defineProps<{
  brokering: { total: number; scheduled: number; paused: number; draft: number; nextRun: number | null; errorCount: number };
  sourcing: { key: string; label: string; route: string; metric: string; count: number; total: number; blocking: number }[];
  foundations: { facilityGroups: number; facilityGroupsByType: Record<string, number>; channels: number };
  jobs: { total: number; running: number };
  totalSourcing: number;
}>();

const emit = defineEmits<{ (e: "navigate", path: string): void }>();

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
  if (s.metric === "threshold") return `${s.total} ${translate("units held back")}`;
  if (s.metric === "safetyStock") return `${s.total} ${translate("units reserved")}`;
  if (s.metric === "pickup") return `${s.blocking} ${translate("blocking pickup")}`;
  if (s.metric === "shipping") return `${s.blocking} ${translate("blocking shipping")}`;
  return "";
}
</script>

<style scoped>
.dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacer-base);
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

.metric {
  margin: 0;
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
</style>
