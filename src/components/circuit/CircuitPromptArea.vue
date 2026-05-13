<template>
  <div class="circuit-prompt-area ion-padding">
    <ion-textarea 
      :label="translate('Your prompt here')" 
      label-placement="floating" 
      fill="outline" 
      :auto-grow="true" 
      :disabled="disabled"
      v-model="internalPrompt"
      @keydown="handleKeydown"
    >
      <ion-button :disabled="disabled || !internalPrompt?.trim()" slot="end" fill="clear" @click="onSend">
        <ion-icon slot="icon-only" :icon="sendOutline" />
      </ion-button>
    </ion-textarea>          
      <div class="context-chips ion-margin-top">
        <ion-chip v-if="!selectedContext" outline @click="onAddContext">
          <ion-icon :icon="addOutline" />
          <ion-label>{{ translate("Add context") }}</ion-label>
        </ion-chip>
        <ion-chip v-else @click="onRemoveContext">
          <ion-label>{{ selectedContext.routingName }}</ion-label>
          <ion-icon :icon="closeCircleOutline" />
        </ion-chip>
      </div>
    </div>
  </template>
  
  <script setup lang="ts">
  import { 
    IonButton, 
    IonChip, 
    IonIcon, 
    IonLabel, 
    IonTextarea 
  } from '@ionic/vue';
  import { 
    addOutline, 
    closeCircleOutline,
    sendOutline 
  } from 'ionicons/icons';
  import { translate } from '@/i18n';
  import { computed } from 'vue';
  
  /* eslint-disable no-undef */
  const props = defineProps<{
    modelValue: string,
    selectedContext: any,
    disabled?: boolean
  }>();
  
  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'send'): void
    (e: 'add-context'): void
    (e: 'remove-context'): void
  }>();
  /* eslint-enable no-undef */
  
  const internalPrompt = computed({
    get: () => props.modelValue,
    set: (value: string) => emit('update:modelValue', value)
  });
  
  const onSend = () => {
    emit('send');
  }
  
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (internalPrompt.value?.trim()) {
        onSend();
      }
    }
  }
  
  const onAddContext = () => {
    emit('add-context');
  }

  const onRemoveContext = () => {
    emit('remove-context');
  }
  </script>

<style scoped>
.circuit-prompt-area {
  width: 100%;
}
</style>
