<template>
  <ion-content>
    <ion-item lines="none">
      <ion-label>{{ $t("Options") }}</ion-label>
    </ion-item>
    <ion-item lines="none">
      <ion-icon slot="start" :icon="trashOutline" />
      <ion-label>{{ $t("Remove") }}</ion-label>
    </ion-item>
    <ion-item lines="none">
      <ion-icon slot="start" :icon="copyOutline" />
      <ion-label>{{ $t("Duplicate") }}</ion-label>
    </ion-item>
  </ion-content>
</template>

<script>
import { IonContent, IonIcon, IonLabel, IonItem } from '@ionic/vue';
import { defineComponent } from 'vue';
import { useStore } from "vuex";
import {
  copyOutline,
  trashOutline
} from 'ionicons/icons';
export default defineComponent({
  name: 'rulePopover',
  components: { IonContent, IonIcon, IonLabel, IonItem },
  setup() {
    const store = useStore();
    return {
      copyOutline,
      trashOutline,
      store
    }
  }
});
</script>