<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/brokering" />
        </ion-buttons>
        <ion-title>{{ currentRoutingGroup.groupName }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div>
        <div>
          <ion-list>
            <ion-list-header>
              <ion-label>{{ translate("Order batches") }}</ion-label>
              <ion-button color="primary" fill="clear" @click="createOrderRoute">
                {{ translate("New") }}
                <ion-icon :icon="addCircleOutline" />
              </ion-button>
            </ion-list-header>
            <ion-reorder-group @ionItemReorder="doReorder($event)" :disabled="false">
              <ion-card class="pointer" v-for="(routing, index) in routingsForReorder" :key="routing.orderRoutingId" @click.prevent="redirect(routing)">
                <ion-item lines="full">
                  <ion-label>
                    <h1>{{ routing.routingName }}</h1>
                  </ion-label>
                  <ion-reorder>
                    <ion-chip outline>
                      <ion-label>{{ `${index + 1}/${routingsForReorder.length}` }}</ion-label>
                      <ion-icon :icon="reorderTwoOutline"/>
                    </ion-chip>
                  </ion-reorder>
                </ion-item>
                <ion-item lines="full">
                  <ion-icon :icon="timeOutline" slot="start" />
                  <ion-label>{{ translate("Last run") }}</ion-label>
                  <ion-chip outline @click.stop="openRoutingHistoryModal(routing.orderRoutingId, routing.routingName)">
                    <ion-label>{{ routingHistory[routing.orderRoutingId] ? getDateAndTimeShort(routingHistory[routing.orderRoutingId][0].startDate) : "-" }}</ion-label>
                  </ion-chip>
                </ion-item>
                <ion-item lines="none">
                  <ion-badge class="pointer" :color="routing.statusId === 'ROUTING_ACTIVE' ? 'success' : ''" @click.stop="updateOrderRouting(routing, 'statusId', `${routing.statusId === 'ROUTING_DRAFT' ? 'ROUTING_ACTIVE' : 'ROUTING_DRAFT'}`)">{{ getStatusDesc(routing.statusId) }}</ion-badge>
                  <ion-button fill="clear" color="medium" slot="end" @click.stop="updateOrderRouting(routing, 'statusId', 'ROUTING_ARCHIVED')">
                    {{ translate("Archive") }}
                    <ion-icon slot="end" :icon="archiveOutline" />
                  </ion-button>
                </ion-item>
              </ion-card>
            </ion-reorder-group>
          </ion-list>
          <div>
            <ion-item button lines="none" @click="openArchivedRoutingModal()">
              <ion-icon slot="start" :icon="archiveOutline" />
              <ion-label>{{ translate("Archive") }}</ion-label>
              <ion-badge color="medium">{{ getArchivedOrderRoutings().length }}{{ translate("rules") }}</ion-badge>
            </ion-item>
          </div>
        </div>
        <section class="ion-padding">
          <main>
            <ion-item lines="none">
              <h2>{{ translate("Description") }}</h2>
              <ion-button fill="clear" slot="end" @click="isDescUpdating ? updateGroupDescription() : (isDescUpdating = !isDescUpdating)">
                {{ translate(isDescUpdating ? "Save" : description ? "Edit" : "Add") }}
              </ion-button>
            </ion-item>
            <ion-item :color="isDescUpdating ? 'light' : ''" lines="none">
              <ion-textarea v-if="isDescUpdating" aria-label="description" v-model="description"></ion-textarea>
              <ion-label v-else>{{ description }}</ion-label>
            </ion-item>
            <ion-item lines="none">
              <h2>{{ translate("History") }}</h2>
              <ion-button v-if="groupHistory.length" fill="clear" @click="showGroupHistory" slot="end">{{ translate("View All") }}</ion-button>
            </ion-item>
            <p class="empty-state" v-if="!groupHistory.length">{{ translate("No available history for this group") }}</p>
            <ion-item v-else>
              <ion-label>
                <h3>{{ getTime(groupHistory[0].startTime) }}</h3>
                <p>{{ getDate(groupHistory[0].startTime) }}</p>
              </ion-label>
              <ion-badge color="dark">{{ getTime(groupHistory[0].endTime - groupHistory[0].startTime) }}</ion-badge>
            </ion-item>
          </main>
          <aside>
            <ion-item>
              <!-- If we does not have a schedule available then displaying the status for group schedule as draft -->
              <ion-select :label="translate('Status')" interface="popover" :value="job.paused || 'Y'" @ionChange="updateGroupStatus($event)">
                <ion-select-option value="N">{{ translate("Active") }}</ion-select-option>
                <ion-select-option value="Y">{{ translate("Draft") }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-card>
              <ion-item lines="none">
                <h2>{{ translate("Scheduler") }}</h2>
                <!-- When the group is in draft status, do not display the time delta badge -->
                <ion-badge slot="end" v-if="job.paused === 'N'">{{ timeTillJobUsingSeconds(job.nextExecutionDateTime) }}</ion-badge>
              </ion-item>
              <ion-item v-show="typeof isOmsConnectionExist === 'boolean' && !isOmsConnectionExist" lines="none">
                <ion-label color="danger" class="ion-text-wrap">
                  {{ translate("Connection configuration is missing for oms.") }}
                </ion-label>
                <ion-button fill="clear" @click="checkOmsConnectionStatus">
                  <ion-icon slot="icon-only" :icon="refreshOutline" />
                </ion-button>
              </ion-item>
              <ion-item>
                <ion-icon slot="start" :icon="timeOutline"/>
                <ion-label>{{ translate("Run time") }}</ion-label>
                <!-- When the group is in draft status, do not display the runTime from the schedule -->
                <ion-label slot="end">{{ job.paused === 'N' ? getTimeFromSeconds(job.nextExecutionDateTime) : "-" }}</ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-icon slot="start" :icon="timerOutline"/>
                <!-- When the group is in draft status, do not display the frequency and juust display the label for schedule -->
                <ion-label v-if="job.paused === 'Y'">{{ translate("Schedule") }}</ion-label>
                <ion-label v-if="job.paused === 'Y'" slot="end">{{ "-" }}</ion-label>
                <ion-select v-else :label="translate('Schedule')" interface="popover" :placeholder="translate('Select')" :value="job.cronExpression" @ionChange="updateCronExpression($event)">
                  <ion-select-option v-for="(expression, description) in cronExpressions" :key="expression" :value="expression">{{ description }}</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-card>
            <div class="actions desktop-only">
              <div>
                <ion-button :disabled="typeof isOmsConnectionExist === 'boolean' && !isOmsConnectionExist" size="small" fill="outline" @click="saveChanges()">{{ translate("Save changes") }}</ion-button>
                <ion-button :disabled="typeof isOmsConnectionExist === 'boolean' && !isOmsConnectionExist" size="small" fill="outline" @click="runNow()">{{ translate("Run Now") }}</ion-button>
              </div>
            </div>
            <ion-item>
              {{ `Created at ${getDateAndTime(currentRoutingGroup.createdDate)}` }}
            </ion-item>
            <ion-item>
              {{ `Updated at ${getDateAndTime(currentRoutingGroup.lastUpdatedStamp)}` }}
            </ion-item>
          </aside>
        </section>
      </div>
      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button :disabled="!hasUnsavedChanges" @click="saveRoutingGroup">
          <ion-icon :icon="saveOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonChip, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter } from "@ionic/vue";
import { addCircleOutline, archiveOutline, refreshOutline, reorderTwoOutline, saveOutline, timeOutline, timerOutline } from "ionicons/icons"
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps, ref } from "vue";
import { Group, Route } from "@/types";
import ArchivedRoutingModal from "@/components/ArchivedRoutingModal.vue"
import { OrderRoutingService } from "@/services/RoutingService";
import logger from "@/logger";
import { DateTime } from "luxon";
import { hasError, getDate, getDateAndTime, getDateAndTimeShort, getTime, getTimeFromSeconds, showToast, sortSequence } from "@/utils";
import emitter from "@/event-bus";
import { translate } from "@/i18n";
import GroupHistoryModal from "@/components/GroupHistoryModal.vue"
import RoutingHistoryModal from "@/components/RoutingHistoryModal.vue"

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

const cronExpressions = JSON.parse(process.env?.VUE_APP_CRON_EXPRESSIONS as string)
let routingsForReorder = ref([])
let description = ref("")
let isDescUpdating = ref(false)
let hasUnsavedChanges = ref(false)

let job = ref({}) as any
let orderRoutings = ref([]) as any
let groupHistory = ref([]) as any

const currentRoutingGroup: any = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const isOmsConnectionExist = computed(() => store.getters["util/isOmsConnectionExist"])
const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))
const routingHistory = computed(() => store.getters["orderRouting/getRoutingHistory"])

onIonViewWillEnter(async () => {
  await store.dispatch("orderRouting/fetchCurrentRoutingGroup", props.routingGroupId)
  await fetchGroupHistory()
  store.dispatch("orderRouting/fetchRoutingHistory", props.routingGroupId)
  store.dispatch("util/fetchStatusInformation")

  job.value = currentRoutingGroup.value["schedule"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["schedule"] : {}
  orderRoutings.value = currentRoutingGroup.value["routings"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"] : []
  description.value = currentRoutingGroup.value["description"] ? currentRoutingGroup.value["description"] : ""
  
  if(orderRoutings.value.length) {
    initializeOrderRoutings();
  }
})

onBeforeRouteLeave(async (to) => {
  if(to.path === "/login") return;
  let canLeave = false;

  const alert = await alertController.create({
    header: translate("Leave page"),
    message: translate("Any edits made on this page will be lost."),
    buttons: [
      {
        text: translate("STAY"),
        handler: () => {
          canLeave = false;
        },
      },
      {
        text: translate("LEAVE"),
        handler: () => {
          canLeave = true;
        },
      },
    ],
  });

  if(hasUnsavedChanges.value) {
    alert.present();
    await alert.onDidDismiss();
    return canLeave;
  }
})

function updateCronExpression(event: CustomEvent) {
  job.value.cronExpression = event.detail.value
}

function initializeOrderRoutings() {
  routingsForReorder.value = JSON.parse(JSON.stringify(getActiveAndDraftOrderRoutings()))
}

async function checkOmsConnectionStatus() {
  await store.dispatch("util/checkOmsConnectionStatus")
}

async function saveChanges() {
  const alert = await alertController
    .create({
      header: translate("Save changes"),
      message: translate("Are you sure you want to save these changes?"),
      buttons: [{
        text: translate("Cancel"),
        role: "cancel"
      }, {
        text: translate("Save"),
        handler: async () => {
          await saveSchedule()
        }
      }]
    });
  return alert.present();
}

async function fetchGroupHistory() {
  groupHistory.value = []

  if(!currentRoutingGroup.value?.jobName) {
    return;
  }

  try {
    const resp = await OrderRoutingService.fetchGroupHistory(currentRoutingGroup.value.jobName)

    if(!hasError(resp)) {
      // Sorting the history based on startTime, as we does not get the records in sorted order from api
      groupHistory.value = resp.data.sort((a: any, b: any) => b.startTime - a.startTime)
    } else {
      throw resp.data;
    }
  } catch(err) {
    logger.error(err)
  }
}

async function saveSchedule() {
  // If this is the first time then we are fetching the omsConnection status, as if the value of isOmsConnectionExist value is a boolean it means we have previously fetched the connection status
  if(typeof isOmsConnectionExist.value !== "boolean") {
    await checkOmsConnectionStatus()
  }

  if(!isOmsConnectionExist.value) {
    return;
  }

  if(!job.value.cronExpression) {
    showToast(translate("Please select a scheduling for job"))
    logger.error("Please select a scheduling for job")
    return;
  }

  const payload = {
    routingGroupId: props.routingGroupId,
    paused: job.value.paused || 'N',  // considering job in active status as soon as scheduled, if the paused value on the job is not set
    ...job.value
  }

  try {
    const resp = await OrderRoutingService.scheduleBrokering(payload)
    if(!hasError(resp)){
      showToast(translate("Job updated"))
    } else {
      throw resp.data
    }
  } catch(err) {
    showToast(translate("Failed to update job"))
    logger.error(err)
  }
}

function timeTillJobUsingSeconds(time: any) {
  if(!time) {
    return;
  }
  const timeDiff = DateTime.fromSeconds(time).diff(DateTime.local());
  return DateTime.local().plus(timeDiff).toRelative();
}

async function runNow() {
  const scheduleAlert = await alertController
    .create({
      header: translate("Run now"),
      message: translate("Running this schedule now will not replace this schedule. A copy of this schedule will be created and run immediately. You may not be able to reverse this action."),
      buttons: [
        {
          text: translate("Cancel"),
          role: "cancel",
        },
        {
          text: translate("Run now"),
          handler: async () => {
            try {
              const resp = await OrderRoutingService.runNow(props.routingGroupId)
              if(!hasError(resp) && resp.data.jobRunId) {
                showToast(translate("Service has been scheduled"))
              } else {
                throw resp.data
              }
            } catch(err) {
              showToast(translate("Failed to schedule service"))
              logger.error(err)
            }
          }
        }
      ]
    });

  return scheduleAlert.present();
}

async function redirect(orderRouting: Route) {
  await store.dispatch("orderRouting/setCurrentOrderRouting", orderRouting)
  router.push(`${orderRouting.orderRoutingId}/rules`)
}

function updateGroupStatus(event: CustomEvent) {
  job.value.paused = event.detail.value
}

async function createOrderRoute() {
  const newRouteAlert = await alertController.create({
    header: translate("New Order Route"),
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save")
    }],
    inputs: [{
      name: "routingName",
      placeholder: translate("route name")
    }]
  })

  newRouteAlert.onDidDismiss().then(async (result: any) => {
    // considered that if a role is available on dismiss, it will be a negative role in which we don't need to perform any action
    if(result.role) {
      return;
    }

    const routingName = result.data?.values?.routingName;
    if(routingName && props.routingGroupId) {
      // TODO: check for the default value of params
      const payload = {
        orderRoutingId: "",
        routingGroupId: props.routingGroupId,
        statusId: "ROUTING_DRAFT",
        routingName,
        sequenceNum: orderRoutings.value.length && orderRoutings.value[orderRoutings.value.length - 1].sequenceNum >= 0 ? orderRoutings.value[orderRoutings.value.length - 1].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new route seqNum to 0, also considering archivedRouting when calculating new seqNum
        description: "",
        createdDate: DateTime.now().toMillis()
      }

      const orderRoutingId = await store.dispatch("orderRouting/createOrderRouting", payload)

      // update the routing order for reordering and the cloned updated routings again
      if(orderRoutingId) {
        orderRoutings.value = JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"]
        initializeOrderRoutings();
      }
    }
  })

  return newRouteAlert.present();
}

function getActiveAndDraftOrderRoutings() {
  return orderRoutings.value.filter((routing: Route) => routing.statusId !== "ROUTING_ARCHIVED")
}

function getArchivedOrderRoutings() {
  return orderRoutings.value.filter((routing: Route) => routing.statusId === "ROUTING_ARCHIVED")
}

async function updateGroupDescription() {
  // Do not update description, if the desc is unchanged, and we do not have routingGroupId
  // Added conversion using `!!`, as if the group does not have a description then we get `undefined` and if the description entered by the user is left empty then `undefined != ''` is true and thus it makes an api call, even when description is unchanged in this case.
  if(props.routingGroupId && (!!currentRoutingGroup.value.description != !!description.value)) {
    const routingGroupId = await updateRoutingGroup({ routingGroupId: props.routingGroupId, productStoreId: currentRoutingGroup.value.productStoreId, description: description.value })
    if(routingGroupId) {
      await store.dispatch("orderRouting/setCurrentGroup", { ...currentRoutingGroup.value, description: description.value })
    }
  }
  isDescUpdating.value = false
}

function findRoutingsDiff(previousSeq: any, updatedSeq: any) {
  const diffSeq: any = Object.keys(previousSeq).reduce((diff, key) => {
    if (updatedSeq[key].orderRoutingId === previousSeq[key].orderRoutingId && updatedSeq[key].statusId === previousSeq[key].statusId && updatedSeq[key].sequenceNum === previousSeq[key].sequenceNum) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, {})
  return diffSeq;
}

function doReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(routingsForReorder.value))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(routingsForReorder.value)));

  let diffSeq = findRoutingsDiff(previousSeq, updatedSeq)
  
  const updatedSeqenceNum = previousSeq.map((routing: Route) => routing.sequenceNum)
  Object.keys(diffSeq).map((key: any) => {
    diffSeq[key].sequenceNum = updatedSeqenceNum[key]
  })

  diffSeq = Object.keys(diffSeq).map((key) => diffSeq[key])
  routingsForReorder.value = updatedSeq
  orderRoutings.value = sortSequence(updatedSeq.concat(getArchivedOrderRoutings()))
  // considering that when reordering there are some changes in the order of routes
  hasUnsavedChanges.value = true
}

async function openArchivedRoutingModal() {
  const archivedRoutingModal = await modalController.create({
    component: ArchivedRoutingModal,
    componentProps: { archivedRoutings: getArchivedOrderRoutings() }
  })

  archivedRoutingModal.onDidDismiss().then((result: any) => {
    if(result.data?.routings?.length) {
      hasUnsavedChanges.value = true
      orderRoutings.value = sortSequence(getActiveAndDraftOrderRoutings().concat(result.data?.routings))
    }
    initializeOrderRoutings()
  })

  archivedRoutingModal.present();
}

async function openRoutingHistoryModal(orderRoutingId: string, routingName: string) {
  const routingHistoryModal = await modalController.create({
    component: RoutingHistoryModal,
    componentProps: { routingHistory: routingHistory.value[orderRoutingId], routingName, groupName: currentRoutingGroup.value.groupName }
  })

  routingHistoryModal.present();
}

async function updateOrderRouting(routing: Route, fieldToUpdate: string, value: string) {
  orderRoutings.value.map((route: any) => {
    if(route.orderRoutingId === routing.orderRoutingId) {
      route[fieldToUpdate] = value
    }
  })
  hasUnsavedChanges.value = true
  initializeOrderRoutings()
}

async function saveRoutingGroup() {
  // Converting the routings into object { orderRoutingId: routing } format as to find the diff after performing all the operations
  const initialRoutings = currentRoutingGroup.value["routings"].reduce((routings: any, routing: any) => {
    routings[routing.orderRoutingId] = routing
    return routings
  }, {})

  const finalRoutings = orderRoutings.value.reduce((routings: any, routing: any) => {
    routings[routing.orderRoutingId] = routing
    return routings
  }, {})

  const diff = findRoutingsDiff(initialRoutings, finalRoutings)

  // If there is no diff in the routing order then do not make any api call and update hasUnsavedChanges values as we have made its value to true on calling of doReorder function
  if(!Object.keys(diff).length) {
    hasUnsavedChanges.value = false
    return;
  }

  const routings = Object.values(diff).map((routing: any) => {
    return {
      routingGroupId: props.routingGroupId,
      orderRoutingId: routing.orderRoutingId,
      routingName: routing.routingName,
      sequenceNum: routing.sequenceNum,
      statusId: routing.statusId
    }
  })

  const payload = {
    routingGroupId: props.routingGroupId,
    productStoreId: currentRoutingGroup.value.productStoreId,
    routings
  }

  const routingGroupId = await updateRoutingGroup(payload)
  if(routingGroupId) {
    hasUnsavedChanges.value = false
    await store.dispatch("orderRouting/setCurrentGroup", { ...currentRoutingGroup.value, routings: JSON.parse(JSON.stringify(orderRoutings.value)) })
  }
}

async function updateRoutingGroup(payload: any) {
  emitter.emit("presentLoader", { message: "Updating...", backdropDismiss: false })
  let routingGroupId = ''
  try {
    const resp = await OrderRoutingService.updateRoutingGroup(payload);

    if(!hasError(resp) && resp.data.routingGroupId) {
      routingGroupId = resp.data.routingGroupId
      showToast(translate("Routing group information updated"))
    } else {
      throw resp.data
    }
  } catch(err) {
    showToast(translate("Failed to update group information"))
    logger.error(err);
  }

  emitter.emit("dismissLoader")
  return routingGroupId
}

async function showGroupHistory() {
  const groupHistoryModal = await modalController.create({
    component: GroupHistoryModal,
    componentProps: { groupHistory: groupHistory.value }
  })

  groupHistoryModal.present();
}
</script>

<style scoped>
section {
  display: flex;
  justify-content: space-between;
}

section > * {
  min-width: 40ch;
}

ion-content > div {
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 100%;
}

ion-content > div > div {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-right: 1px solid #92949C;
}

.actions > ion-button {
  margin: var(--spacer-sm);
}

@media (min-width: 991px) {
  .actions {
    display: flex;
    justify-content: space-between;
    margin: var(--spacer-base) var(--spacer-sm) var(--spacer-base);
  }
}
</style>
