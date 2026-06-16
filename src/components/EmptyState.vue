<template>
  <div class="empty-state" :class="variant">
    <img v-if="image" :src="image" class="empty-state__art" :alt="title || ''" />
    <ion-icon v-else-if="icon" :icon="icon" class="empty-state__icon" />

    <h2 v-if="title" class="empty-state__title">{{ title }}</h2>
    <p v-if="message" class="empty-state__message">{{ message }}</p>

    <div v-if="$slots.actions" class="empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from "@ionic/vue";

withDefaults(
  defineProps<{
    /** Optional illustration; takes precedence over `icon`. */
    image?: string;
    /** Ionicon shown when no `image` is provided. */
    icon?: string;
    title?: string;
    message?: string;
    /** `hero` for first-run/prerequisite states, `compact` for inline no-result states. */
    variant?: "hero" | "compact";
  }>(),
  {
    variant: "hero"
  }
);
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--spacer-sm);
  margin-inline: auto;
}

.empty-state.hero {
  max-width: 420px;
  padding: var(--spacer-2xl) var(--spacer-base);
}

.empty-state.compact {
  max-width: 380px;
  padding: var(--spacer-lg) var(--spacer-base);
  gap: var(--spacer-xs);
}

.empty-state__art {
  width: 220px;
  max-width: 60%;
  height: auto;
  object-fit: contain;
  margin-bottom: var(--spacer-2xs);
}

.empty-state__icon {
  font-size: 64px;
  color: var(--ion-color-medium);
}

.empty-state.compact .empty-state__icon {
  font-size: 44px;
}

.empty-state__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.empty-state.compact .empty-state__title {
  font-size: 1rem;
}

.empty-state__message {
  margin: 0;
  color: var(--ion-color-medium);
  line-height: 1.45;
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
  justify-content: center;
  margin-top: var(--spacer-xs);
}
</style>
