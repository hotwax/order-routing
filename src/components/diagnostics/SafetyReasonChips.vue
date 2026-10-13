<template>
  <!-- Safety stock reasons as wrapping chips; a rule chip opens that rule. -->
  <div class="reason-chips">
    <ion-chip v-for="reason in reasons" :key="reason.key" outline @click="open(reason.ruleId)">
      <ion-icon :icon="ellipse" :color="reason.tone" />
      <ion-label>{{ reason.label }}</ion-label>
      <ion-badge color="light">
        {{ Math.round(reason.total).toLocaleString() }}
      </ion-badge>
    </ion-chip>
    <ion-note v-for="reason in reasons.filter((item) => !item.ruleId)" :key="`note-${reason.key}`" class="reason-note">
      {{ reason.label }}: {{ reason.description }}
    </ion-note>
  </div>
</template>

<script setup lang="ts">
import { IonBadge, IonChip, IonIcon, IonLabel, IonNote } from "@ionic/vue";
import { ellipse } from "ionicons/icons";
import router from "@/router";

defineProps<{ reasons: { key: string; label: string; tone: string; total: number; ruleId: string; description: string }[] }>();

function open(ruleId: string) {
  if(ruleId) {router.push(`/update-safety-stock/${ruleId}`);}
}
</script>

<style scoped>
.reason-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.reason-note {
  flex-basis: 100%;
}
</style>
