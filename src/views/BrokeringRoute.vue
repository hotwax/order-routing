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
          <ion-card v-for="routing in orderRoutings" :key="routing.orderRoutingId" @click="router.push('query')">
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
                {{ "This is what a long description of the routing rule that the user has created looks like. This also includes an edit button where the user can edit their description inline" }}
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
                <ion-label slot="end">{{ "3:00 PM EST" }}</ion-label>
              </ion-item>
              <ion-item>
                <ion-icon slot="start" :icon="timerOutline"/>
                <ion-label>{{ "Schedule" }}</ion-label>
                <ion-label slot="end">{{ "Every 5 minutes" }}</ion-label>
              </ion-item>
            </ion-card>
            <ion-item>
              {{ "Created at <time>" }}
            </ion-item>
            <ion-item>
              {{ "Updated at <time>" }}
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

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

const orderRoutings = computed(() => store.getters["orderRouting/getOrderRoutings"])

onIonViewWillEnter(async () => {
  await store.dispatch('orderRouting/fetchOrderRoutings', props.routingGroupId)
})
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
