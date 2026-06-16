<template>
  <nav class="wayfinding" :aria-label="heading || undefined">
    <p v-if="heading" class="wayfinding__heading">{{ heading }}</p>
    <div class="wayfinding__cards">
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        class="wayfinding__card"
        :class="{ 'is-active': item.value === active }"
        :aria-current="item.value === active ? 'true' : undefined"
        @click="$emit('select', item.value)"
      >
        <ion-icon v-if="item.icon" :icon="item.icon" class="wayfinding__icon" />
        <span class="wayfinding__label">{{ item.label }}</span>
        <span v-if="item.intro" class="wayfinding__intro">{{ item.intro }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { IonIcon } from "@ionic/vue";

interface WayfindingItem {
  value: string;
  label: string;
  intro?: string;
  icon?: string;
}

defineProps<{
  items: WayfindingItem[];
  /** The currently active item's `value`; rendered as highlighted/current. */
  active?: string;
  heading?: string;
}>();

defineEmits<{
  (e: "select", value: string): void;
}>();
</script>

<style scoped>
.wayfinding {
  width: 100%;
  max-width: 720px;
  margin-inline: auto;
}

.wayfinding__heading {
  margin: 0 0 var(--spacer-xs);
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 0.875rem;
}

.wayfinding__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacer-xs);
}

.wayfinding__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacer-2xs);
  padding: var(--spacer-sm);
  border: 1px solid var(--ion-color-step-150, #e0e0e0);
  border-radius: 8px;
  background: var(--ion-card-background, var(--ion-background-color, #fff));
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.wayfinding__card:hover {
  border-color: var(--ion-color-primary);
}

.wayfinding__card.is-active {
  border-color: var(--ion-color-primary);
  cursor: default;
}

.wayfinding__icon {
  font-size: 24px;
  color: var(--ion-color-primary);
}

.wayfinding__label {
  font-weight: 600;
  font-size: 0.95rem;
}

.wayfinding__intro {
  color: var(--ion-color-medium);
  font-size: 0.8125rem;
  line-height: 1.35;
}
</style>
