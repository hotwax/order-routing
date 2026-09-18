<template>
  <RoutingDetailCanvas
    ref="canvasRef"
    :routing-group-id="String(props.routingGroupId)"
    :simulation-enabled="simulationEnabled"
  />
</template>

<script setup lang="ts">
// Canonical routing-group detail page: the canvas experience (group/routing/rule
// editor + AI chat) reached at /order-routing/:routingGroupId. Replaces the old
// BrokeringRoute.vue. It reuses RoutingDetailCanvas but seeds the group context from the
// route param instead of the manual "add context" picker.
import { nextTick, ref, watch } from "vue";
import { onIonViewDidEnter, onIonViewWillEnter, onIonViewWillLeave } from "@ionic/vue";
import { useRouter } from "vue-router";
import RoutingDetailCanvas from "@/components/circuit/RoutingDetailCanvas.vue";
import { useCircuitStore } from "@/store/circuit";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { simulationStore } from "@/store/simulationStore";
import { isFeatureEnabled } from "@/utils/simConfig";

const props = defineProps({
  routingGroupId: { type: String, required: true }
});
const circuitStore = useCircuitStore();
const sim = simulationStore();
const router = useRouter();
const simulationEnabled = isFeatureEnabled("simulation");
const canvasRef = ref<{
  activateForVisiblePage: () => Promise<void>;
  deactivateForHiddenPage: () => void;
} | null>(null);

// Load the simulation store for this group (baseline working copy + saved variations) so the
// detail page can also manage/edit variations via the Variations rail alongside the live group.
function loadSimulation(groupId: string) {
  const shouldLoad = sim.routingGroupId !== groupId
    || sim.groupLoadState === "idle"
    || sim.groupLoadState === "error";
  if (simulationEnabled && groupId && shouldLoad) {
    void sim.loadGroup(groupId);
  }
}

// Set the group context synchronously (in setup, before the canvas child mounts) so the
// canvas loads the correct group from first render — no flash of a stale persisted context.
function seedContext(groupId: string) {
  circuitStore.setActiveContext({ routingGroupId: groupId, routingName: groupId, label: groupId });
}
// Enrich the context label with the real group name once the groups list is available.
async function enrichContext(groupId: string) {
  if (!groupId) return;
  const routingStore = orderRoutingStore();
  let group = (routingStore.getRoutingGroups || []).find((g: any) => g.routingGroupId === groupId);
  if (!group) {
    await routingStore.fetchOrderRoutingGroups();
    group = (routingStore.getRoutingGroups || []).find((g: any) => g.routingGroupId === groupId);
  }
  // An older cached detail page may finish this request after another group became visible.
  // Never let that stale completion overwrite the global Circuit context.
  if (group && String(router.currentRoute.value.params.routingGroupId || "") === groupId) {
    circuitStore.setActiveContext({ ...group, routingName: group.groupName, label: group.groupName });
  }
}

function activateGroup(groupId: string) {
  if (!groupId) return;
  seedContext(groupId);
  void enrichContext(groupId);
  loadSimulation(groupId);
}

// Synchronous initial activation prevents the child canvas from rendering a stale persisted group.
activateGroup(String(props.routingGroupId));

// Ionic caches prior detail pages instead of remounting them. Re-seed every time this page becomes
// visible so G1 -> G2 -> back to G1 restores both the context and the simulation working set.
onIonViewWillEnter(() => activateGroup(String(props.routingGroupId)));
// Ionic lifecycle hooks are delivered to the routed view, not reliably to nested components.
// Let this page own editor activation so the first direct entry and every cached re-entry load the
// requested group, while RoutingDetailCanvas continues to own the concrete flush/listener cleanup.
onIonViewDidEnter(async () => {
  await nextTick();
  await canvasRef.value?.activateForVisiblePage?.();
});
onIonViewWillLeave(() => canvasRef.value?.deactivateForHiddenPage?.());
watch(() => props.routingGroupId, (id) => activateGroup(String(id)));
</script>
