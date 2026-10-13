<template>
  <!-- Change against the week before the selected one. -->
  <ion-note :color="tone">
    {{ text }}
  </ion-note>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonNote } from "@ionic/vue";
import { computed } from "vue";
import { weekOverWeek } from "@/utils/routingDiagnostics";

const props = defineProps<{ values: number[]; index: number }>();

const change = computed(() => weekOverWeek(props.values.slice(0, props.index + 1)));

const tone = computed(() => {
  if(change.value === null || change.value === 0) {return "medium";}

  return change.value > 0 ? "success" : "danger";
});

const text = computed(() => {
  if(change.value === null) {return translate("No prior week to compare");}
  const percent = `${change.value > 0 ? "+" : ""}${(change.value * 100).toFixed(1)}%`;

  return translate("{change} vs prior week", { change: percent });
});
</script>
