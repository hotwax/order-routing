<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Product calendar date condition") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="dismiss()">{{ translate("Cancel") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-select v-model="draft.fieldName" :label="translate('Calendar date')" label-placement="stacked" interface="popover">
            <ion-select-option v-for="field in calendarFields" :key="field.name" :value="field.name">
              {{ translate(field.label) }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="draft.conditionTypeEnumId" :label="translate('Date direction')" label-placement="stacked" interface="popover">
            <ion-select-option v-for="direction in calendarDirections" :key="direction.value" :value="direction.value">
              {{ translate(direction.label) }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select v-model="draft.operator" :label="translate('Operator')" label-placement="stacked" interface="popover">
            <ion-select-option v-for="operator in calendarOperators" :key="operator.value" :value="operator.value">
              {{ translate(operator.label) }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-input v-model="draft.fieldValue" type="number" min="0" step="1" :label="translate('Days')" label-placement="stacked" />
        </ion-item>
      </ion-list>
      <ion-button expand="block" :disabled="!isValid" @click="save()">{{ translate("Apply condition") }}</ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList, IonPage, IonSelect, IonSelectOption, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { translate } from "@common";
import { PRODUCT_STORE_PRODUCT_DATE_CONDITION_TYPES, PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS, PRODUCT_STORE_PRODUCT_DATE_OPERATORS } from "@/utils/productCalendarDateConditions";

const props = defineProps<{ condition?: { conditionTypeEnumId?: string; fieldName?: string; operator?: string; fieldValue?: string | number } }>();

const calendarFields = [
  { name: "introductionDate", label: "Introduction date" },
  { name: "releaseDate", label: "Launch date" },
  { name: "supportDiscontinuationDate", label: "Support discontinuation date" },
  { name: "salesDiscontinuationDate", label: "Sales discontinuation date" }
];

const calendarDirections = PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS;
const calendarOperators = PRODUCT_STORE_PRODUCT_DATE_OPERATORS;

const draft = reactive({
  conditionTypeEnumId: props.condition?.conditionTypeEnumId || PRODUCT_STORE_PRODUCT_DATE_CONDITION_TYPES.SINCE,
  fieldName: props.condition?.fieldName || "releaseDate",
  operator: props.condition?.operator || "less-than",
  fieldValue: props.condition?.fieldValue?.toString() || "14"
});

const isValid = computed(() => (
  calendarFields.some((field) => field.name === draft.fieldName)
  && calendarDirections.some((direction) => direction.value === draft.conditionTypeEnumId)
  && calendarOperators.some((operator) => operator.value === draft.operator)
  && /^\d+$/.test(String(draft.fieldValue))
));

function dismiss() {
  modalController.dismiss({ dismissed: true }, "cancel");
}

function save() {
  if (!isValid.value) return;
  modalController.dismiss({ dismissed: true, condition: { ...draft, fieldValue: String(draft.fieldValue) } }, "save");
}
</script>
