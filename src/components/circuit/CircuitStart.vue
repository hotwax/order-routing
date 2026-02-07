<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Circuit") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="resetCircuit">
            <ion-icon slot="icon-only" :icon="refreshOutline" />
          </ion-button>
          <ion-button>
            <ion-icon slot="start" :icon="chatbubblesOutline" />
            {{ translate("Threads") }}
          </ion-button>
        </ion-buttons>

      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="circuit-mini start-container">
        <ion-item lines="none">
          <ion-label>
            <h1 class="ion-text-wrap">{{ translate("Ask Circuit to build") }}</h1>
          </ion-label>
        </ion-item>

        <div class="ion-padding">
          <ion-item counter class="prompt-input">
            <ion-label position="stacked">{{ translate("Your prompt here") }}</ion-label>
            <ion-textarea :auto-grow="true" v-model="prompt"></ion-textarea>
            <ion-button slot="end" fill="clear" @click="startChat">
              <ion-icon slot="icon-only" :icon="sendOutline" />
            </ion-button>
          </ion-item>

          <div class="context-chips">
            <ion-chip outline @click="addContext">
              <ion-icon :icon="addOutline" />
              <ion-label>{{ translate("Add context") }}</ion-label>
            </ion-chip>
          </div>
        </div>

        <ion-list>
          <ion-list-header>
            <ion-label>{{ translate("History") }}</ion-label>
          </ion-list-header>
          <ion-item v-for="thread in threads" :key="thread.id">
            <ion-label>
              <h2>{{ thread.name }}</h2>
            </ion-label>
            <ion-note slot="end">{{ thread.lastAction }}</ion-note>
          </ion-item>
          <ion-item v-if="threads.length === 0">
            <ion-label>
              <h2>{{ translate("Chat thread name") }}</h2>
            </ion-label>
            <ion-note slot="end">{{ translate("just now") }}</ion-note>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { 
  IonButton, 
  IonButtons, 
  IonChip, 
  IonContent, 
  IonHeader, 
  IonIcon, 
  IonItem, 
  IonLabel, 
  IonList, 
  IonListHeader, 
  IonNote, 
  IonPage, 
  IonTextarea, 
  IonTitle, 
  IonToolbar 
} from '@ionic/vue';
import { 
  addOutline, 
  chatbubblesOutline, 
  refreshOutline,
  sendOutline 
} from 'ionicons/icons';
import { translate } from '@/i18n';
import { ref, computed } from 'vue';
import { useStore } from 'vuex';

const store = useStore();
const prompt = ref('');

const threads = computed(() => store.getters['circuit/getThreads']);

const startChat = () => {
  if (prompt.value.trim()) {
    store.dispatch('circuit/setChatStarted', true);
  }
}

const resetCircuit = () => {
  store.dispatch('circuit/resetCircuit');
}


const addContext = () => {
  // Logic to add context
}
</script>

<style scoped>
.start-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}
</style>

