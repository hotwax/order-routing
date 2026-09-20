<template>
  <ion-card>
    <ion-card-header>
      <ion-card-subtitle>{{ translate("Product calendar") }}</ion-card-subtitle>
      <ion-card-title>{{ translate("Date conditions") }}</ion-card-title>
    </ion-card-header>

    <ion-list v-if="conditions.length">
      <ion-item v-for="condition in conditions" :key="productStoreProductDateConditionKey(condition)" button detail @click="openConditionModal(condition)">
        <ion-label class="ion-text-wrap">
          <h3>{{ calendarFieldLabels[condition.fieldName] || condition.fieldName }}</h3>
          <p>{{ productStoreProductDateConditionLabel(condition) }} {{ condition.fieldValue }} {{ translate("days") }}</p>
        </ion-label>
        <ion-button slot="end" fill="clear" color="medium" aria-label="Remove calendar date condition" @click.stop="removeCondition(condition)">
          <ion-icon slot="icon-only" :icon="trashOutline" />
        </ion-button>
      </ion-item>
    </ion-list>

    <ion-card-content>
      <ion-note v-if="!conditions.length">{{ translate("No product calendar date condition is applied.") }}</ion-note>
      <ion-button fill="outline" @click="openConditionModal()">
        <ion-icon slot="start" :icon="calendarOutline" />
        {{ translate("Add date condition") }}
      </ion-button>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonNote, modalController } from "@ionic/vue";
import { calendarOutline, trashOutline } from "ionicons/icons";
import { translate } from "@common";
import ProductCalendarConditionModal from "@/components/ProductCalendarConditionModal.vue";
import {
  productStoreProductDateConditionKey,
  productStoreProductDateConditionLabel,
} from "@/utils/productCalendarDateConditions";

const props = defineProps<{ conditions: any[] }>();
const emit = defineEmits<{ "update:conditions": [conditions: any[]] }>();

const calendarFieldLabels: Record<string, string> = {
  introductionDate: "Introduction date",
  releaseDate: "Launch date",
  supportDiscontinuationDate: "Support discontinuation date",
  salesDiscontinuationDate: "Sales discontinuation date",
};

async function openConditionModal(existingCondition?: any) {
  const modal = await modalController.create({
    component: ProductCalendarConditionModal,
    componentProps: { condition: existingCondition ? { ...existingCondition } : undefined },
  });

  modal.onDidDismiss().then((result: any) => {
    if (result.role !== "save" || !result.data?.condition) return;

    const savedCondition = result.data.condition;
    const existingKey = existingCondition ? productStoreProductDateConditionKey(existingCondition) : "";
    const savedKey = productStoreProductDateConditionKey(savedCondition);
    const matchingCondition = existingCondition || props.conditions.find((condition) => (
      productStoreProductDateConditionKey(condition) === savedKey
    ));
    const retainedConditions = props.conditions.filter((condition) => {
      const conditionKey = productStoreProductDateConditionKey(condition);
      return conditionKey !== existingKey && conditionKey !== savedKey;
    });

    emit("update:conditions", [
      ...retainedConditions,
      {
        ...matchingCondition,
        ...savedCondition,
      },
    ]);
  });

  await modal.present();
}

function removeCondition(conditionToRemove: any) {
  const conditionKey = productStoreProductDateConditionKey(conditionToRemove);
  emit("update:conditions", props.conditions.filter((condition) => (
    productStoreProductDateConditionKey(condition) !== conditionKey
  )));
}
</script>
