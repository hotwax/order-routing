<template>
  <CircuitChatCanvas />
</template>

<script setup lang="ts">
// Canonical routing-group detail page: the canvas experience (group/routing/rule
// editor + AI chat) reached at /brokering/:routingGroupId/routes. Replaces the old
// BrokeringRoute.vue. It reuses CircuitChatCanvas but seeds the group context from the
// route param instead of the manual "add context" picker.
import { onMounted, watch } from "vue";
import CircuitChatCanvas from "@/components/circuit/CircuitChatCanvas.vue";
import { useCircuitStore } from "@/store/circuit";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { simulationStore } from "@/store/simulationStore";

const props = defineProps({
  routingGroupId: { type: String, required: true }
});
const circuitStore = useCircuitStore();
const sim = simulationStore();

// Load the simulation store for this group (baseline working copy + saved variations) so the
// detail page can also manage/edit variations via the Variations rail alongside the live group.
function loadSimulation(groupId: string) {
  if (groupId) sim.loadGroup(groupId);
}
loadSimulation(props.routingGroupId);

// Set the group context synchronously (in setup, before the canvas child mounts) so the
// canvas loads the correct group from first render — no flash of a stale persisted context.
function seedContext(groupId: string) {
  circuitStore.setActiveContext({ routingGroupId: groupId, routingName: groupId, label: groupId });
}
seedContext(props.routingGroupId);

// Enrich the context label with the real group name once the groups list is available.
async function enrichContext(groupId: string) {
  if (!groupId) return;
  const routingStore = orderRoutingStore();
  let group = (routingStore.getRoutingGroups || []).find((g: any) => g.routingGroupId === groupId);
  if (!group) {
    await routingStore.fetchOrderRoutingGroups();
    group = (routingStore.getRoutingGroups || []).find((g: any) => g.routingGroupId === groupId);
  }
  if (group) {
    circuitStore.setActiveContext({ ...group, routingName: group.groupName, label: group.groupName });
  }
}

onMounted(() => enrichContext(props.routingGroupId));
watch(() => props.routingGroupId, (id) => {
  seedContext(String(id));
  enrichContext(String(id));
  loadSimulation(String(id));
});
</script>
