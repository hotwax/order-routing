<template>
  <!-- Loading, error and empty handling shared by the dashboard sections. -->
  <ion-card-content v-if="status === 'loading' || status === 'idle'">
    <ion-skeleton-text animated class="skeleton" />
    <ion-skeleton-text animated class="skeleton" />
    <ion-skeleton-text animated class="skeleton" />
  </ion-card-content>
  <ion-card-content v-else-if="status === 'error'">
    <ion-note color="danger">
      {{ translate("This section could not be loaded. Try refreshing the dashboard.") }}
    </ion-note>
  </ion-card-content>
  <ion-card-content v-else-if="empty">
    <ion-note>{{ emptyMessage }}</ion-note>
  </ion-card-content>
  <slot v-else />
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonCardContent, IonNote, IonSkeletonText } from "@ionic/vue";

defineProps<{ status: string; empty: boolean; emptyMessage: string }>();
</script>

<style scoped>
.skeleton {
  height: var(--spacer-base);
  margin-bottom: var(--spacer-xs);
}
</style>
