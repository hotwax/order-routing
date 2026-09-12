<template>
  <span>{{ formattedValue }}</span>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps({
  value: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 800
  }
});

const displayValue = ref(0);
let animationFrame: number | null = null;
let startTime: number | null = null;
let startValue = 0;

const formattedValue = computed(() => displayValue.value.toLocaleString());
const easeOutQuad = (progress: number) => progress * (2 - progress);

function animate(timestamp: number) {
  if (!startTime) startTime = timestamp;
  const percentage = Math.min((timestamp - startTime) / props.duration, 1);
  displayValue.value = Math.round(startValue + (props.value - startValue) * easeOutQuad(percentage));

  if (percentage < 1) animationFrame = requestAnimationFrame(animate);
  else displayValue.value = props.value;
}

function startAnimation() {
  startValue = displayValue.value;
  startTime = null;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animate);
}

watch(() => props.value, startAnimation);
onMounted(startAnimation);
onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
});
</script>
