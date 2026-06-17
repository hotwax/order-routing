<template>
  <div class="inline-hint">
    <ion-icon :icon="icon || informationCircleOutline" color="medium" class="inline-hint__icon" />
    <div class="inline-hint__body">
      <ion-text color="medium">
        <p class="inline-hint__text"><slot>{{ text }}</slot></p>
      </ion-text>
      <div v-if="$slots.action" class="inline-hint__action">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonText } from "@ionic/vue";
import { informationCircleOutline } from "ionicons/icons";

defineProps<{
  /** Hint copy; or use the default slot for richer content (links etc.). */
  text?: string;
  /** Ionicon override; defaults to an info circle. */
  icon?: string;
}>();
</script>

<style scoped>
.inline-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--spacer-xs);
  /* Horizontal padding matches Ionic's item content inset (16px) so the hint
     lines up with the dividers/items it sits among instead of hugging the edge. */
  padding: var(--spacer-xs) var(--spacer-sm);
}

.inline-hint__icon {
  flex: none;
  margin-top: 2px;
}

.inline-hint__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-2xs);
}

.inline-hint__text {
  margin: 0;
}

.inline-hint__action {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-2xs);
}
</style>
