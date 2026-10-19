<template>
  <!--
    One horizontal stacked bar per row, all on the same unit scale: the longest bar is the
    largest row total, so bar lengths compare across rows.
  -->
  <ion-list lines="full">
    <ion-item v-for="row in rows" :key="row.key">
      <ion-label>
        {{ row.label }}
        <svg
          class="bar"
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          width="100%"
          height="12"
          role="img"
          :aria-label="describe(row)"
        >
          <rect
            v-for="segment in segmentsFor(row)"
            :key="segment.key"
            :x="segment.x"
            y="0"
            :width="segment.width"
            height="10"
            :fill="`var(--ion-color-${segment.tone})`"
          />
        </svg>
      </ion-label>
      <ion-note slot="end">
        {{ formatNumber(row.total) }}
      </ion-note>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { IonItem, IonLabel, IonList, IonNote } from "@ionic/vue";
import { computed } from "vue";

export interface StackedRow {
  key: string;
  label: string;
  values: Record<string, number>;
  total: number;
}

const props = defineProps<{
  rows: StackedRow[];
  // Segment order and Ionic color per segment key.
  segments: { key: string; label: string; tone: string }[];
}>();

const maxTotal = computed(() => Math.max(0, ...props.rows.map((row) => row.total)));

function segmentsFor(row: StackedRow) {
  let x = 0;

  return props.segments
    .filter((segment) => row.values[segment.key])
    .map((segment) => {
      const width = maxTotal.value ? (row.values[segment.key] / maxTotal.value) * 100 : 0;
      const placed = { key: segment.key, tone: segment.tone, x, width };
      x += width;

      return placed;
    });
}

function describe(row: StackedRow) {
  return props.segments
    .filter((segment) => row.values[segment.key])
    .map((segment) => `${segment.label}: ${formatNumber(row.values[segment.key])}`)
    .join(", ");
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}
</script>

<style scoped>
.bar {
  display: block;
  margin-top: var(--spacer-2xs);
}
</style>
