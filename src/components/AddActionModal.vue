<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ $t("Add actions") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-searchbar :placeholder="$t('Search')" />
    
    <ion-list>
      <ion-item>
        <ion-label>Route orders</ion-label>
        <ion-button fill="outline" color="medium">{{ $t("Add") }}</ion-button>
      </ion-item>
      <ion-item>
        <ion-label>Re-broker orders</ion-label>
        <ion-button fill="outline" color="medium">{{ $t("Add") }}</ion-button>
      </ion-item>
      <ion-item>
        <ion-label>Load pre-order category</ion-label>
        <ion-button fill="outline" color="medium">{{ $t("Add") }}</ion-button>
      </ion-item>
    </ion-list>
  </ion-content>
</template>

<script lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import { defineComponent } from 'vue';
import { closeOutline } from 'ionicons/icons';
import { useStore } from "@/store";

export default defineComponent({
  name: "Modal",
  components: {
    IonButton,
    IonButtons,
    IonContent,
    IonIcon,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    IonTitle,
    IonToolbar,
  },
  methods: {
    closeModal() {
      modalController.dismiss({ dismissed: true });
    }
  },
  setup() {
    const store = useStore();
    return {
      closeOutline,
      store,
    };
  },
});
</script>
