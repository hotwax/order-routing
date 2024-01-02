<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>{{ "Brokering run name" }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
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
              <ion-label>{{ 'Run time' }}</ion-label>
              <ion-label slot="end">{{ '3:00 PM EST' }}</ion-label>
            </ion-item>
            <ion-item>
              <ion-icon slot="start" :icon="timerOutline"/>
              <ion-label>{{ 'Schedule' }}</ion-label>
              <ion-label slot="end">{{ 'Every 5 minutes' }}</ion-label>
            </ion-item>
          </ion-card>
          <ion-item>
            {{ 'Created at <time>' }}
          </ion-item>
          <ion-item>
            {{ 'Updated at <time>' }}
          </ion-item>
        </aside>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonPage, IonTitle, IonToolbar } from "@ionic/vue";
import { timeOutline, timerOutline } from "ionicons/icons"
</script>

<style scoped>
section {
  display: flex;
  justify-content: space-between;
}

section > * {
  min-width: 40ch;
}
</style>
