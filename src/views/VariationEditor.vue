<template>
  <ion-page>
    <ion-header><ion-toolbar><ion-title>{{ translate("Variation") }}</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <div v-if="store.loadError" class="ion-padding">
        <p>{{ store.loadError }}</p>
        <ion-button fill="outline" @click="reload">{{ translate("Retry") }}</ion-button>
      </div>
      <div v-else-if="!store.tree" class="ion-padding">{{ translate("Loading variation…") }}</div>
      <template v-else>
        <ion-segment :value="view" @ionChange="view = String($event.detail.value) as 'editor' | 'results'" class="vbar">
          <ion-segment-button value="editor"><ion-label>{{ translate("Editor") }}</ion-label></ion-segment-button>
          <ion-segment-button value="results"><ion-label>{{ translate("Results") }}</ion-label></ion-segment-button>
        </ion-segment>
        <variation-canvas v-show="view === 'editor'" />
        <div v-show="view === 'results'" class="ion-padding">
          <variation-run-panel />
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { translate } from "@common";
import { IonButton, IonContent, IonHeader, IonLabel, IonPage, IonSegment, IonSegmentButton, IonTitle, IonToolbar } from "@ionic/vue";
import { variationStore } from "@/store/variationStore";
import VariationCanvas from "@/components/simulation/VariationCanvas.vue";
import VariationRunPanel from "@/components/simulation/VariationRunPanel.vue";

const props = defineProps<{ variationGroupId: string }>();
const store = variationStore();
const view = ref<"editor" | "results">("editor");

function reload() { return store.openVariation(String(props.variationGroupId)); }
onMounted(reload);
</script>

<style scoped>
.vbar { max-width: 360px; margin: var(--spacer-sm) auto; }
</style>
