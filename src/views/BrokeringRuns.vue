<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ "Brokering Runs" }}</ion-title>
        
        <ion-buttons slot="end">
          <ion-button color="primary" @click="addNewRun">
            {{ "New Run" }}
            <ion-icon :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <main>
        <section>
          <ion-card @click="router.push('brokering/route')">
            <ion-card-header>
              <ion-card-title>
                {{ "Brokering run name" }}
              </ion-card-title>
            </ion-card-header>
            <ion-item>
              {{ "Description" }}
            </ion-item>
            <ion-item>
              <ion-label>{{ "<Frequency>" }}</ion-label>
              <ion-label slot="end">{{ "<Runtime>" }}</ion-label>
            </ion-item>
            <ion-item>
              {{ "Created at <time>" }}
            </ion-item>
            <ion-item>
              {{ "Updated at <time>" }}
            </ion-item>
          </ion-card>
          <ion-card @click="router.push('brokering/route')">
            <ion-card-header>
              <ion-card-title>
                {{ "Brokering run name" }}
              </ion-card-title>
            </ion-card-header>
            <ion-item>
              {{ "Description" }}
            </ion-item>
            <ion-item>
              {{ "<Frequency>" }}
              {{ "<Runtime>" }}
            </ion-item>
            <ion-item>
              {{ "Created at <time>" }}
            </ion-item>
            <ion-item>
              {{ "Updated at <time>" }}
            </ion-item>
          </ion-card>
          <ion-card @click="router.push('brokering/route')">
            <ion-card-header>
              <ion-card-title>
                {{ "Brokering run name" }}
              </ion-card-title>
            </ion-card-header>
            <ion-item>
              {{ "Description" }}
            </ion-item>
            <ion-item>
              {{ "<Frequency>" }}
              {{ "<Runtime>" }}
            </ion-item>
            <ion-item>
              {{ "Created at <time>" }}
            </ion-item>
            <ion-item>
              {{ "Updated at <time>" }}
            </ion-item>
          </ion-card>
          <ion-card @click="router.push('brokering/route')">
            <ion-card-header>
              <ion-card-title>
                {{ "Brokering run name" }}
              </ion-card-title>
            </ion-card-header>
            <ion-item>
              {{ "Description" }}
            </ion-item>
            <ion-item>
              {{ "<Frequency>" }}
              {{ "<Runtime>" }}
            </ion-item>
            <ion-item>
              {{ "Created at <time>" }}
            </ion-item>
            <ion-item>
              {{ "Updated at <time>" }}
            </ion-item>
          </ion-card>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import store from "@/store";
import { IonButton, IonButtons, IonCard, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonPage, IonTitle, IonToolbar, alertController, onIonViewWillEnter } from "@ionic/vue";
import { addOutline } from "ionicons/icons"
import { useRouter } from "vue-router";

onIonViewWillEnter(async () => {
  await store.dispatch('orderRouting/fetchOrderRoutingGroups');
})

async function addNewRun() {
  const newRunAlert = await alertController.create({
    header: "New Run",
    buttons: [{
      text: "Cancel",
      role: "cancel"
    }, {
      text: "Save"
    }],
    inputs: [{
      name: "runName",
      placeholder: "Run name"
    }]
  })

  return newRunAlert.present();
}

const router = useRouter();
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
