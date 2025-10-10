<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Archived Rules") }}</ion-title>
    </ion-toolbar>
  </ion-header>
  
  <ion-content>
    <ion-list>
      <ion-item v-for="rule in rules" :key="rule.routingRuleId">
        <ion-label>{{ rule.ruleName }}</ion-label>
        <ion-button slot="end" fill="outline" color="medium" @click="updateRules(rule, 'statusId', 'RULE_DRAFT')">{{ translate("Unarchive") }}</ion-button>
      </ion-item>
    </ion-list>
    <p class="empty-state" v-if="!rules.length">
      {{ translate("No archived rules") }}
    </p>
  </ion-content>
</template>

<script setup lang="ts">
import { translate } from '@hotwax/dxp-components';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  modalController,
} from "@ionic/vue";
import { closeOutline } from "ionicons/icons";
import { defineProps, ref } from "vue";

const props = defineProps({
  archivedRules: {
    required: true
  },
  saveRules: {
    required: true
  } as any
})

let rules = ref(props.archivedRules) as any

// Not passing any data on modal close as we are updating the rules on every button click.
function closeModal() {
  modalController.dismiss();
}

async function updateRules(rule: any, fieldToUpdate: string, value: string) {
  // remove the updated rules from the archivedRoutings
  rules.value = rules.value.filter((inventoryRule: any) => inventoryRule.routingRuleId !== rule.routingRuleId)

  /*
  Instead of updating the same on closeModal we are updating it on every routing unarchive action, as if a user
  unarchives multiple routings and then click backdrop then the updated data can't be sent back to the parent component.
  Thus used this approach to update the parent data on every routing unarchive click

  As we need the feature to save the routing status even when backdrop is clicked thus added above approach
  */
  props.saveRules([{
    ...rule,
    [fieldToUpdate]: value
  }, ...rules.value])
}
</script>
