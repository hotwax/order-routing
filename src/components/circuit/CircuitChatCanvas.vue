<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Circuit") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="resetCircuit">
            <ion-icon slot="icon-only" :icon="refreshOutline" />
          </ion-button>
          <ion-button v-if="isChatStarted" @click="createNewChat">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
          <ion-button @click="openThreadModal">
            <ion-icon slot="start" :icon="chatbubblesOutline" />
            {{ translate("Threads") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Thread Selection List (Visible when menu is toggled) -->
    </ion-header>

    <ion-content>
      <div class="chat-canvas-container">
        <!-- Chat Section -->
        <div class="chat-section">
          <ion-list class="chat-history">
            <template v-for="message in messages" :key="message.id">
              <ion-item lines="none" :class="message.role === 'user' ? 'prompt-item' : 'response-item'">
                <ion-label>
                  <p class="role-label">{{ message.role === 'user' ? translate('User') : translate('Circuit') }}</p>
                  <p>{{ message.content }}</p>
                </ion-label>
              </ion-item>
            </template>
          </ion-list>

          <CircuitPromptArea 
            v-model="prompt" 
            :selectedContext="selectedContext"
            @send="onSend" 
            @add-context="addContext" 
            @remove-context="removeContext"
          />
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

    <ion-modal :is-open="showThreadMenu" @didDismiss="showThreadMenu = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ translate("Chat Threads") }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showThreadMenu = false">{{ translate("Close") }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-item button v-for="thread in threads" :key="thread.id" @click="selectThread(thread.id)" :detail="false" :class="{ 'selected-thread': thread.id === currentThreadId }">
            <ion-label>
              <h3>{{ thread.name }}</h3>
              <p>{{ formatDate(thread.createdAt) }}</p>
            </ion-label>
            <ion-button slot="end" fill="clear" color="danger" @click.stop="confirmDelete(thread.id)">
              <ion-icon slot="icon-only" :icon="trashOutline" />
            </ion-button>
          </ion-item>
          <ion-item v-if="threads.length === 0">
            <ion-label color="medium">{{ translate("No threads found") }}</ion-label>
          </ion-item>
        </ion-list>
      </ion-content>
    </ion-modal>
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
  IonModal,
  IonPage, 
  IonTitle, 
  IonToolbar 
} from '@ionic/vue';
import CircuitPromptArea from '@/components/circuit/CircuitPromptArea.vue';
import RoutingRuleSelectionModal from '@/components/circuit/RoutingRuleSelectionModal.vue';
import { 
  addOutline, 
  chatbubblesOutline, 
  refreshOutline,
  sendOutline,
  trashOutline
} from 'ionicons/icons';
import { translate } from '@/i18n';
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { DateTime } from 'luxon';
import { modalController } from '@ionic/vue';

const store = useStore();
const prompt = ref('');

const messages = computed(() => store.getters['circuit/getMessages']);
const threads = computed(() => store.getters['circuit/getThreads']);
const currentThreadId = computed(() => store.getters['circuit/getCurrentThreadId']);
const showThreadMenu = ref(false);

onMounted(() => {
  store.dispatch('circuit/loadAllThreads');
});

const selectedContext = ref(null as any);

const onSend = () => {
  if (!prompt.value.trim()) return;
  let message = prompt.value;
  if (selectedContext.value) {
    message += ` [Context: ${selectedContext.value.routingName}]`;
    selectedContext.value = null;
  }
  store.dispatch('circuit/sendMessage', message);
  prompt.value = '';
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

const isChatStarted = computed(() => store.getters['circuit/isChatStarted']);

const resetCircuit = () => {
  store.dispatch('circuit/resetCircuit');
}

const createNewChat = () => {
  store.dispatch('circuit/createThread');
  showThreadMenu.value = false;
}

const openThreadModal = () => {
  showThreadMenu.value = true;
}

const selectThread = (threadId: string) => {
  store.dispatch('circuit/switchThread', threadId);
  showThreadMenu.value = false;
}

const confirmDelete = (threadId: string) => {
  // Simple delete for now
  store.dispatch('circuit/deleteThread', threadId);
}

const formatDate = (timestamp: number) => {
  return DateTime.fromMillis(timestamp).toRelative();
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

.role-label {
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 4px;
  color: var(--ion-color-medium);
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


.selected-thread {
  --background: var(--ion-color-step-100);
}
</style>

