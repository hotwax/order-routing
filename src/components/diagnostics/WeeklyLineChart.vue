<template>
  <!--
    Multi-series weekly trend. Each column is a week; tapping a column selects it so the
    surrounding card can show that week's exact values.
  -->
  <div class="weekly-chart">
    <ion-note class="axis-max">
      {{ formatNumber(maxValue) }}
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
        v-for="tick in ticks"
        :key="tick"
        x1="0"
        x2="100"
        :y1="yFor(tick)"
        :y2="yFor(tick)"
        stroke="var(--ion-color-light-shade)"
        vector-effect="non-scaling-stroke"
      />
      <rect
        v-if="selectedIndex !== null && weeks.length"
        :x="columnX(selectedIndex) - columnWidth / 2"
        y="0"
        :width="columnWidth"
        :height="height"
        fill="var(--ion-color-light)"
      />
      <g v-for="item in series" :key="item.key" :stroke="`var(--ion-color-${item.tone})`" fill="none">
        <polyline
          v-if="item.values.length > 1"
          :points="item.values.map((value, index) => `${columnX(index)},${yFor(value)}`).join(' ')"
          :stroke-width="item.emphasis ? 3 : 2"
          :stroke-opacity="item.muted ? 0.25 : 1"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <line
          v-for="(value, index) in item.values"
          :key="index"
          :x1="columnX(index)"
          :x2="columnX(index)"
          :y1="yFor(value)"
          :y2="yFor(value)"
          :stroke-width="index === selectedIndex ? 9 : 6"
          :stroke-opacity="item.muted ? 0.25 : 1"
          vector-effect="non-scaling-stroke"
          stroke-linecap="round"
        />
      </g>
      <rect
        v-for="(week, index) in weeks"
        :key="week"
        class="hit"
        :x="columnX(index) - columnWidth / 2"
        y="0"
        :width="columnWidth"
        :height="height"
        fill="transparent"
        @click="emit('select', index)"
      />
    </svg>
    <div class="axis-weeks">
      <ion-note v-for="(week, index) in weeks" :key="week" :color="index === selectedIndex ? 'dark' : 'medium'">
        {{ showWeekLabel(index) ? week : "" }}
      </ion-note>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonNote } from "@ionic/vue";
import { computed } from "vue";

export interface ChartSeries {
  key: string;
  values: number[];
  // Ionic color name used for the line, resolved to --ion-color-<tone>.
  tone: string;
  emphasis?: boolean;
  muted?: boolean;
}

const props = withDefaults(defineProps<{
  weeks: string[];
  series: ChartSeries[];
  selectedIndex: number | null;
  label: string;
  height?: number;
  // Fixed axis top, e.g. 1 for shares; when omitted the axis fits the visible series.
  axisMax?: number;
  formatValue?: (value: number) => string;
}>(), { height: 160, axisMax: undefined, formatValue: undefined });

const emit = defineEmits<{ (e: "select", index: number): void }>();

const inset = 8;

// When a series is highlighted the axis fits it, so a small rule is not flattened by a large one.
const maxValue = computed(() => {
  if(props.axisMax) {return props.axisMax;}
  const highlighted = props.series.filter((item) => !item.muted);
  const scaled = highlighted.length ? highlighted : props.series;
  const max = Math.max(0, ...scaled.flatMap((item) => item.values));

  return niceCeiling(max);
});

const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((fraction) => maxValue.value * fraction));

const columnWidth = computed(() => (props.weeks.length ? 100 / props.weeks.length : 100));

function columnX(index: number) {
  return columnWidth.value * index + columnWidth.value / 2;
}

function yFor(value: number) {
  const usable = props.height - inset * 2;

  const fraction = maxValue.value ? Math.min(value / maxValue.value, 1) : 0;

  return inset + (1 - fraction) * usable;
}

// Rounds the axis top up to 1, 2 or 5 times a power of ten so gridlines land on round numbers.
function niceCeiling(value: number) {
  if(value <= 0) {return 1;}
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 5, 10].find((multiplier) => multiplier * magnitude >= value) || 10;

  return step * magnitude;
}

// Past eight weeks the labels no longer fit on one line, so every other one is shown,
// counting back from the latest week. The selected week is named in the card subtitle.
function showWeekLabel(index: number) {
  return props.weeks.length <= 8 || (props.weeks.length - 1 - index) % 2 === 0;
}

function formatNumber(value: number) {
  return props.formatValue ? props.formatValue(value) : value.toLocaleString();
}
</script>

<style scoped>
.weekly-chart {
  position: relative;
}

.axis-max {
  display: block;
  margin-bottom: var(--spacer-2xs);
}

.plot {
  display: block;
}

.hit {
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
