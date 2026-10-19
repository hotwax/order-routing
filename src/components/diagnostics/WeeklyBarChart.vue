<template>
  <!-- Single-series weekly bars; tapping a bar selects that week. -->
  <div class="weekly-chart">
    <ion-note class="axis-max">
      {{ maxValue.toLocaleString() }}
    </ion-note>
    <svg
      class="plot"
      :viewBox="`0 0 100 ${height}`"
      width="100%"
      :height="height"
      preserveAspectRatio="none"
      role="img"
      :aria-label="label"
    >
      <line
        v-for="tick in [0.25, 0.5, 0.75]"
        :key="tick"
        x1="0"
        x2="100"
        :y1="height * tick"
        :y2="height * tick"
        stroke="var(--ion-color-light-shade)"
        vector-effect="non-scaling-stroke"
      />
      <rect
        v-for="(value, index) in values"
        :key="index"
        class="bar"
        :x="slotWidth * index + slotWidth * 0.18"
        :y="height - barHeight(value)"
        :width="slotWidth * 0.64"
        :height="barHeight(value)"
        :fill="`var(--ion-color-${index === selectedIndex ? tone : 'medium-tint'})`"
        @click="emit('select', index)"
      />
    </svg>
    <div class="axis-weeks">
      <ion-note v-for="(week, index) in weeks" :key="week" :color="index === selectedIndex ? 'dark' : 'medium'">
        {{ (weeks.length - 1 - index) % labelStep === 0 ? week : "" }}
      </ion-note>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonNote } from "@ionic/vue";
import { computed } from "vue";
import { axisCeiling } from "@/utils/routingDiagnostics";

const props = withDefaults(defineProps<{
  weeks: string[];
  values: number[];
  selectedIndex: number | null;
  label: string;
  tone?: string;
  height?: number;
  // Most week labels that fit under the chart; past it, labels are thinned from the latest week back.
  maxLabels?: number;
}>(), { tone: "primary", height: 140, maxLabels: 8 });

const emit = defineEmits<{ (e: "select", index: number): void }>();

const labelStep = computed(() => Math.max(1, Math.ceil(props.weeks.length / props.maxLabels)));
// The axis top is rounded so the label reads as a scale, not as one week's value.
const maxValue = computed(() => axisCeiling(Math.max(0, ...props.values)));
const slotWidth = computed(() => (props.values.length ? 100 / props.values.length : 100));

function barHeight(value: number) {
  return maxValue.value ? (value / maxValue.value) * props.height : 0;
}
</script>

<style scoped>
.axis-max {
  display: block;
  margin-bottom: var(--spacer-2xs);
}

.plot {
  display: block;
}

.bar {
  cursor: pointer;
}

.axis-weeks {
  display: flex;
  margin-top: var(--spacer-2xs);
}

.axis-weeks ion-note {
  flex: 1;
  text-align: center;
  white-space: nowrap;
}
</style>
