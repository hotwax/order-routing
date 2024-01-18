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
            <ion-card v-for="routing in getActiveAndDraftOrderRoutings()" :key="routing.orderRoutingId" @click="redirect(routing.orderRoutingId)">
              <ion-item lines="full">
                <ion-label>
                  <h1>{{ routing.routingName }}</h1>
                </ion-label>
                <ion-chip>{{ `${routing.sequenceNum}/4` }}</ion-chip>
              </ion-item>
              <ion-item>
                <ion-badge :color="routingStatus[routing.statusId]?.color">{{ routingStatus[routing.statusId]?.desc || routing.statusId }}</ion-badge>
                <ion-button fill="clear" color="medium" slot="end">
                  {{ "Archive" }}
                  <ion-icon :icon="archiveOutline" />
                </ion-button>
              </ion-item>
            </ion-card>
          </ion-list>
          <div>
            <ion-item lines="none">
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
              <ion-button fill="clear" slot="end" @click="updateGroupDescription()">
                {{ "Edit" }}
              </ion-button>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                {{ currentRoutingGroup.description ? currentRoutingGroup.description : "No description available" }}
              </ion-label>
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
                <ion-icon slot="start" :icon="timeOutline"/>
                <ion-label>{{ "Run time" }}</ion-label>
                <!-- <ion-label slot="end">{{ currentRoutingGroup.runTime || "-" }}</ion-label> -->
              </ion-item>
              <ion-item>
                <ion-icon slot="start" :icon="timerOutline"/>
                <ion-label>{{ "Schedule" }}</ion-label>
                <!-- <ion-label slot="end">{{ currentRoutingGroup.frequency || "-" }}</ion-label> -->
              </ion-item>
            </ion-card>
            <ion-item>
              {{ `Created at ${currentRoutingGroup.createdDate || "-"}` }}
            </ion-item>
            <ion-item>
              {{ `Updated at ${currentRoutingGroup.lastUpdatedStamp || "-"}` }}
            </ion-item>
          </aside>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardHeader, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonTitle, IonToolbar, onIonViewWillEnter, alertController } from "@ionic/vue";
import { addCircleOutline, archiveOutline, timeOutline, timerOutline } from "ionicons/icons"
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps } from "vue";
import { Group, Route } from "@/types";
import { OrderRoutingService } from "@/services/RoutingService";

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

const routingStatus = JSON.parse(process.env?.VUE_APP_ROUTE_STATUS_ENUMS as string)

const currentRoutingGroup = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const orderRoutings = computed(() => store.getters["orderRouting/getOrderRoutings"])

onIonViewWillEnter(async () => {
  await store.dispatch("orderRouting/fetchOrderRoutings", props.routingGroupId)

  // On refresh, the groups list is removed thus resulting is not fetching the current group information
  if(!currentRoutingGroup.value.routingGroupId) {
    await store.dispatch("orderRouting/fetchOrderRoutingGroups")
  }
})

async function redirect(orderRoutingId: string) {
  await store.dispatch('orderRouting/setCurrentOrderRoutingId', orderRoutingId)
  router.push(`${orderRoutingId}/rules`)
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
    const routingName = result.data?.values?.routingName;
    if(routingName && props.routingGroupId) {
      // TODO: check for the default value of params
      const payload = {
        orderRoutingId: "",
        routingGroupId: props.routingGroupId,
        statusId: "ROUTING_DRAFT",
        routingName,
        sequenceNum: 0,
        description: ""
      }

      await OrderRoutingService.createOrderRouting(payload)
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
  const newRouteAlert = await alertController.create({
    header: "Add Group Description",
    buttons: [{
      text: "Cancel",
      role: "cancel"
    }, {
      text: "Save"
    }],
    inputs: [{
      type: "textarea",
      name: "groupDescription",
      placeholder: "description"
    }]
  })

  newRouteAlert.onDidDismiss().then(async (result: any) => {
    const groupDescription = result.data?.values?.groupDescription;
    if(groupDescription && props.routingGroupId) {
      // TODO: check for the default value of params
      const payload = {
        routingGroupId: props.routingGroupId,
        description: groupDescription,
      }

      await store.dispatch("orderRouting/updateRoutingGroup", payload)
    }
  })

  return newRouteAlert.present();
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
</style>
