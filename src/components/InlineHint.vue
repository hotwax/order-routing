<template>
  <div class="inline-hint">
    <ion-icon :icon="icon || informationCircleOutline" class="inline-hint__icon" />
    <div class="inline-hint__body">
      <p class="inline-hint__text"><slot>{{ text }}</slot></p>
      <div v-if="$slots.action" class="inline-hint__action">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from "@ionic/vue";
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
  padding: var(--spacer-sm);
  border-radius: 8px;
  border-inline-start: 3px solid var(--ion-color-medium);
  background: var(--ion-color-light);
  color: var(--ion-color-dark);
}

.inline-hint__icon {
  flex: none;
  font-size: 20px;
  color: var(--ion-color-medium);
  margin-top: 1px;
}

.inline-hint__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacer-2xs);
}

.inline-hint__text {
  margin: 0;
  line-height: 1.45;
}

.inline-hint__action {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-2xs);
}
</style>
