<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Order attributes") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal()">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item lines="full">
          <ion-select :label="translate('Match conditions')" interface="popover" v-model="draft.match">
            <ion-select-option value="all">{{ translate("All conditions") }}</ion-select-option>
            <ion-select-option value="any">{{ translate("Any condition") }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>

      <div v-for="condition in draft.conditions" :key="condition.id" class="attribute-condition">
        <div class="attribute-condition-header">
          <ion-note>{{ translate("Condition") }}</ion-note>
          <ion-button fill="clear" color="danger" :aria-label="translate('Remove condition')" @click="remove(condition.id)">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
        </div>
        <ion-input fill="outline" label-placement="stacked" :label="translate('Attribute name')" v-model="condition.name" placeholder="personalizationType" />
        <ion-select fill="outline" label-placement="stacked" :label="translate('Operator')" v-model="condition.operator" interface="popover">
          <ion-select-option value="is">{{ translate("Is one of") }}</ion-select-option>
          <ion-select-option value="isNot">{{ translate("Is not one of") }}</ion-select-option>
          <ion-select-option value="exists">{{ translate("Exists") }}</ion-select-option>
          <ion-select-option value="missing">{{ translate("Is missing") }}</ion-select-option>
        </ion-select>
        <ion-input v-if="conditionNeedsValues(condition.operator)" fill="outline" label-placement="stacked" :label="translate('Values, separated by commas')" v-model="condition.values" placeholder="Digital print, Embroidery" />
      </div>

      <p v-if="!draft.conditions.length" class="empty-state">
        {{ translate("No attribute restrictions. Orders can match this route regardless of their attributes.") }}
      </p>

      <ion-button fill="clear" @click="add">
        {{ translate("Add attribute condition") }}
        <ion-icon slot="end" :icon="addCircleOutline" />
      </ion-button>

      <div class="attribute-notes">
        <ion-note>{{ translate("Attribute names and values are case-sensitive. Values within a condition match any listed value.") }}</ion-note>
        <ion-note>{{ translate("Use the group Save button to keep these conditions.") }}</ion-note>
      </div>

      <ion-text v-if="error" color="danger">
        <p role="alert">{{ error }}</p>
      </ion-text>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonList, IonNote, IonPage, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { addCircleOutline, closeOutline } from "ionicons/icons";
import { translate } from "@common";
import { newCondition, useOrderAttributeConditionsStore } from "@/store/orderAttributeConditions";
import { conditionNeedsValues } from "@/utils/orderAttributeSummary";

const props = defineProps<{ routingId: string }>();

const store = useOrderAttributeConditionsStore();
const draft = computed(() => store.begin(props.routingId));
const error = computed(() => store.validationError([props.routingId])
  ? translate("Enter an attribute name and at least one value for each value condition.")
  : "");

function add() {
  draft.value.conditions.push(newCondition());
}

function remove(id: string) {
  draft.value.conditions = draft.value.conditions.filter(row => row.id !== id);
}

function closeModal() {
  // Leaving with nothing configured turns the filter back off, so the canvas
  // does not keep an empty "Order attributes" row around.
  if (!draft.value.conditions.length) draft.value.enabled = false;
  modalController.dismiss();
}
</script>

<style scoped>
.attribute-condition {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin: 0 16px 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ion-color-light-shade);
}
.attribute-condition-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.attribute-notes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 16px 24px;
}
</style>
