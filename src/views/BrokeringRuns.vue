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
          <ion-card v-for="group in groups" :key="group.routingGroupId" @click="redirect(group)">
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
              {{ getTime(group.createdDate) }}
            </ion-item>
            <ion-item lines="none">
              {{ getTime(group.lastUpdatedStamp) }}
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
import { Group } from "@/types";
import { getTime, showToast } from "@/utils";
import { IonButton, IonButtons, IonCard, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonPage, IonTitle, IonToolbar, alertController, onIonViewWillEnter } from "@ionic/vue";
import { addOutline } from "ionicons/icons"
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";

const store = useStore()
const router = useRouter()
const groups = computed(() => store.getters["orderRouting/getRoutingGroups"])

onIonViewWillEnter(async () => {
  await store.dispatch("orderRouting/fetchOrderRoutingGroups");
  store.dispatch("util/fetchEnums", { parentTypeId: "ORDER_ROUTING" })
})

async function addNewRun() {
  const newRunAlert = await alertController.create({
    header: "New Run",
    buttons: [{
      text: "Cancel",
      role: "cancel"
    }, {
      text: "Save",
      handler: (data) => {
        if(!data.runName?.trim().length) {
          showToast("Please enter a valid name")
          return false;
        }
      }
    }],
    inputs: [{
      name: "runName",
      placeholder: "Run name"
    }]
  })

  newRunAlert.onDidDismiss().then((result: any) => {
    // considering that if we have role, then its negative action and thus not need to create run
    if(result.role) {
      return;
    }

    if(result.data?.values?.runName.trim()) {
      store.dispatch('orderRouting/createRoutingGroup', result.data.values.runName.trim())
    }
  })

  return newRunAlert.present();
}

async function redirect(group: Group) {
  router.push(`brokering/${group.routingGroupId}/routes`)
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
