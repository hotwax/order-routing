<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/" />
        </ion-buttons>
        <ion-title>{{ "Brokering run name" }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div>
        <ion-list>
          <ion-list-header ref="listHeader">
            <ion-label>{{ "Order batches" }}</ion-label>
            <ion-button color="primary" fill="clear">
              {{ "New" }}
              <ion-icon :icon="addCircleOutline" />
            </ion-button>
          </ion-list-header>
          <ion-card v-for="routing in orderRoutings" :key="routing.orderRoutingId" @click="redirect(routing.orderRoutingId)">
            <ion-item lines="full">
              <ion-label>
                <h1>{{ routing.routingName }}</h1>
              </ion-label>
              <ion-chip>{{ `${routing.sequenceNum}/4` }}</ion-chip>
            </ion-item>
            <ion-item>
              <ion-badge>{{ routing.statusId }}</ion-badge>
              <ion-button fill="clear" color="medium" slot="end">
                {{ "Archive" }}
              </ion-button>
            </ion-item>
          </ion-card>
        </ion-list>
        <section class="ion-padding">
          <main>
            <ion-item lines="none">
              {{ "Description" }}
              <ion-button fill="clear" slot="end">
                {{ "Edit" }}
              </ion-button>
            </ion-item>
            <ion-item lines="none">
              <ion-label>
                {{ currentRoutingGroup.description ? currentRoutingGroup.description : "No description available" }}
              </ion-label>
            </ion-item>
          </main>
          <aside>
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  {{ "Scheduler" }}
                </ion-card-title>
              </ion-card-header>
              <ion-item>
                <ion-icon slot="start" :icon="timeOutline"/>
                <ion-label>{{ "Run time" }}</ion-label>
                <!-- <ion-label slot="end">{{ currentRoutingGroup.runTime || "-" }}</ion-label> -->
              </ion-item>
              <ion-item>
                <ion-icon slot="start" :icon="timerOutline"/>
                <ion-label>{{ "Schedule" }}</ion-label>
                <!-- <ion-label slot="end">{{ currentRoutingGroup.frequency || "-" }}</ion-label> -->
              </ion-item>
            </ion-card>
            <ion-item>
              {{ `Created at ${currentRoutingGroup.createdDate || "-"}` }}
            </ion-item>
            <ion-item>
              {{ `Updated at ${currentRoutingGroup.lastUpdatedStamp || "-"}` }}
            </ion-item>
          </aside>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardHeader, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage, IonTitle, IonToolbar, onIonViewWillEnter } from "@ionic/vue";
import { addCircleOutline, timeOutline, timerOutline } from "ionicons/icons"
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps } from "vue";
import { Group } from "@/types";

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

const currentRoutingGroup = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const orderRoutings = computed(() => store.getters["orderRouting/getOrderRoutings"])

onIonViewWillEnter(async () => {
  await store.dispatch("orderRouting/fetchOrderRoutings", props.routingGroupId)

  // On refresh, the groups list is removed thus resulting is not fetching the current group information
  if(!currentRoutingGroup.value.routingGroupId) {
    await store.dispatch("orderRouting/fetchOrderRoutingGroups")
  }
})

async function redirect(orderRoutingId: string) {
  await store.dispatch('orderRouting/setCurrentOrderRoutingId', orderRoutingId)
  router.push(`${orderRoutingId}/rules`)
}
</script>

<style scoped>
section {
  display: flex;
  justify-content: space-between;
}

section > * {
  min-width: 40ch;
}

ion-content > div {
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 100%;
}

ion-content > div > ion-list {
  border-right: 1px solid #92949C;
}
</style>
