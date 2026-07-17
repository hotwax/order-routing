<template>
  <ion-card
    class="routing-config-card"
    :class="{ 'dirty-card': isDirty }"
    :data-card-kind="card.kind"
  >
    <ion-item class="card-header" lines="none">
      <ion-icon slot="start" :icon="cardIcon" />
      <ion-label>
        <h2>{{ translate(card.title) }}</h2>
        <p v-if="showContext && card.eyebrow">{{ translate(card.eyebrow) }}</p>
      </ion-label>
      <ion-note v-if="isDirty" slot="end" color="warning">{{ translate("Changed") }}</ion-note>
      <slot name="header-actions" />
    </ion-item>

    <slot name="before-items" />
    <component
      :is="itemsContainer"
      v-if="card.items.length"
      lines="full"
      :disabled="reorderable ? false : undefined"
      @ionItemReorder="emit('reorder', $event)"
    >
      <template v-for="item in card.items" :key="`${card.key}:${item.target}`">
        <slot name="item" :item="item">
          <ion-item :class="{ 'dirty-setting-row': item.dirty }">
          <ion-label>
            {{ translate(item.label) }}
            <p v-if="item.value">{{ translate(item.value) }}</p>
          </ion-label>
          <ion-icon
            v-if="card.kind === 'sort' && !item.value"
            slot="end"
            aria-hidden="true"
            :icon="reorderThreeOutline"
          />
          </ion-item>
        </slot>
      </template>
    </component>
    <slot v-if="!card.items.length" name="empty" />
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonCard, IonIcon, IonItem, IonLabel, IonList, IonNote, IonReorderGroup } from "@ionic/vue";
import {
  arrowDownCircleOutline,
  filterOutline,
  gitMergeOutline,
  gitNetworkOutline,
  reorderThreeOutline,
  swapVerticalOutline
} from "ionicons/icons";
import { translate } from "@common";
import type { RoutingConfigSection, RoutingConfigSectionKind } from "@/types/routingConfigSection";

const props = withDefaults(defineProps<{
  card: RoutingConfigSection;
  dirty?: boolean;
  reorderable?: boolean;
  showContext?: boolean;
}>(), {
  dirty: false,
  reorderable: false,
  showContext: true
});

const emit = defineEmits<{
  (event: "reorder", value: CustomEvent): void;
}>();

const icons: Record<RoutingConfigSectionKind, string> = {
  filters: filterOutline,
  sort: swapVerticalOutline,
  partial: gitMergeOutline,
  unavailable: arrowDownCircleOutline,
  routing: gitNetworkOutline,
  rule: gitNetworkOutline
};

const cardIcon = computed(() => icons[props.card.kind]);
const isDirty = computed(() => props.dirty || props.card.items.some((item) => item.dirty));
const itemsContainer = computed(() => props.reorderable ? IonReorderGroup : IonList);
</script>

<style scoped>
.routing-config-card {
  margin: 0;
  overflow: hidden;
}

.dirty-card {
  outline: 2px solid var(--ion-color-warning);
  outline-offset: -2px;
}

.dirty-setting-row {
  --background: rgba(var(--ion-color-warning-rgb), 0.16);
  border-inline-start: 3px solid var(--ion-color-warning);
}
</style>
