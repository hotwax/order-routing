<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Circuit") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="resetCircuit">
            <ion-icon slot="icon-only" :icon="refreshOutline" />
          </ion-button>
          <ion-button v-if="isChatStarted" @click="startNewChat">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
          <ion-button>
            <ion-icon slot="start" :icon="chatbubblesOutline" />
            {{ translate("Threads") }}
          </ion-button>
        </ion-buttons>

      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="chat-canvas-container">
        <!-- Chat Section -->
        <div class="chat-section">
          <ion-list class="chat-history">
            <!-- Example chat items -->
            <ion-item lines="none" class="prompt-item">
              <ion-label>
                <p>{{ translate("User Prompt Example") }}</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none" class="response-item">
              <ion-label>
                <p>{{ translate("Circuit Response Example") }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

          <div class="chat-input-area">
            <ion-item counter class="prompt-input">
              <ion-label position="stacked">{{ translate("Your prompt here") }}</ion-label>
              <ion-textarea :auto-grow="true" v-model="prompt"></ion-textarea>
              <ion-button slot="end" fill="clear">
                <ion-icon slot="icon-only" :icon="sendOutline" />
              </ion-button>
            </ion-item>
            <div class="context-chips">
              <ion-chip outline>
                <ion-icon :icon="addOutline" />
                <ion-label>{{ translate("Add context") }}</ion-label>
              </ion-chip>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div class="divider"></div>

        <!-- Canvas Section -->
        <div class="canvas-section">
          <div class="canvas-header">
            <ion-chip>{{ translate("SLA sort") }}</ion-chip>
            <ion-chip outline>{{ translate("Filter") }}</ion-chip>
          </div>
          <div class="canvas-content">
            <!-- Dynamic data based on Circuit's work -->
            <ion-list>
              <ion-item>
                <ion-label>
                  <h2>{{ translate("Routing Group") }}</h2>
                  <p>{{ translate("Built by Circuit") }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </div>
        </div>
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

const isChatStarted = computed(() => store.getters['circuit/isChatStarted']);

const resetCircuit = () => {
  store.dispatch('circuit/resetCircuit');
}

const startNewChat = () => {
  store.dispatch('circuit/startNewChat');
}

</script>

<style scoped>
.chat-canvas-container {
  display: flex;
  height: 100%;
}

.chat-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 400px;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
}

.divider {
  width: 1px;
  background-color: var(--ion-color-step-150, rgba(0,0,0,0.12));
}


.canvas-section {
  flex: 2;
  display: flex;
  flex-direction: column;
}

.canvas-header {
  display: flex;
  gap: 8px;
}

.canvas-content {
  flex: 1;
}
</style>

