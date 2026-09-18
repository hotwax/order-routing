<template>
  <div class="circuit-prompt-area ion-padding">
    <ion-textarea
      ref="promptTextarea"
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
  </div>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonIcon,
  IonTextarea
} from '@ionic/vue';
import { sendOutline } from 'ionicons/icons';
import { translate } from '@common';
import { computed, nextTick, ref } from 'vue';

/* eslint-disable no-undef */
const props = defineProps<{
  modelValue: string,
  disabled?: boolean
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send'): void
}>();
/* eslint-enable no-undef */

const internalPrompt = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
});

type PromptTextareaRef = {
  $el?: {
    setFocus?: () => Promise<void>;
    focus?: () => void;
  };
  setFocus?: () => Promise<void>;
  focus?: () => void;
};

const promptTextarea = ref<PromptTextareaRef | null>(null);

const focus = async () => {
  await nextTick();

  if (promptTextarea.value?.setFocus) {
    await promptTextarea.value.setFocus();
    return;
  }

  if (promptTextarea.value?.$el?.setFocus) {
    await promptTextarea.value.$el.setFocus();
    return;
  }

  promptTextarea.value?.$el?.focus?.();
};

defineExpose({ focus });

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
</script>

<style scoped>
.circuit-prompt-area {
  width: 100%;
}
</style>
