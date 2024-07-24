<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Schedule") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
      <ion-item>
        <ion-input label-placement="stacked" :label="translate('Expression')" v-model="expression"></ion-input>
      </ion-item>
      <ion-item>
        <ion-icon slot="start" :icon="timerOutline"/>
        <ion-label>{{ cronstrue.toString(expression) || "-" }}</ion-label>
      </ion-item>
    </ion-list>

    <ion-list-header>{{ translate("Schedule Options") }}</ion-list-header>

    <ion-list>
      <ion-radio-group v-model="expression">
        <ion-item :key="expression" v-for="(expression, description) in cronExpressions">
          <ion-radio label-placement="end" justify="start" :value="expression">{{ description }}</ion-radio>
        </ion-item>
      </ion-radio-group>
    </ion-list>
    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button @click="saveChanges()" :disabled="!isExpressionUpdated()">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import {
  alertController,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonTitle,
  IonToolbar,
  modalController,
} from "@ionic/vue";
import { closeOutline, saveOutline, timerOutline } from "ionicons/icons";
import { defineProps, ref } from "vue";
import cronstrue from "cronstrue";

const props = defineProps({
  cronExpression: {
    required: true,
    type: String
  }
})

let expression = ref(props.cronExpression)
const cronExpressions = JSON.parse(process.env?.VUE_APP_CRON_EXPRESSIONS as string)

// Not passing any data on modal close as we are updating the routings on every button click.
function closeModal(expression = "") {
  modalController.dismiss({ expression });
}

function isExpressionUpdated() {
  console.log(props.cronExpression, expression.value)
  return props.cronExpression !== expression.value
}

async function saveChanges() {
  const alert = await alertController
    .create({
      header: translate("Save changes"),
      message: translate("Are you sure you want to save these changes?"),
      buttons: [{
        text: translate("Cancel"),
        role: "cancel"
      }, {
        text: translate("Save"),
        handler: () => {
          closeModal(expression.value)
        }
      }]
    });
  return alert.present();
}
</script>
