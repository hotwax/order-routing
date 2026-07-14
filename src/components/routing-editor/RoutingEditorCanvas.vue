<template>
  <SimulationCanvas
    v-if="mode === 'simulation'"
    ref="simulationCanvasRef"
    :initial-order-routing-id="orderRoutingId || undefined"
  />
  <CircuitCanvas
    v-else
    ref="liveCanvasRef"
    :routing-group-id="routingGroupId || undefined"
    :initial-order-routing-id="orderRoutingId || undefined"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CircuitCanvas from "@/components/circuit/CircuitCanvas.vue";
import SimulationCanvas from "@/components/simulation/SimulationCanvas.vue";
import type { DraftConversationMessage, DraftProposal } from "@/types/draft";

type RoutingEditorMode = "live" | "circuit" | "simulation";
type CircuitDraftProposal = DraftProposal & {
  id: string;
  sourcePrompt: string;
  createdAt: number;
};

const props = withDefaults(defineProps<{
  mode?: RoutingEditorMode;
  routingGroupId?: string | null;
  orderRoutingId?: string | null;
}>(), {
  mode: "live",
  routingGroupId: null,
  orderRoutingId: null
});

const mode = computed(() => props.mode);
const liveCanvasRef = ref<{
  prepareCircuitDraftProposal?: (prompt: string, conversationHistory?: DraftConversationMessage[]) => Promise<{ proposal: CircuitDraftProposal | null; message: string; intent?: "edit" | "inquiry" }>;
  applyCircuitDraftProposal?: (proposal: CircuitDraftProposal) => Promise<{ appliedCount: number; message: string }>;
} | null>(null);
const simulationCanvasRef = ref<{
  prepareCircuitDraftProposal?: (prompt: string, conversationHistory?: DraftConversationMessage[]) => Promise<{ proposal: CircuitDraftProposal | null; message: string; intent?: "edit" | "inquiry" }>;
  applyCircuitDraftProposal?: (proposal: CircuitDraftProposal) => Promise<{ appliedCount: number; message: string }>;
} | null>(null);

function getActiveCanvas() {
  return mode.value === "simulation" ? simulationCanvasRef.value : liveCanvasRef.value;
}

async function prepareCircuitDraftProposal(prompt: string, conversationHistory: DraftConversationMessage[] = []) {
  return getActiveCanvas()?.prepareCircuitDraftProposal?.(prompt, conversationHistory)
    || { proposal: null, message: "" };
}

async function applyCircuitDraftProposal(proposal: CircuitDraftProposal) {
  return getActiveCanvas()?.applyCircuitDraftProposal?.(proposal)
    || { appliedCount: 0, message: "" };
}

defineExpose({
  prepareCircuitDraftProposal,
  applyCircuitDraftProposal
});
</script>
