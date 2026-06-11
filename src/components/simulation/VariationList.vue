<template>
  <ion-list>
    <ion-list-header>
      <ion-label>{{ translate("Variations of") }} {{ parentName || parentRoutingGroupId }}</ion-label>
      <ion-button size="small" @click="openCreate">{{ translate("New variation") }}</ion-button>
    </ion-list-header>

    <ion-note v-if="!store.listLoading && !store.variations.length" class="ion-padding">
      {{ translate("No variations yet. Create one to start a what-if.") }}
    </ion-note>
    <ion-spinner v-if="store.listLoading" name="dots" />

    <ion-item
      v-for="v in store.variations"
      :key="v.variationGroupId"
      button
      @click="open(v.variationGroupId)"
    >
      <ion-label>
        <h2>{{ v.variationName || v.variationGroupId }}</h2>
        <p>{{ v.variationGroupId }}</p>
      </ion-label>
    </ion-item>

    <ion-note class="ion-padding-horizontal note-accumulate">
      {{ translate("Variations can't be deleted yet, so they accumulate.") }}
    </ion-note>
  </ion-list>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { translate } from "@common";
import { alertController, IonButton, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonSpinner } from "@ionic/vue";
import { variationStore } from "@/store/variationStore";
import router from "@/router";

const props = defineProps<{ parentRoutingGroupId: string; parentName?: string }>();
const store = variationStore();

onMounted(() => store.fetchVariations(props.parentRoutingGroupId));

function open(vid: string) {
  router.push(`/simulate/variation/${vid}`);
}

async function openCreate() {
  const alert = await alertController.create({
    header: translate("New variation"),
    inputs: [{ name: "variationName", type: "text", placeholder: translate("Name (optional)") }],
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      {
        text: translate("Create"),
        handler: async (data: any) => {
          const vid = await store.createVariation(props.parentRoutingGroupId, (data?.variationName || "").trim() || undefined);
          if (vid) open(vid);
        },
      },
    ],
  });
  await alert.present();
}
</script>

<style scoped>
.note-accumulate { display: block; color: var(--ion-color-medium); font-size: 0.8rem; }
</style>
