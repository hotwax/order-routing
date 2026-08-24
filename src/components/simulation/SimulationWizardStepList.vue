<template>
  <ion-list lines="full">
    <template v-for="group in groups" :key="group.id">
      <ion-list-header>
        <ion-label>{{ translate(group.label) }}</ion-label>
      </ion-list-header>
      <ion-item
        v-for="step in stepsByGroup(group.id)"
        :key="step.id"
        button
        :detail="false"
        :color="step.id === currentStepId ? 'light' : undefined"
        @click="$emit('select-step', step.id)"
      >
        <ion-label>
          {{ translate(step.label) }}
          <p v-if="stepStatus[step.id]?.subtitle">{{ stepStatus[step.id]?.subtitle }}</p>
        </ion-label>

        <ion-badge
          v-if="stepStatus[step.id]?.badge"
          slot="end"
          :color="stepStatus[step.id]?.badgeColor || 'medium'"
        >
          {{ stepStatus[step.id]?.badge }}
        </ion-badge>

        <ion-icon
          slot="end"
          :color="isStepCompleted(step.id) ? 'success' : isStepInProgress(step.id) ? 'warning' : 'medium'"
          :icon="isStepCompleted(step.id) ? checkmarkCircleOutline : isStepInProgress(step.id) ? syncOutline : radioButtonOffOutline"
        />
      </ion-item>
    </template>
  </ion-list>
</template>

<script setup lang="ts">
import { IonBadge, IonIcon, IonItem, IonLabel, IonList, IonListHeader } from "@ionic/vue";
import { checkmarkCircleOutline, radioButtonOffOutline, syncOutline } from "ionicons/icons";
import { translate } from "@common";
import type { SimulationSetupGroup, SimulationSetupStep } from "@/config/simulationSetupSteps";

const props = withDefaults(
  defineProps<{
    groups: SimulationSetupGroup[];
    steps: SimulationSetupStep[];
    currentStepId: string;
    completedStepIds: string[];
    inProgressStepIds?: string[];
    stepStatus?: Record<string, { badge?: string; badgeColor?: string; subtitle?: string }>;
  }>(),
  {
    inProgressStepIds: () => [],
    stepStatus: () => ({}),
  }
);

defineEmits<{
  (event: "select-step", stepId: string): void;
}>();

function stepsByGroup(groupId: string) {
  return props.steps.filter((step) => step.group === groupId);
}

function isStepCompleted(stepId: string) {
  return props.completedStepIds.includes(stepId);
}

function isStepInProgress(stepId: string) {
  return props.inProgressStepIds?.includes(stepId);
}
</script>
