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
      <main v-if="groups.length">
        <section>
          <ion-card v-for="group in groups" :key="group.routingGroupId" @click="router.push('brokering/route')">
            <ion-card-header>
              <ion-card-title>
                {{ group.groupName }}
              </ion-card-title>
            </ion-card-header>
            <ion-item>
              {{ group.description }}
            </ion-item>
            <ion-item>
              <ion-label>{{ group.frequency ? group.frequency : "-" }}</ion-label>
              <ion-label slot="end">{{ group.runTime ? group.runTime : "-" }}</ion-label>
            </ion-item>
            <ion-item>
              {{ group.createdDate ? group.createdDate : "-" }}
            </ion-item>
            <ion-item>
              {{ group.lastUpdatedStamp ? group.lastUpdatedStamp : "-" }}
            </ion-item>
          </ion-card>
        </section>
      </main>
      <main v-else>
        {{ "No runs scheduled" }}
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonCard, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonPage, IonTitle, IonToolbar, alertController, onIonViewWillEnter } from "@ionic/vue";
import { addOutline } from "ionicons/icons"
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";

const store = useStore()
const router = useRouter()
const groups = computed(() => store.getters['orderRouting/getRoutingGroups'])

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

  newRunAlert.onDidDismiss().then((result: any) => {
    if(result.data?.values?.runName) {
      store.dispatch('orderRouting/createBrokeringGroup', result.data.values.runName)
    }
  })

  return newRunAlert.present();
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
