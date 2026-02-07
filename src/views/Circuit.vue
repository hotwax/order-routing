<template>
  <circuit-intro v-if="!isIntroDone" />
  <circuit-start v-else-if="!isChatStarted" />
  <circuit-chat-canvas v-else />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import CircuitIntro from '@/components/circuit/CircuitIntro.vue';
import CircuitStart from '@/components/circuit/CircuitStart.vue';
import CircuitChatCanvas from '@/components/circuit/CircuitChatCanvas.vue';


const store = useStore();

onMounted(() => {
  store.dispatch('circuit/checkWebGPUSupport');
});


const isIntroDone = computed(() => store.getters['circuit/isIntroDone']);
const isChatStarted = computed(() => store.getters['circuit/isChatStarted']);
</script>

<style scoped>
</style>

