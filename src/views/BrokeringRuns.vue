<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ translate("Brokering Runs") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :aria-label="translate('Open brokering runs assistant')" @click="openAssistant">
            <ion-icon slot="icon-only" :icon="sparklesOutline" />
          </ion-button>
          <ion-button color="primary" @click="addNewRun">
            {{ translate("New Run") }}
            <ion-icon :icon="addOutline" />
          </ion-button>
        </ion-buttons>
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

    <ion-content>
      <!-- Adding find class only when we are displaying product stores, as adding this class takes specific space on page -->
      <div :class="ecomStores.length > 1 ? 'find' : ''">
        <aside class="filters" v-if="ecomStores.length > 1">
          <ion-list>
            <ion-list-header>{{ translate("Product Store") }}</ion-list-header>
            <ion-radio-group :value="currentEComStore.productStoreId" @ionChange="setEComStore($event)">
              <ion-item v-for="store in ecomStores" :key="store.productStoreId" lines="none">
                <ion-radio :value="store.productStoreId">{{ store.storeName || store.productStoreId }}</ion-radio>
              </ion-item>
            </ion-radio-group>
          </ion-list>
        </aside>

        <main v-if="isLoading">
          <ion-item lines="none">
            <ion-spinner name="crescent" slot="start" />
            {{ translate("Fetching runs") }}
          </ion-item>
        </main>
        <main v-else-if="brokeringGroups.length">
          <section>
            <ion-card class="pointer" v-for="group in brokeringGroups" :key="group.routingGroupId" @click="redirect(group)">
              <ion-item>
                <ion-label>
                  <h1>{{ group.groupName }}</h1>
                  <p>{{ commonUtil.getDateAndTime(group.createdDate) }}</p>
                </ion-label>
              </ion-item>
              <ion-item v-if="group.description">
                <ion-label>
                  {{ group.description }}
                </ion-label>
              </ion-item>
              <ion-item v-if="group.schedule?.paused === 'N'">
                <ion-label>
                  {{ group.schedule ? commonUtil.getDateAndTime(group.schedule.nextExecutionDateTime) : "-" }}
                  <p>{{ group.schedule ? getScheduleFrequency(group.schedule) : "-" }}</p>
                </ion-label>
                <ion-badge slot="end" color="dark">
                  {{ group.schedule ? commonUtil.getRelativeTime(group.schedule.nextExecutionDateTime) : "-" }}
                </ion-badge>
              </ion-item>
              <ion-item v-else>
                <!-- TODO: display lastRunTime, but as we are not getting the same in response, so displaying nextExecutionTime for now -->
                <ion-label>
                  {{ group.schedule ? commonUtil.getDateAndTime(group.schedule.nextExecutionDateTime) : "-" }}
                </ion-label>
                <ion-badge slot="end" color="medium">{{ translate("Draft") }}</ion-badge>
              </ion-item>
              <ion-item lines="none">
                {{ `Updated at ${commonUtil.getDateAndTime(group.lastUpdatedStamp)}` }}
                <ion-button size="default" fill="clear" color="medium" slot="end" @click.stop="groupActionsPopover(group, $event)">
                  <ion-icon slot="icon-only" :icon="ellipsisVerticalOutline" />
                </ion-button>
              </ion-item>
            </ion-card>
          </section>
        </main>
        <main v-else>
          <div class="empty-block">
            <EmptyState
              :image="brokeringRunsEmptyImage"
              :title="translate('No routing runs yet')"
              :message="translate('Create your first brokering run to define how orders are routed across facilities and inventory rules.')"
            >
              <template #actions>
                <ion-button @click="addNewRun">
                  {{ translate("Create brokering run") }}
                  <ion-icon slot="end" :icon="addOutline" />
                </ion-button>
              </template>
            </EmptyState>
          </div>
        </main>
      </div>
    </ion-content>

    <brokering-runs-assistant-modal :is-open="isAssistantOpen" @close="isAssistantOpen = false" />
  </ion-page>
</template>

<script setup lang="ts">
import EmptyState from "@/components/EmptyState.vue";
import GroupActionsPopover from "@/components/GroupActionsPopover.vue";
import BrokeringRunsAssistantModal from "@/components/BrokeringRunsAssistantModal.vue";
import { Group } from "@/types";
import { emitter, translate, commonUtil } from "@common";
import { IonBadge, IonButton, IonButtons, IonCard, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonRadioGroup, IonRadio, IonSpinner, IonTitle, IonToolbar, alertController, onIonViewWillEnter, popoverController } from "@ionic/vue";
import { addOutline, ellipsisVerticalOutline, sparklesOutline } from "ionicons/icons"
import cronstrue from "cronstrue";
import { computed, ref } from "vue";
import router from "@/router";
import { useUserStore } from "@/store/userStore";
import { productStore } from "@/store/productStore";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { useUtilStore } from "@/store/utilStore";

const userStore = useUserStore()
const utilStore = useUtilStore()
const groups = computed(() => orderRoutingStore().getRoutingGroups)
const userProfile = computed(() => userStore.getUserProfile)
const currentEComStore = computed(() => productStore().getCurrentEComStore)
const ecomStores = computed(() => productStore().ecomStores)

const cronExpressions = JSON.parse(import.meta.env?.VITE_CRON_EXPRESSIONS)
const brokeringRunsEmptyImage = new URL("../assets/images/BrokeringRunsEmptyState.png", import.meta.url).href

let isLoading = ref(false)
let brokeringGroups = ref([]) as any
let selectedFilter = ref('all')
const isAssistantOpen = ref(false)

function openAssistant() {
  isAssistantOpen.value = true
}
// Map: day (1-7) -> hour (0-23) -> { interval: Group[], single: Group[] }
let weeklySchedule = ref<any>({})

onIonViewWillEnter(async () => {
  isLoading.value = true
  await orderRoutingStore().clearCurrentGroup();
  await orderRoutingStore().fetchOrderRoutingGroups();
  isLoading.value = false
  brokeringGroups.value = JSON.parse(JSON.stringify(groups.value))
  utilStore.fetchEnums({ parentTypeId: "ORDER_ROUTING" })
})


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
          commonUtil.showToast(translate("Please enter a valid name"))
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
      await orderRoutingStore().createRoutingGroup(result.data.values.runName.trim())
      brokeringGroups.value = JSON.parse(JSON.stringify(groups.value))
    }
  })

  return newRunAlert.present();
}

async function setEComStore(event: any) {
  emitter.emit("presentLoader")
  if(ecomStores.value.length) {
      productStore().setEcomStore({
      "productStoreId": event.detail.value
    })
    await orderRoutingStore().fetchOrderRoutingGroups();
    brokeringGroups.value = JSON.parse(JSON.stringify(groups.value))
  }
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
.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacer-base);
  padding: var(--spacer-base) var(--spacer-base) var(--spacer-2xl);
}

@media (min-width: 991px) {
  main {
    display: flex;
    justify-content: center;
    align-items: start;
    gap: var(--spacer-2xl);
    max-width: 990px;
    margin: var(--spacer-base) auto 0;
  }
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
