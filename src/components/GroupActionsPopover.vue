<template>
  <ion-content>
    <ion-list>
      <ion-list-header>{{ group.groupName }}</ion-list-header>
      <ion-item button @click="runNow">
        <ion-icon slot="start" :icon="flashOutline" />
        {{ translate("Run now") }}
      </ion-item>
      <ion-item lines="none" button v-if="group.schedule?.paused === 'N'" @click="updateGroupStatus('Y')">
        <ion-icon slot="start" :icon="pauseOutline" />
        {{ translate("Move to Draft") }}
      </ion-item>
      <ion-item lines="none" button v-else @click="updateGroupStatus('N')">
        <ion-icon slot="start" :icon="playOutline" />
        {{ translate("Activate") }}
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { alertController, IonContent, IonIcon, IonItem, IonList, IonListHeader, popoverController } from "@ionic/vue";
import { flashOutline, pauseOutline, playOutline } from 'ionicons/icons'
import { defineProps } from "vue"
import { OrderRoutingService } from "@/services/RoutingService";
import { logger, translate, commonUtil } from "@common";
import { useOrderRoutingStore } from "@/store/useOrderRoutingStore";

const orderRoutingStore = useOrderRoutingStore()

const props = defineProps(["group"])

async function updateGroupStatus(paused: string) {
  let routingGroups = [];
  const payload = {
    routingGroupId: props.group.routingGroupId,
    paused,
    cronExpression: props.group.schedule?.cronExpression || "0 0 0 * * ?"
  }

  try {
    const resp = await OrderRoutingService.scheduleBrokering(payload)
    if(!commonUtil.hasError(resp)) {
      commonUtil.showToast(translate("Group status updated"))
      routingGroups = await orderRoutingStore.updateGroupStatus({ routingGroupId: props.group.routingGroupId, value: paused })
    } else {
      throw resp.data
    }
  } catch(err) {
    commonUtil.showToast(translate("Failed to update group status"))
    logger.error(err)
  }

  popoverController.dismiss({ routingGroups });
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
            popoverController.dismiss()

            const job = props.group?.schedule || {}
            // Checking that if we already have the job schedule before calling runNow, because if the job scheduler is not present then runNow action can't be performed
            // If the scheduler for the job is available then we will have jobName, if not then first scheduling the job in draft status just to create a routing schedule and then calling runNow action
            if(!job.jobName) {
              const payload = {
                routingGroupId: props.group.routingGroupId,
                paused: "Y",  // passing Y as we just need to configure the scheduler and do not need to schedule it in active state
              }

              try {
                const resp = await OrderRoutingService.scheduleBrokering(payload)
                if(commonUtil.hasError(resp)) {
                  throw resp.data
                }
                // Updating jobName as if the user again clicks the runNow button then in that we don't want to call the scheduleBrokering service
                job.jobName = resp.data.jobName
              } catch(err) {
                logger.error(err)
                return;
              }
            }

            try {
              const resp = await OrderRoutingService.runNow(props.group.routingGroupId)
              if(!commonUtil.hasError(resp) && resp.data.jobRunId) {
                commonUtil.showToast(translate("Service has been scheduled"))
              } else {
                throw resp.data
              }
            } catch(err) {
              commonUtil.showToast(translate("Failed to schedule service"))
              logger.error(err)
            }
          }
        }
      ]
    });

  return scheduleAlert.present();
}
</script> 