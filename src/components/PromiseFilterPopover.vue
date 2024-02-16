<template>
  <ion-content>
    <ion-list>
      <ion-list-header>
        <ion-label>{{ translate("Promise date") }}</ion-label>
      </ion-list-header>
      <ion-item button @click="updatePromiseDate()">
        <ion-label>{{ translate("Already passed") }}</ion-label>
      </ion-item>
      <ion-item button @click="updatePromiseDate('Upcoming duration')">
        <ion-label>{{ translate("Upcoming duration") }}</ion-label>
      </ion-item>
      <ion-item button lines="none" @click="updatePromiseDate('Passed duration', true)">
        <ion-label>{{ translate("Passed duration") }}</ion-label>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import { IonContent, IonItem, IonLabel, IonList, IonListHeader, alertController, popoverController } from "@ionic/vue";

async function updatePromiseDate(header = '', isPastDuration = false) {
  let duration = 0

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
      text: translate("Save")
    }],
    inputs: [{
      name: "duration",
      placeholder: translate("duration")
    }]
  })

  durationAlert.onDidDismiss().then(async (result: any) => {
    // considered that if a role is available on dismiss, it will be a negative role in which we don't need to perform any action
    if(result.role) {
      return;
    }

    // TODO: add checks for duration value
    const duration = result.data?.values?.duration;
    popoverController.dismiss({ duration, isPastDuration })
  })

  return durationAlert.present();
}
</script>