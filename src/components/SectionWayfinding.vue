<template>
  <nav class="wayfinding" :aria-label="heading || undefined">
    <ion-text v-if="heading" color="medium">
      <p class="wayfinding__heading">{{ heading }}</p>
    </ion-text>
    <div class="wayfinding__cards">
      <ion-card
        v-for="item in items"
        :key="item.value"
        button
        :disabled="item.value === active"
        @click="$emit('select', item.value)"
      >
        <ion-card-header>
          <ion-card-title>
            <ion-icon v-if="item.icon" :icon="item.icon" />
            {{ item.label }}
          </ion-card-title>
        </ion-card-header>
        <ion-card-content v-if="item.intro">{{ item.intro }}</ion-card-content>
      </ion-card>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonText } from "@ionic/vue";

interface WayfindingItem {
  value: string;
  label: string;
  intro?: string;
  icon?: string;
}

defineProps<{
  items: WayfindingItem[];
  /** The currently active item's `value`; rendered as the disabled/current card. */
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
}

.wayfinding__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: var(--spacer-xs);
}

.wayfinding__cards ion-card {
  margin: 0;
}

.wayfinding ion-card-title ion-icon {
  vertical-align: middle;
  margin-inline-end: var(--spacer-2xs);
}
</style>
