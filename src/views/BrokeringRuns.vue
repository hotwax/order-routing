<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Brokering Runs") }}</ion-title>
        
        <ion-buttons slot="end">
          <ion-button color="primary" @click="addNewRun">
            {{ translate("New Run") }}
            <ion-icon :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Adding find class only when we are displaying product stores, as adding this class takes specific space on page -->
      <div :class="userProfile?.stores?.length > 1 ? 'find' : ''">
        <aside class="filters" v-if="userProfile?.stores?.length > 1">
          <ion-list>
            <ion-list-header>{{ translate("Product Store") }}</ion-list-header>
            <ion-radio-group :value="currentEComStore.productStoreId" @ionChange="setEComStore($event)">
              <ion-item v-for="store in (userProfile ? userProfile.stores : [])" :key="store.productStoreId" lines="none">
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
                  <p>{{ getDateAndTime(group.createdDate) }}</p>
                </ion-label>
              </ion-item>
              <ion-item v-if="group.description">
                {{ group.description }}
              </ion-item>
              <ion-item v-if="group.schedule?.paused === 'N'">
                <ion-label>
                  {{ group.schedule ? getDateAndTime(group.schedule.nextExecutionDateTime) : "-" }}
                  <p>{{ group.schedule ? getScheduleFrequency(group.schedule.cronExpression) : "-" }}</p>
                </ion-label>
                <ion-badge slot="end" color="dark">
                  {{ group.schedule ? timeTillRun(group.schedule.nextExecutionDateTime) : "-" }}
                </ion-badge>
              </ion-item>
              <ion-item v-else>
                <!-- TODO: display lastRunTime, but as we are not getting the same in response, so displaying nextExecutionTime for now -->
                <ion-label>
                  {{ group.schedule ? getDateAndTime(group.schedule.nextExecutionDateTime) : "-" }}
                </ion-label>
                <ion-badge slot="end" color="dark">{{ translate("Draft") }}</ion-badge>
              </ion-item>
              <ion-item lines="none">
                {{ `Updated at ${getDateAndTime(group.lastUpdatedStamp)}` }}
                <ion-button fill="clear" color="medium" slot="end" @click.stop="groupActionsPopover(group, $event)">
                  <ion-icon slot="icon-only" :icon="ellipsisVerticalOutline" />
                </ion-button>
              </ion-item>
            </ion-card>
          </section>
        </main>
        <main v-else>
          <div class="empty-state">
            <img src="../assets/images/BrokeringRunsEmptyState.png" />
            <ion-button @click="addNewRun">
              {{ translate("Create brokering run") }}
              <ion-icon slot="end" :icon="arrowForwardOutline"></ion-icon>
            </ion-button>
          </div>
        </main>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import GroupActionsPopover from "@/components/GroupActionsPopover.vue";
import emitter from "@/event-bus";
import { translate } from "@/i18n";
import { Group } from "@/types";
import { getDateAndTime, showToast } from "@/utils";
import { IonBadge, IonButton, IonButtons, IonCard, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonRadioGroup, IonRadio, IonSpinner, IonTitle, IonToolbar, alertController, onIonViewWillEnter, popoverController } from "@ionic/vue";
import { addOutline, arrowForwardOutline, ellipsisVerticalOutline } from "ionicons/icons"
import { DateTime } from "luxon";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";

const store = useStore()
const router = useRouter()
const groups = computed(() => store.getters["orderRouting/getRoutingGroups"])
const userProfile = computed(() => store.getters["user/getUserProfile"])
const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])

const cronExpressions = JSON.parse(process.env?.VUE_APP_CRON_EXPRESSIONS)

let isLoading = ref(false)
let brokeringGroups = ref([]) as any

onIonViewWillEnter(async () => {
  isLoading.value = true
  await store.dispatch("orderRouting/fetchOrderRoutingGroups");
  isLoading.value = false
  brokeringGroups.value = JSON.parse(JSON.stringify(groups.value))
  store.dispatch("util/fetchEnums", { parentTypeId: "ORDER_ROUTING" })
})

function timeTillRun(time: any) {
  if(!time) {
    return;
  }

  const timeDiff = DateTime.fromMillis(time).diff(DateTime.local());
  return DateTime.local().plus(timeDiff).toRelative();
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
    // considering that if we have role, then its negative action and thus not need to create run
    if(result.role) {
      return;
    }

    if(result.data?.values?.runName.trim()) {
      await store.dispatch("orderRouting/createRoutingGroup", result.data.values.runName.trim())
      brokeringGroups.value = JSON.parse(JSON.stringify(groups.value))
    }
  })

  return newRunAlert.present();
}

async function setEComStore(event: CustomEvent) {
  emitter.emit("presentLoader")
  if(userProfile.value?.stores) {
    await store.dispatch("user/setEcomStore", {
      "productStoreId": event.detail.value
    })
    await store.dispatch("orderRouting/fetchOrderRoutingGroups");
    brokeringGroups.value = JSON.parse(JSON.stringify(groups.value))
  }
  emitter.emit("dismissLoader")
}

function getScheduleFrequency(cronExp: string) {
  return Object.entries(cronExpressions).find(([description, expression]) => expression === cronExp)?.[0] || "-"
}

async function redirect(group: Group) {
  router.push(`brokering/${group.routingGroupId}/routes`)
}

async function groupActionsPopover(group: Group, ev: Event) {
  const popover = await popoverController.create({
    component: GroupActionsPopover,
    showBackdrop: false,
    event: ev,
    componentProps: { group }
  });

  popover.onDidDismiss().then((result: any) => {
    if(result.data?.routingGroups?.length) {
      brokeringGroups.value = JSON.parse(JSON.stringify(result.data.routingGroups))
    }
  })

  return popover.present()
}

</script>

<style scoped>
@media (min-width: 991px) {
  main {
    display: flex;
    justify-content: center;
    align-items: start;
    gap: var(--spacer-2xl);
    max-width: 990px;
    margin: var(--spacer-base) auto 0;
  }

  main > section {
    min-width: 50ch;
  }
}
</style>
