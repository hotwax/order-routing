<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>{{ "Brokering run name" }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div>
        <div>
          <ion-list>
            <ion-list-header>
              <ion-label>{{ "Order batches" }}</ion-label>
              <ion-button color="primary" fill="clear" @click="createOrderRoute">
                {{ "New" }}
                <ion-icon :icon="addCircleOutline" />
              </ion-button>
            </ion-list-header>
            <ion-reorder-group @ionItemReorder="doReorder($event)" :disabled="false">
              <ion-card v-for="(routing, index) in routingsForReorder" :key="routing.orderRoutingId" @click.prevent="redirect(routing)">
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
                <ion-item>
                  <ion-badge v-if="routing.statusId === 'ROUTING_DRAFT'" :color="routingStatus[routing.statusId]?.color" @click.stop="updateOrderRouting(routing, 'statusId', 'ROUTING_ACTIVE')">{{ routingStatus[routing.statusId]?.desc || routing.statusId }}</ion-badge>
                  <ion-badge v-else :color="routingStatus[routing.statusId]?.color">{{ routingStatus[routing.statusId]?.desc || routing.statusId }}</ion-badge>
                  <ion-button fill="clear" color="medium" slot="end" @click.stop="updateOrderRouting(routing, 'statusId', 'ROUTING_ARCHIVED')">
                    {{ "Archive" }}
                    <ion-icon :icon="archiveOutline" />
                  </ion-button>
                </ion-item>
              </ion-card>
            </ion-reorder-group>
          </ion-list>
          <div>
            <ion-item button lines="none" @click="openArchivedRoutingModal()">
              <ion-icon slot="start" :icon="archiveOutline" />
              <ion-label>{{ "Archive" }}</ion-label>
              <ion-badge color="medium">{{ getArchivedOrderRoutings().length }}{{ " rules" }}</ion-badge>
            </ion-item>
          </div>
        </div>
        <section class="ion-padding">
          <main>
            <ion-item lines="none">
              {{ "Description" }}
              <ion-button fill="clear" slot="end" @click="isDescUpdating ? updateGroupDescription() : (isDescUpdating = !isDescUpdating)">
                {{ isDescUpdating ? "Save" : "Edit" }}
              </ion-button>
            </ion-item>
            <ion-item :color="isDescUpdating ? 'light' : ''" lines="none">
              <ion-textarea v-if="isDescUpdating" aria-label="description" v-model="description"></ion-textarea>
              <ion-label v-else>{{ description }}</ion-label>
            </ion-item>
          </main>
          <aside>
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  {{ "Scheduler" }}
                </ion-card-title>
              </ion-card-header>
              <ion-item>
                <ion-icon slot="start" :icon="timerOutline"/>
                <ion-select label="Schedule" interface="popover" :placeholder="$t('Select')" :value="job.cronExpression" @ionChange="updateCronExpression($event)">
                  <ion-select-option v-for="(expression, description) in cronExpressions" :key="expression" :value="expression">{{ description }}</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-card>
            <div class="actions desktop-only">
              <div>
                <ion-button size="small" fill="outline" color="danger" @click="disable">{{ "Disable" }}</ion-button>
              </div>
              <div>
                <ion-button size="small" fill="outline" @click="saveChanges()">{{ "Save changes" }}</ion-button>
              </div>
            </div>
            <ion-item>
              {{ `Created at ${getTime(currentRoutingGroup.createdDate)}` }}
            </ion-item>
            <ion-item>
              {{ `Updated at ${getTime(currentRoutingGroup.lastUpdatedStamp)}` }}
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
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardHeader, IonCardTitle, IonChip, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter, onIonViewWillLeave } from "@ionic/vue";
import { addCircleOutline, archiveOutline, reorderTwoOutline, saveOutline, timerOutline } from "ionicons/icons"
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps, ref } from "vue";
import { Group, Route } from "@/types";
import ArchivedRoutingModal from "@/components/ArchivedRoutingModal.vue"
import { OrderRoutingService } from "@/services/RoutingService";
import logger from "@/logger";
import { DateTime } from "luxon";
import { hasError, getTime, showToast, sortSequence } from "@/utils";

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

const routingStatus = JSON.parse(process.env?.VUE_APP_ROUTE_STATUS_ENUMS as string)
const cronExpressions = JSON.parse(process.env?.VUE_APP_CRON_EXPRESSIONS as string)
let routingsForReorder = ref([])
let description = ref("")
let isDescUpdating = ref(false)
let hasUnsavedChanges = ref(false)

let job = ref({}) as any
let orderRoutings = ref([]) as any

const currentRoutingGroup: any = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])

onIonViewWillEnter(async () => {
  await store.dispatch("orderRouting/fetchCurrentRoutingGroup", props.routingGroupId)

  job.value = currentRoutingGroup.value["schedule"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["schedule"] : {}
  orderRoutings.value = currentRoutingGroup.value["routings"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"] : []
  description.value = currentRoutingGroup.value["description"] ? currentRoutingGroup.value["description"] : ""
  
  if(orderRoutings.value.length) {
    initializeOrderRoutings();
  }
})

onBeforeRouteLeave(async (to) => {
  if(to.path === '/login') return;
  let canLeave = false;

  const alert = await alertController.create({
    header: "Leave page",
    message: "Any edits made on this page will be lost.",
    buttons: [
      {
        text: "STAY",
        handler: () => {
          canLeave = false;
        },
      },
      {
        text: "LEAVE",
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

async function saveChanges() {
  if(!job.value.cronExpression) {
    logger.error('Please select an expression before proceeding')
  }

  const payload = {
    routingGroupId: props.routingGroupId,
    paused: "N",  // considering job in active status as soon as scheduled
    ...job.value
  }

  try {
    const resp = await OrderRoutingService.scheduleBrokering(payload)
    if(!hasError(resp)){
      showToast("Job updated")
    }
  } catch(err) {
    logger.error(err)
  }
}

async function disable() {
  const payload = {
    routingGroupId: props.routingGroupId,
    paused: "Y"  // setting Y to disable the job
  }

  try {
    const resp = await OrderRoutingService.scheduleBrokering(payload)
    if(!hasError(resp)){
      showToast("Job disabled")
    }
  } catch(err) {
    logger.error(err)
  }
}

async function redirect(orderRouting: Route) {
  await store.dispatch('orderRouting/setCurrentOrderRouting', orderRouting)
  router.push(`${orderRouting.orderRoutingId}/rules`)
}

async function createOrderRoute() {
  const newRouteAlert = await alertController.create({
    header: "New Order Route",
    buttons: [{
      text: "Cancel",
      role: "cancel"
    }, {
      text: "Save"
    }],
    inputs: [{
      name: "routingName",
      placeholder: "Route name"
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
  return orderRoutings.value.filter((routing: Route) => routing.statusId !== 'ROUTING_ARCHIVED')
}

function getArchivedOrderRoutings() {
  return orderRoutings.value.filter((routing: Route) => routing.statusId === 'ROUTING_ARCHIVED')
}

async function updateGroupDescription() {
  // Do not update description, if the desc is unchanged, and we do not have routingGroupId, and description is left empty
  if(props.routingGroupId && currentRoutingGroup.value.description !== description.value) {
    const routingGroupId = await updateRoutingGroup({ routingGroupId: props.routingGroupId, productStoreId: currentEComStore.value.productStoreId, description: description.value })
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
    productStoreId: currentEComStore.value.productStoreId,
    routings
  }

  const routingGroupId = await updateRoutingGroup(payload)
  if(routingGroupId) {
    hasUnsavedChanges.value = false
    await store.dispatch("orderRouting/setCurrentGroup", { ...currentRoutingGroup.value, routings: JSON.parse(JSON.stringify(orderRoutings.value)) })
  }
}

async function updateRoutingGroup(payload: any) {
  let routingGroupId = ''
  try {
    const resp = await OrderRoutingService.updateRoutingGroup(payload);

    if(!hasError(resp) && resp.data.routingGroupId) {
      routingGroupId = resp.data.routingGroupId
      showToast("Routing group information updated")
    } else {
      throw resp.data
    }
  } catch(err) {
    showToast("Failed to update group information")
    logger.error(err);
  }

  return routingGroupId
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
