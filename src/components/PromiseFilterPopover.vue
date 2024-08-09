<template>
  <ion-content>
    <ion-list>
      <ion-list-header>
        <ion-label>{{ translate("Promise date") }}</ion-label>
      </ion-list-header>
      <ion-item :color="value == 0 ? 'light' : ''" button @click="updatePromiseDate()">
        <ion-label>{{ translate("Already passed") }}</ion-label>
      </ion-item>
      <ion-item :color="value > 0 ? 'light' : ''" button @click="updatePromiseDate('Upcoming duration')">
        <ion-label>{{ translate("Upcoming duration") }}</ion-label>
      </ion-item>
      <ion-item :color="value < 0 ? 'light' : ''" button lines="none" @click="updatePromiseDate('Passed duration', true)">
        <ion-label>{{ translate("Passed duration") }}</ion-label>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import { showToast } from "@/utils";
import { IonContent, IonItem, IonLabel, IonList, IonListHeader, alertController, popoverController } from "@ionic/vue";
import { defineProps } from "vue";

const props = defineProps([ "value" ])

async function updatePromiseDate(header = '', isPastDuration = false) {
  let duration = "0"

  if(!header) {
    popoverController.dismiss({ duration })
    return;
  }

  const durationAlert = await alertController.create({
    header: translate(header),
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save"),
      handler: (data: any) => {
        const duration = data?.duration;
        if(!duration) {
          showToast(translate("Enter a valid value"))
          return false;
        }
      }
    }],
    inputs: [{
      name: "duration",
      placeholder: translate("duration"),
      min: 0,
      type: "number",
      value: props.value > 0 && !isPastDuration ? props.value : props.value < 0 && isPastDuration ? props.value?.replace("-", "") : '', // Prefill the value only when the previously selected option and current selection matches
      attributes: {
        // Added check to not allow mainly .(period) and other special characters to be entered in the alert input
        onkeydown: ($event: any) => {
          if(/[`!@#$%^&*()_+\-=\\|,.<>?~]/.test($event.key)) $event.preventDefault();
        }
      }
    }]
  })

  durationAlert.onDidDismiss().then(async (result: any) => {
    // considered that if a role is available on dismiss, it will be a negative role in which we don't need to perform any action
    if(result.role) {
      return;
    }

    const duration = result.data?.values?.duration;

    // Remove all the characters except numbers
    const value = duration.replace(/[^0-9 ]/g, "");

    popoverController.dismiss({ duration: value, isPastDuration })
  })

  return durationAlert.present();
}
</script>