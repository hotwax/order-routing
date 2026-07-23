<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Circuit") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="circuit-mini intro-container">
        <ion-item lines="none">
          <ion-label>
            <h1>{{ translate("Get to know Circuit") }}</h1>
            <p>{{ translate("Before Circuit starts helping you build routing rules, it'll ask you a few questions about how you envision omnichannel order routing working for you.") }}</p>
            <p>{{ translate("Your answers will help it understand which tools to use when assisting you with routing configuration.") }}</p>
            <ion-button fill="clear">{{ translate("Data privacy") }}</ion-button>
          </ion-label>
        </ion-item>
        <div class="ion-padding">
          <ion-button expand="block" color="dark" @click="getStarted">
            {{ translate("Get started") }}
            <ion-icon slot="end" :icon="arrowForwardOutline" />
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { 
  IonButton, 
  IonContent, 
  IonHeader, 
  IonIcon, 
  IonItem, 
  IonLabel, 
  IonPage, 
  IonTitle, 
  IonToolbar 
} from '@ionic/vue';
import { arrowForwardOutline } from 'ionicons/icons';
import { translate } from '@common';
import { useCircuitStore } from '@/store/circuit';

const circuitStore = useCircuitStore();

const getStarted = () => {
  circuitStore.setIntroDone(true);
}
</script>

<style scoped>
.intro-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}
</style>
