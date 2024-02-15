<template>
  <ion-page>
    <ion-header :translucent="true">
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
      <div class="find">
        <section class="search">
          <ion-searchbar :placeholder="translate('Search groups')" />
        </section>

        <aside class="filters">
          <ion-list-header>{{ "Product Stores" }}</ion-list-header>
          <ion-list>
            <ion-item lines="none">
              <ion-radio-group :value="currentEComStore.productStoreId" @ionChange="setEComStore($event)">
                <ion-radio v-for="store in (userProfile ? userProfile.stores : [])" :key="store.productStoreId" :value="store.productStoreId">{{ store.storeName }}</ion-radio>
              </ion-radio-group>
            </ion-item>
          </ion-list>
        </aside>

        <main v-if="isLoading">
          <ion-item lines="none">
            <ion-spinner name="crescent" slot="start" />
            {{ translate("Fetching groups") }}
          </ion-item>
        </main>
        <main v-else-if="groups.length">
          <section>
            <ion-card class="pointer" v-for="group in groups" :key="group.routingGroupId" @click="redirect(group)">
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
                {{ getDateAndTime(group.createdDate) }}
              </ion-item>
              <ion-item lines="none">
                {{ getDateAndTime(group.lastUpdatedStamp) }}
              </ion-item>
            </ion-card>
          </section>
        </main>
        <main v-else>
          {{ translate("No runs scheduled") }}
        </main>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import emitter from "@/event-bus";
import { translate } from "@/i18n";
import { Group } from "@/types";
import { getDateAndTime, showToast } from "@/utils";
import { IonButton, IonButtons, IonCard, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonRadioGroup, IonRadio, IonSearchbar, IonSpinner, IonTitle, IonToolbar, alertController, onIonViewWillEnter } from "@ionic/vue";
import { addOutline } from "ionicons/icons"
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";

const store = useStore()
const router = useRouter()
const groups = computed(() => store.getters["orderRouting/getRoutingGroups"])
const userProfile = computed(() => store.getters["user/getUserProfile"])
const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])

let isLoading = ref(false)

onIonViewWillEnter(async () => {
  isLoading.value = true
  await store.dispatch("orderRouting/fetchOrderRoutingGroups");
  isLoading.value = false
  store.dispatch("util/fetchEnums", { parentTypeId: "ORDER_ROUTING" })
})

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

  newRunAlert.onDidDismiss().then((result: any) => {
    // considering that if we have role, then its negative action and thus not need to create run
    if(result.role) {
      return;
    }

    if(result.data?.values?.runName.trim()) {
      store.dispatch("orderRouting/createRoutingGroup", result.data.values.runName.trim())
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
  }
  emitter.emit("dismissLoader")
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
