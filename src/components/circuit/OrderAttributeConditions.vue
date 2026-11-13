<template>
  <ion-card v-if="enabled" data-testid="order-attribute-conditions">
    <ion-card-header>
      <div class="attribute-card-header">
        <div>
          <ion-card-title>{{ translate("Order attributes") }}</ion-card-title>
          <ion-card-subtitle>{{ translate("Select orders for this route") }}</ion-card-subtitle>
        </div>
        <ion-button fill="clear" size="default" :aria-label="translate('Edit order attribute conditions')" @click="openBuilder">
          <ion-icon slot="icon-only" :icon="createOutline" />
        </ion-button>
      </div>
    </ion-card-header>
    <ion-card-content class="attribute-card-content">
      <ion-list lines="full">
        <ion-item v-if="draft.conditions.length > 1">
          <ion-note>{{ matchLabel }}</ion-note>
        </ion-item>
        <ion-item v-for="condition in draft.conditions" :key="condition.id" button detail @click="openBuilder">
          <ion-label>
            <template v-if="isConditionComplete(condition)">{{ summarizeCondition(condition) }}</template>
            <ion-text v-else color="danger">{{ translate("Incomplete condition") }}</ion-text>
          </ion-label>
        </ion-item>
        <ion-item v-if="!draft.conditions.length" button detail @click="openBuilder">
          <ion-label color="medium">{{ translate("No conditions yet") }}</ion-label>
        </ion-item>
      </ion-list>
      <ion-text v-if="error" color="danger">
        <p role="alert">{{ error }}</p>
      </ion-text>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonItem, IonLabel, IonList, IonNote, IonText, modalController } from "@ionic/vue";
import { createOutline } from "ionicons/icons";
import { translate } from "@common";
import { useOrderAttributeConditionsStore } from "@/store/orderAttributeConditions";
import { isConditionComplete, summarizeCondition } from "@/utils/orderAttributeSummary";
import OrderAttributeConditionsModal from "./OrderAttributeConditionsModal.vue";

const props = defineProps<{ routingId: string }>();

const store = useOrderAttributeConditionsStore();
const draft = computed(() => store.begin(props.routingId));
const enabled = computed(() => store.isEnabledFor(props.routingId));
const matchLabel = computed(() => draft.value.match === "any"
  ? translate("Any condition matches")
  : translate("All conditions must match"));
const error = computed(() => store.validationError([props.routingId])
  ? translate("Enter an attribute name and at least one value for each value condition.")
  : "");

async function openBuilder() {
  const builder = await modalController.create({
    component: OrderAttributeConditionsModal,
    componentProps: { routingId: props.routingId }
  });
  await builder.present();
}
</script>

<style scoped>
.attribute-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.attribute-card-content {
  padding-inline: 0;
}
.attribute-card-content ion-text p {
  padding-inline: 16px;
}
</style>
