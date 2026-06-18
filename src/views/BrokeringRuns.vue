<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Brokering Runs") }}</ion-title>
        
        <ion-buttons slot="end" v-if="brokeringGroups.length">
          <ion-button color="primary" @click="addNewRun">
            {{ translate("New Run") }}
            <ion-icon :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
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
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import EmptyState from "@/components/EmptyState.vue";
import GroupActionsPopover from "@/components/GroupActionsPopover.vue";
import { Group } from "@/types";
import { emitter, translate, commonUtil } from "@common";
import { IonBadge, IonButton, IonButtons, IonCard, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonPage, IonSpinner, IonTitle, IonToolbar, alertController, onIonViewWillEnter, onIonViewWillLeave, popoverController } from "@ionic/vue";
import { addOutline, ellipsisVerticalOutline } from "ionicons/icons"
import cronstrue from "cronstrue";
import { computed, ref } from "vue";
import router from "@/router";
import { useUserStore } from "@/store/userStore";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { useUtilStore } from "@/store/utilStore";

const userStore = useUserStore()
const utilStore = useUtilStore()
const groups = computed(() => orderRoutingStore().getRoutingGroups)
const userProfile = computed(() => userStore.getUserProfile)

const cronExpressions = JSON.parse(import.meta.env?.VITE_CRON_EXPRESSIONS)
const brokeringRunsEmptyImage = new URL("../assets/images/BrokeringRunsEmptyState.png", import.meta.url).href

let isLoading = ref(false)
let brokeringGroups = ref([]) as any

onIonViewWillEnter(async () => {
  await fetchRuns()
  emitter.on("productStoreOrConfigChanged", fetchRuns)
})

onIonViewWillLeave(() => {
  emitter.off("productStoreOrConfigChanged", fetchRuns)
})

async function fetchRuns() {
  isLoading.value = true
  await orderRoutingStore().fetchOrderRoutingGroups();
  isLoading.value = false
  brokeringGroups.value = JSON.parse(JSON.stringify(groups.value))
  utilStore.fetchEnums({ parentTypeId: "ORDER_ROUTING" })
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
    // considering that if we have role, then its negative action and thus not need to create run
    if(result.role) {
      return;
    }

    if(result.data?.values?.runName.trim()) {
      await orderRoutingStore().createRoutingGroup(result.data.values.runName.trim())
      brokeringGroups.value = JSON.parse(JSON.stringify(groups.value))
    }
  })

  return newRunAlert.present();
}

function getScheduleFrequency(brokeringGroupObj: any) {
  let description: any = "";
  description = Object.keys(cronExpressions).find(key => cronExpressions[key] === brokeringGroupObj.cronExpression);

  if (!description && brokeringGroupObj.cronExpression) {
    description = cronstrue.toString(brokeringGroupObj.cronExpression);
    // Capitalize first letter if it starts with a lowercase letter
    if (/^[a-z]/.test(description)) {
      description = description.charAt(0).toUpperCase() + description.slice(1);
    }
  }
  return description || "-";
}

function redirect(group: Group) {
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

  main > section {
    max-width: 50ch;
  }
}
</style>
