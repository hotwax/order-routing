<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Brokering runs calendar") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button color="primary" @click="addNewRun">
            {{ translate("New Run") }}
            <ion-icon :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-no-scroll">
      <div class="main-container">
        <!-- Horizontal run list -->
        <div class="run-list-container">
          <ion-card class="run-list-card create-card pointer" button @click="addNewRun">
            <ion-icon :icon="addOutline" size="large" />
            <ion-label>{{ translate("New Run") }}</ion-label>
          </ion-card>

          <ion-card
            v-for="group in brokeringGroups"
            :key="group.routingGroupId"
            class="run-list-card pointer"
            button
            @click="redirect(group)"
          >
            <ion-item lines="none" class="run-list-item">
              <ion-label>
                <h3>{{ group.groupName }}</h3>
                <p>{{ group.schedule ? getScheduleFrequency(group.schedule) : "-" }}</p>
              </ion-label>
              <ion-badge slot="end" :color="group.schedule?.paused === 'N' ? 'primary' : 'medium'">
                {{ group.schedule?.paused === 'N' ? translate("Active") : translate("Draft") }}
              </ion-badge>
            </ion-item>
          </ion-card>
        </div>

        <!-- Filter bar -->
        <div class="top-bar">
          <div class="filter-group">
            <ion-chip :outline="selectedFilter !== 'all'" @click="selectedFilter = 'all'">
              <ion-label>{{ translate("All") }}</ion-label>
            </ion-chip>
            <ion-chip :outline="selectedFilter !== 'active'" @click="selectedFilter = 'active'">
              <ion-label>{{ translate("Active") }}</ion-label>
            </ion-chip>
            <ion-chip :outline="selectedFilter !== 'draft'" @click="selectedFilter = 'draft'">
              <ion-label>{{ translate("Draft") }}</ion-label>
            </ion-chip>
          </div>
          <div class="legend ion-hide-sm-down">
            <span class="legend-item"><span class="dot active" /> {{ translate("Active") }}</span>
            <span class="legend-item"><span class="dot draft" /> {{ translate("Draft") }}</span>
            <span class="legend-item"><span class="line-sample" /> {{ translate("High frequency") }}</span>
          </div>
        </div>

        <div v-if="isLoading" class="loader">
          <ion-spinner name="crescent" />
        </div>

        <div v-else-if="filteredBrokeringGroups.length" class="calendar-wrapper">
          <div class="calendar-grid">
            <!-- Header: days -->
            <div class="grid-header">
              <div class="time-column-header" />
              <div v-for="day in days" :key="day" class="day-column-header">
                {{ translate(day.substring(0, 3)) }}
              </div>
            </div>

            <!-- Body: hour rows -->
            <div class="grid-body">
              <div v-for="hour in 24" :key="hour - 1" class="hour-row">
                <div class="hour-label">
                  {{ (hour - 1).toString().padStart(2, '0') }}
                </div>
                <div v-for="(day, dayIndex) in 7" :key="dayIndex" class="day-cell">
                  <!-- Pulse lines for high-frequency runs -->
                  <div class="interval-container">
                    <div
                      v-for="group in getIntervalGroupsForSlot(dayIndex + 1, hour - 1)"
                      :key="'int-' + group.routingGroupId"
                      class="run-interval-line"
                      :class="group.schedule?.paused === 'N' ? 'active' : 'draft'"
                      :title="group.groupName + ' (' + translate('High frequency') + ')'"
                      @click="redirect(group)"
                    />
                  </div>

                  <!-- Blocks for single runs -->
                  <div class="blocks-container">
                    <div
                      v-for="group in getSingleGroupsForSlot(dayIndex + 1, hour - 1)"
                      :key="group.routingGroupId"
                      class="run-block"
                      :class="group.schedule?.paused === 'N' ? 'active' : 'draft'"
                      :title="group.groupName"
                      @click="redirect(group)"
                    >
                      <span class="run-name">{{ group.groupName }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <p>{{ translate("No brokering runs found.") }}</p>
          <ion-button fill="outline" @click="addNewRun">
            {{ translate("Create run") }}
            <ion-icon slot="end" :icon="addOutline" />
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  alertController,
  onIonViewWillEnter,
  onIonViewWillLeave
} from "@ionic/vue";
import { addOutline } from "ionicons/icons";
import { computed, ref, watch } from "vue";
import { DateTime } from "luxon";
import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";
import router from "@/router";
import { commonUtil, emitter, logger, translate } from "@common";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { useUtilStore } from "@/store/utilStore";
import { Group } from "@/types";

const utilStore = useUtilStore();
const groups = computed(() => orderRoutingStore().getRoutingGroups);

const cronExpressions = JSON.parse(import.meta.env?.VITE_CRON_EXPRESSIONS);
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const isLoading = ref(false);
const brokeringGroups = ref([]) as any;
const selectedFilter = ref("all");
// Map: day (1-7) -> hour (0-23) -> { interval: Group[], single: Group[] }
const weeklySchedule = ref<any>({});

onIonViewWillEnter(async () => {
  await fetchRuns();
  emitter.on("productStoreOrConfigChanged", fetchRuns);
});

onIonViewWillLeave(() => {
  emitter.off("productStoreOrConfigChanged", fetchRuns);
});

async function fetchRuns() {
  isLoading.value = true;
  await orderRoutingStore().fetchOrderRoutingGroups();
  isLoading.value = false;
  brokeringGroups.value = sortGroups(JSON.parse(JSON.stringify(groups.value)));
  computeWeeklySchedule();
  utilStore.fetchEnums({ parentTypeId: "ORDER_ROUTING" });
}

const filteredBrokeringGroups = computed(() => {
  if (selectedFilter.value === "active") {
    return brokeringGroups.value.filter((group: any) => group.schedule?.paused === "N");
  } else if (selectedFilter.value === "draft") {
    return brokeringGroups.value.filter((group: any) => group.schedule?.paused === "Y" || !group.schedule);
  }
  return brokeringGroups.value;
});

function sortGroups(list: any[]) {
  return list.sort((a: any, b: any) => {
    const aActive = a.schedule?.paused === "N";
    const bActive = b.schedule?.paused === "N";

    // Active runs first.
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // Among drafts, prioritise those with a cron schedule.
    if (!aActive && !bActive) {
      const aHasCron = !!a.schedule?.cronExpression;
      const bHasCron = !!b.schedule?.cronExpression;
      if (aHasCron && !bHasCron) return -1;
      if (!aHasCron && bHasCron) return 1;
    }

    return (a.groupName || "").localeCompare(b.groupName || "");
  });
}

watch(filteredBrokeringGroups, () => {
  computeWeeklySchedule();
});

function computeWeeklySchedule() {
  const schedule: any = {};
  for (let d = 1; d <= 7; d++) {
    schedule[d] = {};
    for (let h = 0; h < 24; h++) {
      schedule[d][h] = { interval: [], single: [] };
    }
  }

  const now = DateTime.now();
  const startOfWeek = now.startOf("week");
  const endOfWeek = now.endOf("week");

  filteredBrokeringGroups.value.forEach((group: any) => {
    if (!group.schedule?.cronExpression) return;
    try {
      const interval = CronExpressionParser.parse(group.schedule.cronExpression, {
        currentDate: startOfWeek.toJSDate(),
        endDate: endOfWeek.toJSDate()
      });

      // Count occurrences per day+hour to decide single vs high-frequency.
      const groupOccurrences: Record<string, number> = {};
      while (interval.hasNext()) {
        const dt = DateTime.fromJSDate(interval.next().toDate());
        const key = `${dt.weekday}-${dt.hour}`;
        groupOccurrences[key] = (groupOccurrences[key] || 0) + 1;
      }

      Object.keys(groupOccurrences).forEach((key) => {
        const [day, hour] = key.split("-").map(Number);
        if (!schedule[day]?.[hour]) return;
        // More than one run in the same hour reads as a high-frequency pulse.
        if (groupOccurrences[key] > 1) {
          schedule[day][hour].interval.push(group);
        } else {
          schedule[day][hour].single.push(group);
        }
      });
    } catch (err) {
      logger.error("calendar: failed to parse cron", group.schedule?.cronExpression, err);
    }
  });

  weeklySchedule.value = schedule;
}

function getIntervalGroupsForSlot(dayOfWeek: number, hour: number) {
  return weeklySchedule.value[dayOfWeek]?.[hour]?.interval || [];
}

function getSingleGroupsForSlot(dayOfWeek: number, hour: number) {
  return weeklySchedule.value[dayOfWeek]?.[hour]?.single || [];
}

async function addNewRun() {
  const newRunAlert = await alertController.create({
    header: translate("New Run"),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      {
        text: translate("Save"),
        handler: (data) => {
          if (!data.runName?.trim().length) {
            commonUtil.showToast(translate("Please enter a valid name"));
            return false;
          }
        }
      }
    ],
    inputs: [{ name: "runName", placeholder: translate("run name") }]
  });

  newRunAlert.onDidDismiss().then(async (result: any) => {
    if (result.role) return;
    if (result.data?.values?.runName.trim()) {
      await orderRoutingStore().createRoutingGroup(result.data.values.runName.trim());
      brokeringGroups.value = sortGroups(JSON.parse(JSON.stringify(groups.value)));
      computeWeeklySchedule();
    }
  });

  return newRunAlert.present();
}

function getScheduleFrequency(schedule: any) {
  let description: any = Object.keys(cronExpressions).find((key) => cronExpressions[key] === schedule.cronExpression);

  if (!description && schedule.cronExpression) {
    description = cronstrue.toString(schedule.cronExpression);
    if (/^[a-z]/.test(description)) {
      description = description.charAt(0).toUpperCase() + description.slice(1);
    }
  }
  return description || "-";
}

function redirect(group: Group) {
  router.push(`brokering/${group.routingGroupId}/routes`);
}
</script>

<style scoped>
.main-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.run-list-container {
  display: flex;
  overflow-x: auto;
  padding: 8px 16px;
  gap: 16px;
  background: var(--ion-background-color);
  border-bottom: 1px solid var(--ion-color-step-150);
  flex-shrink: 0;
}

.run-list-card {
  min-width: 250px;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.create-card {
  min-width: 120px;
  align-items: center;
  color: var(--ion-color-medium);
}

.run-list-item {
  width: 100%;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px;
  background: var(--ion-background-color);
  border-bottom: 1px solid var(--ion-color-step-150);
  flex-shrink: 0;
}

.filter-group {
  display: flex;
  gap: 4px;
}

.legend {
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.line-sample {
  width: 2px;
  height: 12px;
  background: var(--ion-color-primary);
  display: inline-block;
}

.dot.active { background: var(--ion-color-primary); }
.dot.draft { background: var(--ion-color-medium); }

.calendar-wrapper {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.calendar-grid {
  display: flex;
  flex-direction: column;
  min-width: 800px;
  height: 100%;
}

.grid-header {
  display: flex;
  background: var(--ion-color-light);
  border-bottom: 1px solid var(--ion-color-step-200);
}

.time-column-header {
  width: 40px;
  flex-shrink: 0;
}

.day-column-header {
  flex: 1;
  padding: 8px 4px;
  text-align: center;
  font-weight: bold;
  font-size: 0.8rem;
  border-left: 1px solid var(--ion-color-step-150);
}

.grid-body {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.hour-row {
  display: flex;
  flex: 1;
  min-height: 20px;
  border-bottom: 1px solid var(--ion-color-step-50);
}

.hour-label {
  width: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-light);
  font-size: 0.7rem;
  font-weight: bold;
  border-right: 1px solid var(--ion-color-step-200);
}

.day-cell {
  flex: 1;
  display: flex;
  position: relative;
  border-left: 1px solid var(--ion-color-step-100);
  background: var(--ion-background-color);
  padding: 1px;
}

.interval-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  z-index: 0;
}

.run-interval-line {
  width: 4px;
  height: 100%;
  margin: 0 1px;
  border-radius: 2px;
  cursor: pointer;
  pointer-events: auto;
}

.run-interval-line.active {
  background: var(--ion-color-primary);
  opacity: 0.5;
}

.run-interval-line.draft {
  background: var(--ion-color-medium);
  opacity: 0.3;
}

.blocks-container {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  width: 100%;
  z-index: 1;
}

.run-block {
  flex: 1;
  min-width: 40px;
  height: 100%;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  overflow: hidden;
  transition: opacity 0.2s;
}

.run-block:hover {
  opacity: 0.8;
}

.run-block.active {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.run-block.draft {
  background: var(--ion-color-medium);
  color: var(--ion-color-medium-contrast);
}

.run-name {
  font-size: 0.65rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 100%;
}

.loader {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ion-color-medium);
}

@media (max-width: 768px) {
  .calendar-wrapper {
    overflow-x: auto;
  }
}
</style>
