<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ translate("Brokering Runs") }}</ion-title>
        <ion-buttons slot="end" v-if="userProfile?.stores?.length > 1">
          <ion-item lines="none" class="store-selector">
            <ion-label position="stacked">{{ translate("Product Store") }}</ion-label>
            <ion-select :value="currentEComStore.productStoreId" @ionChange="setEComStore($event)" interface="popover">
              <ion-select-option v-for="store in userProfile.stores" :key="store.productStoreId" :value="store.productStoreId">
                {{ store.storeName || store.productStoreId }}
              </ion-select-option>
            </ion-select>
          </ion-item>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-no-scroll">
      <div class="main-container">
        <!-- Horizontal Run List -->
        <div class="run-list-container">
          <ion-card class="run-list-card create-card pointer" @click="addNewRun">
            <ion-icon :icon="addOutline" size="large" />
            <ion-label>{{ translate("New Run") }}</ion-label>
          </ion-card>
          
          <ion-card 
            v-for="group in brokeringGroups" 
            :key="group.routingGroupId" 
            class="run-list-card pointer"
            :class="{ 'active-run': group.schedule?.paused === 'N', 'draft-run': group.schedule?.paused !== 'N' }"
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

        <!-- Filter Bar -->
        <div class="top-bar">
          <div class="filter-group">
            <ion-chip :outline="selectedFilter !== 'all'" @click="selectedFilter = 'all'" size="small">
              <ion-label>{{ translate("All") }}</ion-label>
            </ion-chip>
            <ion-chip :outline="selectedFilter !== 'active'" @click="selectedFilter = 'active'" size="small">
              <ion-label>{{ translate("Active") }}</ion-label>
            </ion-chip>
            <ion-chip :outline="selectedFilter !== 'draft'" @click="selectedFilter = 'draft'" size="small">
              <ion-label>{{ translate("Draft") }}</ion-label>
            </ion-chip>
          </div>
          <div class="legend ion-hide-sm-down">
            <span class="legend-item"><span class="dot active"></span> {{ translate("Active") }}</span>
            <span class="legend-item"><span class="dot draft"></span> {{ translate("Draft") }}</span>
            <span class="legend-item"><span class="line-sample"></span> {{ translate("High Frequency") }}</span>
          </div>
        </div>

        <div v-if="isLoading" class="loader">
          <ion-spinner name="crescent" />
        </div>

        <div v-else-if="filteredBrokeringGroups.length" class="calendar-wrapper">
          <div class="calendar-grid">
            <!-- Grid Header: Days -->
            <div class="grid-header">
              <div class="time-column-header"></div>
              <div v-for="day in days" :key="day" class="day-column-header">
                {{ translate(day.substring(0, 3)) }}
              </div>
            </div>

            <!-- Grid Body: Hour Rows (Fills remaining height) -->
            <div class="grid-body">
              <div v-for="hour in 24" :key="hour - 1" class="hour-row">
                <div class="hour-label">
                  {{ (hour - 1).toString().padStart(2, '0') }}
                </div>
                <div v-for="(day, dayIndex) in 7" :key="dayIndex" class="day-cell">
                  <!-- Render pulse lines for high-frequency runs -->
                  <div class="interval-container">
                     <div 
                      v-for="group in getIntervalGroupsForSlot(dayIndex + 1, hour - 1)" 
                      :key="'int-' + group.routingGroupId" 
                      class="run-interval-line"
                      :class="group.schedule?.paused === 'N' ? 'active' : 'draft'"
                      @click="redirect(group)"
                      :title="group.groupName + ' (High Frequency)'"
                    ></div>
                  </div>

                  <!-- Render regular blocks for single runs -->
                  <div class="blocks-container">
                    <div 
                      v-for="group in getSingleGroupsForSlot(dayIndex + 1, hour - 1)" 
                      :key="group.routingGroupId" 
                      class="run-block"
                      :class="group.schedule?.paused === 'N' ? 'active' : 'draft'"
                      @click="redirect(group)"
                      :title="group.groupName"
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
            <ion-icon slot="end" :icon="addOutline"></ion-icon>
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import emitter from "@/event-bus";
import { translate } from "@/i18n";
import { Group } from "@/types";
import { showToast } from "@/utils";
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
  IonPage, 
  IonSelect, 
  IonSelectOption,
  IonSpinner, 
  IonTitle, 
  IonToolbar, 
  alertController, 
  onIonViewWillEnter
} from "@ionic/vue";
import { addOutline } from "ionicons/icons"
import { DateTime } from "luxon";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import cronstrue from 'cronstrue';
import parser from 'cron-parser';

const store = useStore()
const router = useRouter()
const groups = computed(() => store.getters["orderRouting/getRoutingGroups"])
const userProfile = computed(() => store.getters["user/getUserProfile"])
const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])

const cronExpressions = JSON.parse(process.env?.VUE_APP_CRON_EXPRESSIONS)
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

let isLoading = ref(false)
let brokeringGroups = ref([]) as any
let selectedFilter = ref('all')
// Map: day (1-7) -> hour (0-23) -> { interval: Group[], single: Group[] }
let weeklySchedule = ref<any>({})

onIonViewWillEnter(async () => {
  isLoading.value = true
  await store.dispatch("orderRouting/fetchOrderRoutingGroups");
  isLoading.value = false
  brokeringGroups.value = sortGroups(JSON.parse(JSON.stringify(groups.value)))
  computeWeeklySchedule()
  store.dispatch("util/fetchEnums", { parentTypeId: "ORDER_ROUTING" })
})

const filteredBrokeringGroups = computed(() => {
  if (selectedFilter.value === 'active') {
    return brokeringGroups.value.filter((group: any) => group.schedule?.paused === 'N')
  } else if (selectedFilter.value === 'draft') {
    return brokeringGroups.value.filter((group: any) => group.schedule?.paused === 'Y' || !group.schedule)
  }
  return brokeringGroups.value
})

function sortGroups(groups: any[]) {
  return groups.sort((a: any, b: any) => {
    const aActive = a.schedule?.paused === 'N';
    const bActive = b.schedule?.paused === 'N';
    
    // 1. Active first
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // Both are same status (both Active or both Draft)
    // If Draft, prioritize those with Cron Logic
    if (!aActive && !bActive) {
      const aHasCron = !!a.schedule?.cronExpression;
      const bHasCron = !!b.schedule?.cronExpression;
      if (aHasCron && !bHasCron) return -1;
      if (!aHasCron && bHasCron) return 1;
    }

    // Tie-Breaker: Name or ID
    return (a.groupName || '').localeCompare(b.groupName || '');
  });
}

watch(filteredBrokeringGroups, () => {
  computeWeeklySchedule()
})

function computeWeeklySchedule() {
  const schedule: any = {}
  
  // Initialize schedule map
  for (let d = 1; d <= 7; d++) {
    schedule[d] = {}
    for (let h = 0; h < 24; h++) {
      schedule[d][h] = { interval: [], single: [], counts: {} }
    }
  }

  const now = DateTime.now();
  const startOfWeek = now.startOf('week');
  const endOfWeek = now.endOf('week');

  filteredBrokeringGroups.value.forEach((group: any) => {
    // console.log("Checking group:", group.groupName, "Has Schedule:", !!group.schedule, "Cron:", group.schedule?.cronExpression);
    if (group.schedule && group.schedule.cronExpression) {
      try {
        const interval = parser.parseExpression(group.schedule.cronExpression, {
          currentDate: startOfWeek.toJSDate(),
          endDate: endOfWeek.toJSDate(),
          iterator: true
        });

        // Track occurrences per hour for this group to decide if it's high freq
        const groupOccurrences: Record<string, number> = {}; 
        let iterator = interval.next();
        
        while (!iterator.done) {
          try {
            const dt = DateTime.fromJSDate(iterator.value.toDate());
            const key = `${dt.weekday}-${dt.hour}`;
            
            if (!groupOccurrences[key]) groupOccurrences[key] = 0;
            groupOccurrences[key]++;
            
            iterator = interval.next();
          } catch (e) {
            break; 
          }
        }

        // Now populate the schedule based on counts
        Object.keys(groupOccurrences).forEach(key => {
          const [day, hour] = key.split('-').map(Number);
          const count = groupOccurrences[key];
          
          if (schedule[day] && schedule[day][hour]) {
            // Threshold: if > 1 occurrence per hour, treat as interval/pulse
            if (count > 1) {
              schedule[day][hour].interval.push(group);
            } else {
              schedule[day][hour].single.push(group);
            }
          }
        });

      } catch (err) {
        console.error("Error parsing cron", group.cronExpression, err);
      }
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
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save"),
      handler: (data) => {
        if(!data.runName?.trim().length) {
          showToast(translate("Please enter a valid name"))
          return false;
        }
      }
    }],
    inputs: [{
      name: "runName",
      placeholder: translate("run name")
    }]
  })

  newRunAlert.onDidDismiss().then(async (result: any) => {
    if(result.role) return;
    if(result.data?.values?.runName.trim()) {
      await store.dispatch("orderRouting/createRoutingGroup", result.data.values.runName.trim())
      brokeringGroups.value = sortGroups(JSON.parse(JSON.stringify(groups.value)))
      computeWeeklySchedule()
    }
  })

  return newRunAlert.present();
}

async function setEComStore(event: any) {
  emitter.emit("presentLoader")
  await store.dispatch("user/setEcomStore", {
    "productStoreId": event.detail.value
  })
  await store.dispatch("orderRouting/fetchOrderRoutingGroups");
  brokeringGroups.value = sortGroups(JSON.parse(JSON.stringify(groups.value)))
  computeWeeklySchedule()
  emitter.emit("dismissLoader")
}

function getScheduleFrequency(brokeringGroupObj: any) {
  let description: any = "";
  description = Object.keys(cronExpressions).find(key => cronExpressions[key] === brokeringGroupObj.cronExpression);

  if (!description && brokeringGroupObj.cronExpression) {
    description = cronstrue.toString(brokeringGroupObj.cronExpression);
    if (/^[a-z]/.test(description)) {
      description = description.charAt(0).toUpperCase() + description.slice(1);
    }
  }
  return description || "-";
}

function redirect(group: Group) {
  router.push(`brokering/${group.routingGroupId}/routes`)
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
  pointer-events: none; /* Let clicks pass through if needed, but lines themselves capture clicks */
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

.store-selector {
  --padding-start: 0;
  --inner-padding-end: 0;
  max-width: 200px;
}

.store-selector ion-select {
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .calendar-wrapper {
    overflow-x: auto;
  }
}
</style>
