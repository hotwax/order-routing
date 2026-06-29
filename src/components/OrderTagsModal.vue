<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Order tags") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal()">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-for="(tag, index) in tagInputs" :key="index">
          <ion-input :label="translate('Tag')" :placeholder="translate('Enter tag')" v-model="tagInputs[index]" />
          <ion-button slot="end" fill="clear" color="danger" :disabled="tagInputs.length === 1" @click="removeTag(index)">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </ion-item>
      </ion-list>
      <ion-button expand="block" fill="clear" @click="addTag()">
        <ion-icon slot="start" :icon="addCircleOutline" />
        {{ translate("Add tag") }}
      </ion-button>
      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="saveTags()">
          <ion-icon :icon="saveOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonList, IonPage, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { addCircleOutline, saveOutline, trashOutline } from "ionicons/icons";
import { onMounted, ref } from "vue";

const props = defineProps<{
  tags?: string[]
}>()

// Local editable copy of the tag keywords; always keep at least one (empty) input row.
const tagInputs = ref<string[]>([""]);

onMounted(() => {
  tagInputs.value = props.tags?.length ? [...props.tags] : [""];
})

function addTag() {
  tagInputs.value.push("");
}

function removeTag(index: number) {
  tagInputs.value.splice(index, 1);
}

function saveTags() {
  const tags = tagInputs.value.map((tag: string) => tag.trim()).filter(Boolean);
  modalController.dismiss({ dismissed: true, tags }, "save");
}

function closeModal() {
  modalController.dismiss({ dismissed: true });
}
</script>
