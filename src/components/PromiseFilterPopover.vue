<template>
  <ion-content>
    <ion-list>
      <ion-list-header>
        <ion-label>{{ $t("Promise date") }}</ion-label>
      </ion-list-header>
      <ion-item button @click="updatePromiseDate()">
        <ion-label>{{ $t("Already passed") }}</ion-label>
      </ion-item>
      <ion-item button @click="updatePromiseDate('Upcoming duration')">
        <ion-label>{{ $t("Upcoming duration") }}</ion-label>
      </ion-item>
      <ion-item button lines="none" @click="updatePromiseDate('Passed duration', true)">
        <ion-label>{{ $t("Passed duration") }}</ion-label>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { IonContent, IonItem, IonLabel, IonList, IonListHeader, alertController, popoverController } from "@ionic/vue";

async function updatePromiseDate(header = '', isPastDuration = false) {
  let duration = 0

  if(!header) {
    popoverController.dismiss({ duration })
    return;
  }

  const durationAlert = await alertController.create({
    header,
    buttons: [{
      text: "Cancel",
      role: "cancel"
    }, {
      text: "Save"
    }],
    inputs: [{
      name: "duration",
      placeholder: "duration"
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