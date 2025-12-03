<template>
  <!-- Adding pointerup event on page as when we start reordering and then if we move the pointer on any component of the page and stop reordering, then also we need to update the value of isReordering variable to enable the card -->
  <!-- If not adding this on page and if the user drops the pointer outside of reorder component then multiple clicks are required on the route card to move to the details page -->
  <ion-page @pointerup="isReordering = false">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/brokering" />
        </ion-buttons>
        <ion-title>{{ translate("Routing Run") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div>
        <main>
          <section class="route-details">
            <ion-card class="info">
              <div>
                <ion-card-header>
                  <ion-card-title v-show="!isGroupNameUpdating">{{ groupName }}</ion-card-title>
                  <!-- Added class as we can't change the background of ion-input with css property, and we need to change the background to show the user that now this value is editable -->
                  <ion-input ref="groupNameRef" :class="isGroupNameUpdating ? 'name' : ''" v-show="isGroupNameUpdating" aria-label="group name" v-model="groupName"></ion-input>
                  <ion-card-subtitle>{{ currentRoutingGroup.routingGroupId }}</ion-card-subtitle>
                </ion-card-header>
                <div class="ion-padding">
                  <ion-button v-show="!isGroupNameUpdating" fill="outline" size="small" @click="editGroupName()">
                    <ion-icon slot="start" :icon="pencilOutline" />
                    {{ translate("Rename") }}
                  </ion-button>
                  <ion-button v-show="isGroupNameUpdating" fill="outline" size="small" @click="updateGroupName()">
                    <ion-icon slot="start" :icon="saveOutline" />
                    {{ translate("Save") }}
                  </ion-button>
                  <ion-button fill="outline" size="small" @click="cloneGroup()">
                    <ion-icon slot="start" :icon="copyOutline" />
                    {{ translate("Clone") }}
                  </ion-button>
                </div>
              </div>
              <div>
                <ion-item>
                  <ion-label>{{ translate("Created at") }}</ion-label>
                  <ion-label slot="end">{{ getDateAndTime(currentRoutingGroup.createdDate) }}</ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate("Updated at") }}</ion-label>
                  <ion-label slot="end">{{ getDateAndTime(currentRoutingGroup.lastUpdatedStamp) }}</ion-label>
                </ion-item>
                <ion-item lines="none">
                  <ion-icon slot="start" :icon="pulseOutline" />
                  <!-- If we does not have a schedule available then displaying the status for group schedule as draft -->
                  <ion-select :label="translate('Status')" interface="popover" :interface-options="{ subHeader: translate('Status') }" :value="job.paused || 'Y'" @ionChange="updateGroupStatus($event)">
                    <ion-select-option value="N">{{ translate("Active") }}</ion-select-option>
                    <ion-select-option value="Y">{{ translate("Draft") }}</ion-select-option>
                  </ion-select>
                </ion-item>
              </div>
            </ion-card>
          </section>
          <section class="route-details">
            <div>
              <ion-card>
                <ion-item lines="none">
                  <h2>{{ translate("Description") }}</h2>
                  <ion-button v-if="description || isDescUpdating" fill="clear" slot="end" @click="isDescUpdating ? updateGroupDescription() : editGroupDescription()">
                    {{ translate(isDescUpdating ? "Save" : "Edit") }}
                  </ion-button>
                </ion-item>
                <ion-item class="ion-margin" v-show="description || isDescUpdating" :color="isDescUpdating ? 'light' : ''" lines="none">
                  <!-- Used keydown event as ionic provides the keydown event to be overridden -->
                  <ion-textarea ref="descRef" v-show="isDescUpdating" aria-label="description" v-model="description" @keydown.enter.exact.prevent="updateGroupDescription"></ion-textarea>
                  <!-- Using regex to replace all \n with br tag to correctly display the user entered description -->
                  <ion-label v-show="!isDescUpdating" v-html="description.replace(/(?:\n|\n)/g, '<br />')"></ion-label>
                </ion-item>
                <ion-button v-if="!description && !isDescUpdating" @click="editGroupDescription()" fill="outline" expand="block">
                  {{ translate("Add") }}
                  <ion-icon slot="end" :icon="addCircleOutline" />
                </ion-button>
              </ion-card>
              <ion-card v-if="!hasPermission(Actions.APP_TEST_DRIVE_VIEW)">
                <ion-item lines="none">
                  <h2>{{ translate("Test drive") }}</h2>
                </ion-item>
                <ion-item class="ion-margin" lines="none">
                  <ion-label>
                    {{ translate("Test drive your brokering run to see how specific orders are routed. Try different kind of orders to quickly verify if all flows are working as expected.") }}
                  </ion-label>
                </ion-item>
                <ion-button fill="outline" expand="block" @click="router.push(`/tabs/brokering/${props.routingGroupId}/routes/test`)" :disabled="hasUnsavedChanges">
                  <ion-icon slot="start" :icon="speedometerOutline" />
                  {{ translate("Test drive") }}
                </ion-button>

                <ion-item>
                  <ion-toggle :checked="!isBrokeringEnabled" @ionChange="toggleReservation($event)">
                    <ion-label>{{ translate("Pause scheduled brokering") }}</ion-label>
                    <ion-note color="danger">{{ activeTestSessions }} {{ translate("active sessions") }}</ion-note>
                  </ion-toggle>
                </ion-item>
              </ion-card>
            </div>
            <div>
              <ion-card>
                <ion-item lines="none">
                  <h2>{{ translate("Scheduler") }}</h2>
                  <!-- When the group is in draft status, do not display the time delta badge -->
                  <ion-badge slot="end" v-if="job.paused === 'N'">{{ timeTillJob(job.nextExecutionDateTime) }}</ion-badge>
                </ion-item>
                <ion-item detail button @click="openScheduleModal">
                  <ion-icon slot="start" :icon="timerOutline"/>
                  <!-- When the group is in draft status or the job is not present, do not display the frequency and just display the label for schedule -->
                  <!-- <ion-label v-if="!job.paused || job.paused === 'Y'">{{ translate("Schedule") }}</ion-label>
                  <ion-label v-if="!job.paused || job.paused === 'Y'" slot="end">{{ "-" }}</ion-label>
                  <ion-select v-else :label="translate('Schedule')" interface="popover" :placeholder="translate('Select')" :value="job.cronExpression" @ionChange="updateCronExpression($event)">
                    <ion-select-option v-for="(expression, description) in cronExpressions" :key="expression" :value="expression">{{ description }}</ion-select-option>
                  </ion-select> -->
                  <ion-label>{{ getCronString() || job.cronExpression }}</ion-label>
                </ion-item>
                <ion-item>
                  <ion-icon slot="start" :icon="timeOutline"/>
                  <ion-label>{{ translate("Next run") }}</ion-label>
                  <!-- When the group is in draft status, do not display the runTime from the schedule -->
                  <ion-label slot="end">{{ job.paused === 'N' ? getDateAndTime(job.nextExecutionDateTime) : "-" }}</ion-label>
                </ion-item>
                <ion-item lines="none" button @click="runNow()">
                  <ion-icon slot="start" :icon="flashOutline"/>
                  <ion-label>{{ translate("Run Now") }}</ion-label>
                </ion-item>
              </ion-card>
              <ion-card>
                <ion-item lines="none">
                  <h2>{{ translate("Execution history") }}</h2>
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
              </ion-card>
            </div>
          </section>
        </main>
        <aside>
          <ion-list v-if="orderRoutings.length">
            <template v-if="routingsForReorder.length">
              <ion-list-header>
                <ion-label>{{ translate("Order batches") }}</ion-label>
                <ion-button color="primary" fill="clear" @click="createOrderRoute">
                  {{ translate("New") }}
                  <ion-icon :icon="addCircleOutline" />
                </ion-button>
              </ion-list-header>
              <ion-reorder-group @ionItemReorder="doReorder($event)" :disabled="false">
                <ion-card :disabled="isReordering" :class="isReordering ? 'reordering-enabled pointer' : 'pointer'" v-for="(routing, index) in routingsForReorder" :key="routing.orderRoutingId" @click.prevent="redirect(routing)">
                  <ion-item lines="full">
                    <ion-label>
                      <h1>{{ routing.routingName }}</h1>
                    </ion-label>
                    <!-- Changing isReordering to true when user starts reordering the list and on the basis of this disabling the card -->
                    <ion-reorder @pointerdown="isReordering = true">
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
                    <ion-badge class="pointer" :color="routing.statusId === 'ROUTING_ACTIVE' ? 'success' : 'medium'" @click.stop="updateOrderRouting(routing, 'statusId', `${routing.statusId === 'ROUTING_DRAFT' ? 'ROUTING_ACTIVE' : 'ROUTING_DRAFT'}`)">{{ getStatusDesc(routing.statusId) }}</ion-badge>
                    <div slot="end">
                      <ion-button size="default" fill="clear" color="medium" @click.stop="cloneRouting(routing)">
                        <ion-icon slot="icon-only" :icon="copyOutline" />
                      </ion-button>
                      <ion-button size="default" fill="clear" color="medium" @click.stop="updateOrderRouting(routing, 'statusId', 'ROUTING_ARCHIVED')">
                        <ion-icon slot="icon-only" :icon="archiveOutline" />
                      </ion-button>
                    </div>
                  </ion-item>
                </ion-card>
              </ion-reorder-group>
            </template>
            <ion-card v-if="getArchivedOrderRoutings().length">
              <ion-item button lines="none" @click="openArchivedRoutingModal()">
                <ion-label>{{ translate("Archived") }}</ion-label>
                <ion-badge color="medium">{{ getArchivedOrderRoutings().length }}{{ translate(getArchivedOrderRoutings().length > 1 ? "rules" : "rule") }}</ion-badge>
              </ion-item>
            </ion-card>
          </ion-list>
          <div v-else class="empty-state">
            <p>{{ translate("Create order batches for this Brokering Run to execute.") }}</p>
            <ion-button @click="createOrderRoute">
              <ion-icon slot="start" :icon="addOutline"></ion-icon>
              {{ translate("Create order batch") }}
            </ion-button>
          </div>
          <div class="save-batches" v-if="hasUnsavedChanges">
            <ion-item lines="none">
              <ion-icon slot="start" :icon="listOutline" />
              <ion-label>{{ translate("Save batch sequence?") }}</ion-label>
              <ion-button fill="outline" @click="saveRoutingGroup">
                {{ translate("Save") }}
                <ion-icon slot="end" :icon="saveOutline" />
              </ion-button>
            </ion-item>
          </div>
        </aside>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToggle, IonToolbar, alertController, modalController, onIonViewWillEnter } from "@ionic/vue";
import { addCircleOutline, addOutline, archiveOutline, copyOutline, flashOutline, listOutline, pencilOutline, pulseOutline, reorderTwoOutline, saveOutline, speedometerOutline, timeOutline, timerOutline } from "ionicons/icons"
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
import cronstrue from "cronstrue"
import ScheduleModal from "@/components/ScheduleModal.vue";
import { UtilService } from "@/services/UtilService";
import { Actions, hasPermission } from "@/authorization";

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

let routingsForReorder = ref([])
let description = ref("")
let isDescUpdating = ref(false)
let hasUnsavedChanges = ref(false)
const descRef = ref()
let groupName = ref("")
let isGroupNameUpdating = ref(false)
const groupNameRef = ref()

let job = ref({}) as any
let orderRoutings = ref([]) as any
let groupHistory = ref([]) as any
let isReordering = ref(false) // To handle the case of click event being triggered when dropping pointer outside of ion-reorder, more details on PR associated with issue #138
let activeTestSessions = ref(0)
let isBrokeringEnabled = ref(true)

const currentRoutingGroup: any = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))
const routingHistory = computed(() => store.getters["orderRouting/getRoutingHistory"])
const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])
const userProfile = computed(() => store.getters["user/getUserProfile"])

onIonViewWillEnter(async () => {
  await store.dispatch("orderRouting/fetchCurrentRoutingGroup", props.routingGroupId)
  await fetchGroupHistory()
  store.dispatch("orderRouting/fetchRoutingHistory", props.routingGroupId)
  store.dispatch("util/fetchStatusInformation")
  store.dispatch("orderRouting/clearRoutingTestInfo")
  await getTestSessions();
  await getProductStoreReservation();

  job.value = currentRoutingGroup.value["schedule"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["schedule"] : {}
  orderRoutings.value = currentRoutingGroup.value["routings"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"] : []
  description.value = currentRoutingGroup.value["description"] ? currentRoutingGroup.value["description"] : ""
  groupName.value = currentRoutingGroup.value["groupName"] ? currentRoutingGroup.value["groupName"] : ""
  
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
        text: translate("Discard"),
        handler: async () => {
          hasUnsavedChanges.value = false;
        }
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
  const data = await alert.onDidDismiss();

  // If clicking backdrop just close the modal and do not redirect the user to previous page
  if(data?.role === "backdrop") {
    return false;
  }

  return;
})

function getCronString() {
  try {
    return cronstrue.toString(job.value.cronExpression)
  } catch(e) {
    logger.error(e)
    return ""
  }
}

function initializeOrderRoutings() {
  routingsForReorder.value = JSON.parse(JSON.stringify(getActiveAndDraftOrderRoutings()))
}

async function fetchGroupHistory() {
  groupHistory.value = []

  if(!currentRoutingGroup.value?.jobName) {
    return;
  }

  try {
    const resp = await OrderRoutingService.fetchGroupHistory(currentRoutingGroup.value.jobName, { orderByField: "startTime DESC" })

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
    if(!hasError(resp)) {
      showToast(translate("Job updated"))
      // Fetching the group schedule information again after making changes to the job schedule to fetch the correct nextExecutionTime for job, doing so as we do not get the updated information in POST schedule api call
      await store.dispatch("orderRouting/fetchCurrentGroupSchedule", { routingGroupId: props.routingGroupId, currentGroup: currentRoutingGroup.value })
      job.value = currentRoutingGroup.value["schedule"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["schedule"] : {}
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

async function updateGroupStatus(event: CustomEvent) {
  job.value.paused = event.detail.value

  const payload = {
    routingGroupId: props.routingGroupId,
    paused: job.value.paused,
    cronExpression: job.value.cronExpression || "0 0 0 * * ?"
  }

  try {
    const resp = await OrderRoutingService.scheduleBrokering(payload)
    if(!hasError(resp)){
      job.value.cronExpression = job.value.cronExpression || "0 0 0 * * ?"
      showToast(translate("Group status updated"))
    } else {
      throw resp.data
    }
  } catch(err) {
    showToast(translate("Failed to update group status"))
    logger.error(err)
  }
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

        // If we archive/unarchive a route and without saving the changes, creates a new route then the changes in the route status are lost.
        // Added the below logic to maintain the state of unarchived/archived route when the status changes are not saved
        // and user creates a new route
        const archivedRoutingIds = getArchivedOrderRoutings()?.map((routing: Route) => routing.orderRoutingId)
        const activeRoutingIds = orderRoutings.value.filter((routing: Route) => routing.statusId === "ROUTING_ACTIVE")?.map((routing: Route) => routing.orderRoutingId)
        const draftRoutingIds = orderRoutings.value.filter((routing: Route) => routing.statusId === "ROUTING_DRAFT")?.map((routing: Route) => routing.orderRoutingId)
        const routings = JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"]
        routings.map((routing: any) => {
          if(archivedRoutingIds.includes(routing.orderRoutingId)) {
            routing.statusId = "ROUTING_ARCHIVED"
          }

          if(activeRoutingIds.includes(routing.orderRoutingId)) {
            routing.statusId = "ROUTING_ACTIVE"
          }

          if(draftRoutingIds.includes(routing.orderRoutingId)) {
            routing.statusId = "ROUTING_DRAFT"
          }
        })

        orderRoutings.value = routings
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

async function editGroupName() {
  isGroupNameUpdating.value = !isGroupNameUpdating.value;
  // Waiting for DOM updations before focus inside the text-area, as it is conditionally rendered in the DOM
  await nextTick()
  groupNameRef.value.$el.setFocus();
}

async function updateGroupName() {
  if(groupName.value.trim() && groupName.value.trim() !== currentRoutingGroup.value.groupName.trim()) {
    const routingGroupId = await updateRoutingGroup({ routingGroupId: props.routingGroupId, productStoreId: currentRoutingGroup.value.productStoreId, groupName: groupName.value })
    if(routingGroupId) {
      await store.dispatch("orderRouting/setCurrentGroup", { ...currentRoutingGroup.value, groupName: groupName.value })
    } else {
      groupName.value = currentRoutingGroup.value.groupName.trim()
    }
  }

  isGroupNameUpdating.value = false
}

async function updateGroupDescription() {
  // Do not update description, if the desc is unchanged, and we do not have routingGroupId
  // If the group does not have a description then we get `undefined` and if the description entered by the user is left empty then `undefined != ''` is true and thus it makes an api call, even when description is unchanged in this case.
  if(props.routingGroupId && ((currentRoutingGroup.value.description || description.value) && currentRoutingGroup.value.description != description.value)) {
    const routingGroupId = await updateRoutingGroup({ routingGroupId: props.routingGroupId, productStoreId: currentRoutingGroup.value.productStoreId, description: description.value })
    if(routingGroupId) {
      await store.dispatch("orderRouting/setCurrentGroup", { ...currentRoutingGroup.value, description: description.value })
    } else {
      description.value = currentRoutingGroup.value.description
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
    componentProps: {
      archivedRoutings: getArchivedOrderRoutings(),
      // Passed a function as prop to update the routings whenever routing is unarchived from a modal
      saveRoutings: (routings: any) => {
        if(routings) {
          hasUnsavedChanges.value = true
          orderRoutings.value = sortSequence(getActiveAndDraftOrderRoutings().concat(routings))
        }
        initializeOrderRoutings()
      }
    }
  })

  archivedRoutingModal.present();
}

async function openRoutingHistoryModal(orderRoutingId: string, routingName: string) {
  await store.dispatch("orderRouting/fetchRoutingHistory", props.routingGroupId)
  const routingHistoryModal = await modalController.create({
    component: RoutingHistoryModal,
    componentProps: { routingHistory: routingHistory.value[orderRoutingId], routingName, groupName: currentRoutingGroup.value.groupName }
  })

  routingHistoryModal.present();
}

async function openScheduleModal() {
  const scheduleModal = await modalController.create({
    component: ScheduleModal,
    componentProps: { cronExpression: job.value.cronExpression }
  })

  scheduleModal.onDidDismiss().then(async (result: any) => {
    if(result?.data?.expression) {
      job.value.cronExpression = result.data.expression
      await saveSchedule()
    }
  })

  scheduleModal.present();
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
  await fetchGroupHistory()
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

async function cloneGroup() {
  const payload = {
    routingGroupId: currentRoutingGroup.value.routingGroupId,
    newGroupName: `${currentRoutingGroup.value.groupName} copy`
  }
  try {
    const resp = await OrderRoutingService.cloneGroup(payload)

    if(!hasError(resp)) {
      // Not fetching the groups list as after cloning as we do not need any information from the newly cloned group
      showToast(translate("Brokering run cloned"))
    } else {
      throw resp.data
    }
  } catch(err) {
    showToast(translate("Failed to clone brokering run"))
    logger.error(err)
  }
}

async function cloneRouting(routing: any) {
  emitter.emit("presentLoader", { message: "Cloning route", backdropDismiss: false })

  const orderRoutingId = await store.dispatch("orderRouting/cloneOrderRouting", {
    orderRoutingId: routing.orderRoutingId,
    orderRoutingName: routing.routingName,
    routingGroupId: props.routingGroupId
  })

  // Updating the order routings as we have created a new route that needs to be added on the UI
  if(orderRoutingId) {
    orderRoutings.value = currentRoutingGroup.value["routings"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"] : []
    initializeOrderRoutings()
  }

  emitter.emit("dismissLoader")
}

async function getProductStoreReservation() {
  try {
    const resp = await UtilService.getProductStoreInfo()

    if(resp.data) {
      isBrokeringEnabled.value = !resp.data.enableBrokering || resp.data.enableBrokering === "Y"
    }
  } catch(err) {
    logger.error("Failed to get the product store information related to reservation")
  }
}

async function toggleReservation(event: CustomEvent) {
  let enableBrokering = "N"

  if(!event.detail.checked) {
    enableBrokering = "Y"
  }

  try {
    await UtilService.updateProductStoreInfo({
      productStoreId: currentEComStore.value.productStoreId,
      enableBrokering
    })
  } catch(err) {
    showToast(translate("Failed to pause the brokering"))
    logger.error("Failed to update the brokering for product store")
  }
}

async function getTestSessions() {
  activeTestSessions.value = 0
  const testSessions = await UtilService.getTestSessions({
    customParametersMap: {
      sessionTypeEnumId: "ROUTING_TEST_DRIVE",
      productStoreId: currentEComStore.value.productStoreId
    },
    selectedEntity: "co.hotwax.user.UserSession",
    pageLimit: 100,
    filterByDate: true
  });
  activeTestSessions.value = testSessions.length
}
</script>

<style scoped>
ion-content > div {
  display: grid;
  grid-template-columns: 1fr minmax(375px, 25%);
  height: 100%;
}

.save-batches {
  position: sticky;
  bottom: 0;
  border-top: 1px solid #92949C;
}

aside {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-left: 1px solid #92949C;
}

.route-details {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  align-items: start;
}

.info {
  grid-column: span 2;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(345px, 1fr));
}

.info > div {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

ion-card > ion-button[expand="block"] {
  margin-inline: var(--spacer-sm);
  margin-bottom: var(--spacer-sm);
}

ion-reorder ion-chip {
  cursor: grab;
}

/* We need to disable pointer events from the card, but we do not want its styling to be changed thus defined this class to unset the opacity when reordering is enabled */
.reordering-enabled.card-disabled {
  opacity: unset;
}
</style>
