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
        <ion-fab-button :disabled="!routingsToUpdate.length">
          <ion-icon :icon="saveOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardHeader, IonCardTitle, IonChip, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonTextarea, IonTitle, IonToolbar, alertController, modalController, onIonViewWillEnter, onIonViewWillLeave } from "@ionic/vue";
import { addCircleOutline, archiveOutline, reorderTwoOutline, saveOutline, timerOutline } from "ionicons/icons"
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps, ref } from "vue";
import { Group, Route } from "@/types";
import ArchivedRoutingModal from "@/components/ArchivedRoutingModal.vue"
import emitter from "@/event-bus";
import { OrderRoutingService } from "@/services/RoutingService";
import logger from "@/logger";
import { DateTime } from "luxon";
import { hasError, showToast } from "@/utils";

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
let routingsToUpdate = ref([])
let initialRoutingsOrder = ref([])
let routingsForReorder = ref([])
let description = ref('')
let isDescUpdating = ref(false)

let job = ref({}) as any

const currentRoutingGroup: any = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const orderRoutings = computed(() => store.getters["orderRouting/getOrderRoutings"])

onIonViewWillEnter(async () => {
  await Promise.all([store.dispatch("orderRouting/fetchOrderRoutings", props.routingGroupId), store.dispatch("orderRouting/fetchCurrentRoutingGroup", props.routingGroupId)])

  initializeOrderRoutings();

  job.value = currentRoutingGroup.value["schedule"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["schedule"] : {}

  description.value = currentRoutingGroup.value.description ? currentRoutingGroup.value.description : "No description available"
  emitter.on("initializeOrderRoutings", initializeOrderRoutings)
})

onIonViewWillLeave(() => {
  emitter.off("initializeOrderRoutings", initializeOrderRoutings)
})

function updateCronExpression(event: CustomEvent) {
  job.value.cronExpression = event.detail.value
}

function getTime(time: any) {
  return time ? DateTime.fromMillis(time).toLocaleString(DateTime.DATETIME_MED) : '-';
}

function initializeOrderRoutings() {
  initialRoutingsOrder.value = JSON.parse(JSON.stringify(getActiveAndDraftOrderRoutings()))
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
        sequenceNum: orderRoutings.value.length && orderRoutings.value[orderRoutings.value.length - 1].sequenceNum >= 0 ? orderRoutings.value[orderRoutings.value.length - 1].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new route seqNum to 0
        description: ""
      }

      const orderRoutingId = await store.dispatch("orderRouting/createOrderRouting", payload)

      // update the routing order for reordering
      if(orderRoutingId) {
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
  // Do not update description, if the desc is unchanged, we do not have routingGroupId, and description is leaft empty
  if(description.value && props.routingGroupId && currentRoutingGroup.value.description !== description.value) {
    await store.dispatch("orderRouting/updateRoutingGroup", { routingGroupId: props.routingGroupId, fieldToUpdate: 'description', value: description.value })
  }
  isDescUpdating.value = false
}

function findRoutingsDiff(previousSeq: any, updatedSeq: any) {
  const diffSeq: any = Object.keys(previousSeq).reduce((diff, key) => {
    if (updatedSeq[key].orderRoutingId === previousSeq[key].orderRoutingId) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, {})
  return diffSeq;
}

function doReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(initialRoutingsOrder.value))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(routingsForReorder.value)));

  let diffSeq = findRoutingsDiff(previousSeq, updatedSeq)

  const updatedSeqenceNum = previousSeq.map((routing: Route) => routing.sequenceNum)
  Object.keys(diffSeq).map((key: any) => {
    diffSeq[key].sequenceNum = updatedSeqenceNum[key]
  })

  diffSeq = Object.keys(diffSeq).map((key) => diffSeq[key])

  routingsForReorder.value = updatedSeq
  routingsToUpdate.value = diffSeq
}

async function openArchivedRoutingModal() {
  const archivedRoutingModal = await modalController.create({
    component: ArchivedRoutingModal,
    componentProps: { archivedRoutings: getArchivedOrderRoutings() }
  })
  archivedRoutingModal.present();
}

async function updateOrderRouting(routing: Route, fieldToUpdate: string, value: string) {
  const orderRoutingId = await store.dispatch("orderRouting/updateOrderRouting", { orderRoutingId: routing.orderRoutingId, fieldToUpdate, value })
  if(orderRoutingId) {
    initializeOrderRoutings()
  }
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

ion-modal.date-time-modal {
  --width: 290px;
  --height: 440px;
  --border-radius: 8px;
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
