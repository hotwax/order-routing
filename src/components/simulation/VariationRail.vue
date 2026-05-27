<template>
  <ion-card class="variation-rail">
    <ion-list-header>
      <ion-label>{{ translate("Variations") }}</ion-label>
      <ion-button fill="clear" @click="sim.resetWorkingToBaseline()">
        <ion-icon slot="start" :icon="refreshOutline" />
        {{ translate("Reset to baseline") }}
      </ion-button>
    </ion-list-header>

    <ion-item :color="sim.activeVariationId === '' ? 'light' : undefined" button @click="sim.resetWorkingToBaseline()">
      <ion-label>{{ translate("Baseline (live config)") }}</ion-label>
    </ion-item>

    <ion-item v-for="v in sim.variations" :key="v.id" :color="sim.activeVariationId === v.id ? 'light' : undefined">
      <ion-label button @click="sim.loadVariation(v.id)">{{ v.label }}</ion-label>
      <ion-button slot="end" fill="clear" @click="rename(v.id, v.label)"><ion-icon slot="icon-only" :icon="pencilOutline" /></ion-button>
      <ion-button slot="end" fill="clear" color="danger" @click="sim.deleteVariation(v.id)"><ion-icon slot="icon-only" :icon="trashOutline" /></ion-button>
    </ion-item>

    <div class="ion-padding">
      <ion-button expand="block" :disabled="!sim.canSubmit" @click="sim.submit()">
        {{ translate("Submit") }} ({{ sim.variations.length }})
      </ion-button>
    </div>
  </ion-card>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { alertController, IonButton, IonCard, IonIcon, IonItem, IonLabel, IonListHeader } from "@ionic/vue";
import { pencilOutline, refreshOutline, trashOutline } from "ionicons/icons";
import { simulationStore } from "@/store/simulationStore";

const sim = simulationStore();

async function rename(id: string, current: string) {
  const alert = await alertController.create({
    header: translate("Rename variation"),
    inputs: [{ name: "label", value: current }],
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { text: translate("Save"), handler: (data) => sim.renameVariation(id, data.label) },
    ],
  });
  await alert.present();
}
</script>

<style scoped>
.variation-rail { min-width: 280px; }
</style>
