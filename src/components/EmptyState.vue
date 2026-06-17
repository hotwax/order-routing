<template>
  <div class="empty-state" :class="variant">
    <img v-if="image" :src="image" class="empty-state__art" :alt="title || ''" />
    <ion-icon v-else-if="icon" :icon="icon" color="medium" class="empty-state__icon" />

    <ion-text v-if="title">
      <h2>{{ title }}</h2>
    </ion-text>
    <ion-text v-if="message" color="medium">
      <p>{{ message }}</p>
    </ion-text>

    <div v-if="$slots.actions" class="empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonText } from "@ionic/vue";

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
  gap: var(--spacer-xs);
  margin-inline: auto;
}

.empty-state.hero {
  max-width: 420px;
  padding: var(--spacer-2xl) var(--spacer-base);
}

.empty-state.compact {
  max-width: 380px;
  padding: var(--spacer-lg) var(--spacer-base);
}

.empty-state__art {
  width: 220px;
  max-width: 60%;
  height: auto;
  object-fit: contain;
}

.empty-state__icon {
  font-size: 48px;
}

.empty-state h2 {
  margin: var(--spacer-xs) 0 0;
}

.empty-state p {
  margin: 0;
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacer-xs);
  justify-content: center;
  margin-top: var(--spacer-sm);
}
</style>
