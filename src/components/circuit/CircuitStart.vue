<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Circuit") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="resetCircuit">
            <ion-icon slot="icon-only" :icon="refreshOutline" />
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

        <CircuitPromptArea 
          v-model="prompt" 
          :selectedContext="selectedContext"
          @send="startChat" 
          @add-context="addContext" 
          @remove-context="removeContext"
        />

        <ion-list>
          <ion-list-header>
            <ion-label>{{ translate("History") }}</ion-label>
          </ion-list-header>
          <ion-item button detail v-for="thread in threads" :key="thread.id" @click="openThread(thread.id)">
            <ion-label>
              {{ thread.name }}
            </ion-label>
            <ion-note slot="end">{{ thread.lastAction }}</ion-note>
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
  IonContent, 
  IonHeader, 
  IonIcon, 
  IonItem, 
  IonLabel, 
  IonList, 
  IonListHeader, 
  IonNote, 
  IonPage, 
  IonTitle, 
  IonToolbar 
} from '@ionic/vue';
import CircuitPromptArea from '@/components/circuit/CircuitPromptArea.vue';
import { 
  refreshOutline
} from 'ionicons/icons';
import RoutingRuleSelectionModal from '@/components/circuit/RoutingRuleSelectionModal.vue';
import { modalController } from '@ionic/vue';
import { translate } from '@/i18n';
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';

const store = useStore();
const prompt = ref('');

const threads = computed(() => store.getters['circuit/getThreads']);

onMounted(() => {
  store.dispatch('circuit/loadAllThreads');
});

const selectedContext = ref(null as any);

const startChat = () => {
  if (prompt.value.trim()) {
    let message = prompt.value;
    if (selectedContext.value) {
      message += ` [Context: ${selectedContext.value.routingName}]`;
      selectedContext.value = null;
    }
    // Reset current thread ID to null to ensure a new thread is created
    store.dispatch('circuit/switchThread', null);
    // Use sendAgentMessage for agentic behavior
    store.dispatch('circuit/sendAgentMessage', message);
    prompt.value = '';
  }
}

const addContext = async () => {
  const modal = await modalController.create({
    component: RoutingRuleSelectionModal,
  });
  
  modal.onDidDismiss().then((result) => {
    if (result.data) {
      selectedContext.value = result.data;
    }
  });

  return modal.present();
}

const removeContext = () => {
  selectedContext.value = null;
}

const resetCircuit = () => {
  store.dispatch('circuit/resetCircuit');
}

const openThread = (threadId: string) => {
  store.dispatch('circuit/switchThread', threadId);
  store.dispatch('circuit/setChatStarted', true);
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

