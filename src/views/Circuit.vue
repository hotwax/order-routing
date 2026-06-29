<template>
  <CircuitIntro v-if="!isIntroDone" />
  <CircuitStart v-else-if="!isChatStarted" />
  <CircuitChatCanvas v-else />
</template>

<script setup lang="ts">
import { useCircuitStore } from '@/store/circuit';
import CircuitIntro from '@/components/circuit/CircuitIntro.vue';
import CircuitStart from '@/components/circuit/CircuitStart.vue';
import CircuitChatCanvas from '@/components/circuit/CircuitChatCanvas.vue';
import { storeToRefs } from 'pinia';


const circuitStore = useCircuitStore();
const { isIntroDone, isChatStarted } = storeToRefs(circuitStore);
</script>

<style scoped>
</style>

