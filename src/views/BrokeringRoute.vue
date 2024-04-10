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
          <ion-list v-if="routingsForReorder.length">
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
                    <ion-label>{{ routingHistory[routing.orderRoutingId] ? getDateAndTimeShort(routingHistory[routing.orderRoutingId][0].startDate) : translate("No run history") }}</ion-label>
                  </ion-chip>
                </ion-item>
                <ion-item lines="none">
                  <ion-badge class="pointer" :color="routing.statusId === 'ROUTING_ACTIVE' ? 'success' : ''" @click.stop="updateOrderRouting(routing, 'statusId', `${routing.statusId === 'ROUTING_DRAFT' ? 'ROUTING_ACTIVE' : 'ROUTING_DRAFT'}`)">{{ getStatusDesc(routing.statusId) }}</ion-badge>
                  <div slot="end">
                    <ion-button fill="clear" color="medium" @click.stop="cloneRouting(routing)">
                      <ion-icon slot="icon-only" :icon="copyOutline" />
                    </ion-button>
                    <ion-button fill="clear" color="medium" @click.stop="updateOrderRouting(routing, 'statusId', 'ROUTING_ARCHIVED')">
                      <ion-icon slot="icon-only" :icon="archiveOutline" />
                    </ion-button>
                  </div>
                </ion-item>
              </ion-card>
            </ion-reorder-group>
          </ion-list>
          <div class="empty-state">
            <p>{{ translate("Create order batches for this Brokering Run to execute.") }}</p>
            <ion-button @click="createOrderRoute">
              <ion-icon slot="start" :icon="addOutline"></ion-icon>
              {{ translate("Create order batch") }}
            </ion-button>
          </div>
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
              <ion-button fill="clear" slot="end" @click="isDescUpdating ? updateGroupDescription() : editGroupDescription()">
                {{ translate(isDescUpdating ? "Save" : description ? "Edit" : "Add") }}
              </ion-button>
            </ion-item>
            <ion-item :color="isDescUpdating ? 'light' : ''" lines="none">
              <!-- Used keydown event as ionic provides the keydown event to be overridden -->
              <ion-textarea ref="descRef" v-show="isDescUpdating" aria-label="description" v-model="description" @keydown.enter.exact.prevent="updateGroupDescription"></ion-textarea>
              <!-- Using regex to replace all \n with br tag to correctly display the user entered description -->
              <ion-label v-show="!isDescUpdating" v-html="description.replace(/(?:\n|\n)/g, '<br />')"></ion-label>
            </ion-item>
            <ion-item lines="none">
              <h2>{{ translate("History") }}</h2>
              <ion-button v-if="groupHistory.length" fill="clear" @click="showGroupHistory" slot="end">{{ translate("View All") }}</ion-button>
            </ion-item>
            <p class="empty-state" v-if="!groupHistory.length || !groupHistory[0].startTime">{{ translate("No available history for this group") }}</p>
            <ion-item v-else>
              <ion-label>
                <h3>{{ getTime(groupHistory[0].startTime) }}</h3>
                <p>{{ getDate(groupHistory[0].startTime) }}</p>
              </ion-label>
              <ion-badge color="dark" v-if="groupHistory[0].endTime">{{ timeTillRun(groupHistory[0].endTime) }}</ion-badge>
            </ion-item>
          </main>
          <aside>
            <ion-item>
              <!-- If we does not have a schedule available then displaying the status for group schedule as draft -->
              <ion-select :label="translate('Status')" interface="popover" :interface-options="{ subHeader: translate('Status') }" :value="job.paused || 'Y'" @ionChange="updateGroupStatus($event)">
                <ion-select-option value="N">{{ translate("Active") }}</ion-select-option>
                <ion-select-option value="Y">{{ translate("Draft") }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-card>
              <ion-item lines="none">
                <h2>{{ translate("Scheduler") }}</h2>
                <!-- When the group is in draft status, do not display the time delta badge -->
                <ion-badge slot="end" v-if="job.paused === 'N'">{{ timeTillJob(job.nextExecutionDateTime) }}</ion-badge>
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
                <ion-label slot="end">{{ job.paused === 'N' ? getDateAndTime(job.nextExecutionDateTime) : "-" }}</ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-icon slot="start" :icon="timerOutline"/>
                <!-- When the group is in draft status or the job is not present, do not display the frequency and just display the label for schedule -->
                <ion-label v-if="!job.paused || job.paused === 'Y'">{{ translate("Schedule") }}</ion-label>
                <ion-label v-if="!job.paused || job.paused === 'Y'" slot="end">{{ "-" }}</ion-label>
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
import { addCircleOutline, addOutline, archiveOutline, copyOutline, refreshOutline, reorderTwoOutline, saveOutline, timeOutline, timerOutline } from "ionicons/icons"
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps, nextTick, ref } from "vue";
import { Group, Route } from "@/types";
import ArchivedRoutingModal from "@/components/ArchivedRoutingModal.vue"
import { OrderRoutingService } from "@/services/RoutingService";
import logger from "@/logger";
import { DateTime } from "luxon";
import { hasError, getDate, getDateAndTime, getDateAndTimeShort, getTime, showToast, sortSequence, timeTillRun } from "@/utils";
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
const descRef = ref()

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

  // If there are no unsaved changes do not create and present the alert
  if(!hasUnsavedChanges.value) {
    return;
  }

  const alert = await alertController.create({
    header: translate("Save changes"),
    message: translate("Do you want to save your changes before leaving this page?"),
    buttons: [
      {
        text: translate("Discard")
      },
      {
        text: translate("Save"),
        handler: async () => {
          await saveRoutingGroup();
        },
      },
    ],
  });

  alert.present();
  await alert.onDidDismiss();
  return;
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

function timeTillJob(time: any) {
  if(!time) {
    return;
  }
  const timeDiff = DateTime.fromMillis(time).diff(DateTime.local());
  return DateTime.local().plus(timeDiff).toRelative();
}

async function runNow() {
  // If this is the first time then we are fetching the omsConnection status, as if the value of isOmsConnectionExist value is a boolean it means we have previously fetched the connection status
  if(typeof isOmsConnectionExist.value !== "boolean") {
    await checkOmsConnectionStatus()
  }

  if(!isOmsConnectionExist.value) {
    return;
  }

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
            // Checking that if we already have the job schedule before calling runNow, because if the job scheduler is not present then runNow action can't be performed
            // If the scheduler for the job is available then we will have jobName, if not then first scheduling the job in draft status just to create a routing schedule and then calling runNow action
            if(!job.value.jobName) {
              const payload = {
                routingGroupId: props.routingGroupId,
                paused: "Y",  // passing Y as we just need to configure the scheduler and do not need to schedule it in active state
              }

              try {
                const resp = await OrderRoutingService.scheduleBrokering(payload)
                if(hasError(resp)) {
                  throw resp.data
                }
                // Updating jobName as if the user again clicks the runNow button then in that we don't want to call the scheduleBrokering service
                job.value.jobName = resp.data.jobName
              } catch(err) {
                logger.error(err)
                return;
              }
            }

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
  let isRoutingArchived = currentRoutingGroup.value["routings"].some((routing: any) => routing.orderRoutingId === orderRouting.orderRoutingId && routing.statusId === "ROUTING_ARCHIVED" )

  if(isRoutingArchived) {
    showToast(translate("Save changes before moving to the details page of unarchived route"))
    return;
  }

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
      text: translate("Save"),
      handler: (data) => {
        if(!data.routingName?.trim().length) {
          showToast(translate("Please enter a valid name"))
          return false;
        }
      }
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
  // If the group does not have a description then we get `undefined` and if the description entered by the user is left empty then `undefined != ''` is true and thus it makes an api call, even when description is unchanged in this case.
  if(props.routingGroupId && ((currentRoutingGroup.value.description || description.value) && currentRoutingGroup.value.description != description.value)) {
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

async function editGroupDescription() {
  isDescUpdating.value = !isDescUpdating.value;
  // Waiting for DOM updations before focus inside the text-area, as it is conditionally rendered in the DOM
  await nextTick()
  descRef.value.$el.setFocus();
}

async function cloneRouting(routing: any) {
  emitter.emit("presentLoader", { message: "Cloning route", backdropDismiss: false })

  // payload for creating the cloned copy of current routing
  const payload = {
    orderRoutingId: "",
    routingGroupId: props.routingGroupId,
    statusId: "ROUTING_DRAFT",  // when cloning a routing, the new routing will be in draft status
    routingName: routing.routingName + " copy",
    sequenceNum: orderRoutings.value.length && orderRoutings.value[orderRoutings.value.length - 1].sequenceNum >= 0 ? orderRoutings.value[orderRoutings.value.length - 1].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new route seqNum to 0, also considering archivedRouting when calculating new seqNum
    description: "",
    createdDate: DateTime.now().toMillis()
  }

  const orderRoutingId = await store.dispatch("orderRouting/createOrderRouting", payload)

  // No need to perform any action if we do not get routingId in return after routing creation
  if(!orderRoutingId) {
    showToast(translate("Failed to clone order routing"))
    emitter.emit("dismissLoader")
    return;
  }

  let parentRouting = {} as any;

  // Fetch rules and order filters for the parent routing, as we need to create copy of the rules and filters
  try {
    const resp = await OrderRoutingService.fetchOrderRouting(routing.orderRoutingId);

    if(!hasError(resp) && resp.data) {
      parentRouting = resp.data
    } else {
      throw resp.data
    }
  } catch(err) {
    showToast(translate("Failed to clone the routing filters and rules"))
    logger.error(err);
    emitter.emit("dismissLoader");
    return;
  }

  if(parentRouting?.rules?.length) {
    const parentRoutingRules = await Promise.all(parentRouting.rules.map((rule: any) => OrderRoutingService.fetchRule(rule.routingRuleId)))
    parentRouting["rulesInformation"] = parentRoutingRules.reduce((rulesInformation: any, rule: any) => {
      rulesInformation[rule.data.ruleName] = rule.data
      return rulesInformation
    }, {})
  }

  // Payload for applying routing filters and rules in the cloned routing
  const routingPayload = {
    orderRoutingId,
    routingGroupId: parentRouting.routingGroupId,
    orderFilters: parentRouting.orderFilters?.length ? parentRouting.orderFilters.reduce((filters: any, filter: any) => {
      filters.push({
        conditionTypeEnumId: filter.conditionTypeEnumId,
        fieldName: filter.fieldName,
        fieldValue: filter.fieldValue,
        operator: filter.operator,
        sequenceNum: filter.sequenceNum,
        createdDate: DateTime.now().toMillis(),
        orderRoutingId
      })
      return filters
    }, []) : [],
    rules: parentRouting.rules?.length ? parentRouting.rules.reduce((rules: any, rule: any) => {
      rules.push({
        assignmentEnumId: rule.assignmentEnumId,
        createdDate: DateTime.now().toMillis(),
        ruleName: rule.ruleName,
        sequenceNum: rule.sequenceNum,
        statusId: "RULE_DRAFT",
        orderRoutingId
      })
      return rules
    }, []) : []
  }

  if(!routingPayload.orderFilters.length && !routingPayload.rules.length) {
    emitter.emit("dismissLoader")
    return;
  }

  await store.dispatch("orderRouting/updateRouting", routingPayload)

  let clonedRoutingRules = {} as any;

  // As we do not have routingRuleId's for the rules created inside the cloned routing, hence fetching the rule ids
  if(Object.keys(parentRouting["rulesInformation"])?.length) {
    try {
      const resp = await OrderRoutingService.fetchOrderRouting(orderRoutingId);
      if(!hasError(resp) && resp.data?.rules?.length) {
        clonedRoutingRules = resp.data.rules.reduce((rules: any, rule: any) => {
          rules[rule.ruleName] = rule.routingRuleId
          return rules
        }, {})
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err)
    }
  }

  if(Object.keys(clonedRoutingRules).length) {
    await Promise.all(Object.values(parentRouting["rulesInformation"]).map((rule: any) => {
      store.dispatch("orderRouting/updateRule", {
        routingRuleId: clonedRoutingRules[rule.ruleName],
        orderRoutingId,
        inventoryFilters: rule.inventoryFilters?.length ? rule.inventoryFilters.map((filter: any) => ({
          createdDate: DateTime.now().toMillis(),
          conditionTypeEnumId: filter.conditionTypeEnumId,
          fieldName: filter.fieldName,
          fieldValue: filter.fieldValue,
          operator: filter.operator,
          sequenceNum: filter.sequenceNum,
        })) : [],
        actions: rule.actions?.length ? rule.actions.map((filter: any) => ({
          actionTypeEnumId: filter.actionTypeEnumId,
          actionValue: filter.actionValue,
          createdDate: DateTime.now().toMillis(),
        })) : []
      })
    }))
  }

  // update the routing order for reordering and the cloned updated routings again
  if(orderRoutingId) {
    orderRoutings.value = JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"]
    initializeOrderRoutings();
  }

  emitter.emit("dismissLoader")
}
</script>

<style scoped>
section {
  display: flex;
  justify-content: space-between;
}

section > * {
  flex-grow: .3;
}

ion-content > div {
  display: grid;
  grid-template-columns: minmax(375px, 25%) 1fr;
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
