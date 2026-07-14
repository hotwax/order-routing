<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button :aria-label="translate('Close')" @click="requestDismiss">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>{{ translate("Simulation") }}</ion-title>
        <ion-segment v-if="sim.baseline" slot="end" :value="sim.view" @ionChange="sim.view = $event.detail.value">
          <ion-segment-button value="editor">
            <ion-label>{{ translate("Editor") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="results">
            <ion-label>{{ (sim.isRunning || sim.isRunningVariationRun) ? translate("Simulation") : translate("Results") }}</ion-label>
            <ion-spinner v-if="sim.isRunning || sim.isRunningVariationRun" name="dots" />
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-item v-if="sim.loadError" lines="none">
        <ion-label>{{ sim.loadError }}</ion-label>
        <ion-button slot="end" fill="outline" @click="reload">{{ translate("Retry") }}</ion-button>
      </ion-item>
      <ion-item v-else-if="!sim.baseline" lines="none">
        <ion-spinner slot="start" name="dots" />
        <ion-label>{{ translate("Loading group…") }}</ion-label>
      </ion-item>
      <template v-else>
        <div v-show="sim.view === 'editor'">
          <RoutingEditorCanvas
            :key="sim.activeVariationId || 'baseline'"
            mode="simulation"
            :order-routing-id="orderRoutingId"
          />
        </div>
        <VariationRail />
        <div
          v-show="sim.view === 'results' && !sim.isRunning && !sim.results && !sim.isRunningVariationRun && !sim.variationRunResult"
          class="ion-padding"
        >
          {{ translate("No simulation has run yet. Save a variation and run it.") }}
        </div>
        <SimulationResults v-show="sim.view === 'results' && (sim.isRunning || sim.results || sim.isRunningVariationRun || sim.variationRunResult)" />
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { translate } from "@common";
import { alertController, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonPage, IonSegment, IonSegmentButton, IonSpinner, IonTitle, IonToolbar } from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";
import RoutingEditorCanvas from "@/components/routing-editor/RoutingEditorCanvas.vue";
import VariationRail from "@/components/simulation/VariationRail.vue";
import SimulationResults from "@/components/simulation/SimulationResults.vue";

const props = defineProps<{
  routingGroup: Record<string, any>;
  orderRoutingId: string;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();

const sim = simulationStore();

async function reload() {
  await sim.startFromLiveGroup(props.routingGroup);
  if (props.routingGroup?.routingGroupId) {
    await sim.resumeInFlight(props.routingGroup.routingGroupId);
  }
}

async function requestDismiss() {
  if (!sim.isDirty) {
    emit("dismiss");
    return;
  }

  const alert = await alertController.create({
    header: translate("Discard simulation changes?"),
    message: translate("Unsaved variation changes only affect the simulation workspace."),
    buttons: [
      { text: translate("Keep editing"), role: "cancel" },
      {
        text: translate("Discard changes"),
        role: "destructive",
        handler: () => emit("dismiss")
      }
    ]
  });
  await alert.present();
}

onMounted(reload);
</script>
