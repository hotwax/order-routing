<template>
  <circuit-intro v-if="!isIntroDone" />
  <circuit-start v-else-if="!isChatStarted" />
  <circuit-chat-canvas v-else />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useCircuitStore } from '@/store/circuit';
import CircuitIntro from '@/components/circuit/CircuitIntro.vue';
import CircuitStart from '@/components/circuit/CircuitStart.vue';
import CircuitChatCanvas from '@/components/circuit/CircuitChatCanvas.vue';
import { storeToRefs } from 'pinia';


const circuitStore = useCircuitStore();
const { isIntroDone, isChatStarted } = storeToRefs(circuitStore);

onMounted(() => {
  circuitStore.checkWebGPUSupport();
});
</script>

<style scoped>
</style>

