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
          <ion-select v-model="draft.operator" :label="translate('Date distance')" label-placement="stacked" interface="popover">
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

const props = defineProps<{ condition?: { fieldName?: string; operator?: string; fieldValue?: string | number } }>();

const calendarFields = [
  { name: "introductionDate", label: "Introduction date" },
  { name: "releaseDate", label: "Launch date" },
  { name: "supportDiscontinuationDate", label: "Support discontinuation date" },
  { name: "salesDiscontinuationDate", label: "Sales discontinuation date" }
];

const calendarOperators = [
  { value: "days-since-less-than", label: "Days since is less than" },
  { value: "days-since-less-than-equal-to", label: "Days since is less than or equal to" },
  { value: "days-since-greater-than", label: "Days since is greater than" },
  { value: "days-since-greater-than-equal-to", label: "Days since is greater than or equal to" },
  { value: "days-since-equals", label: "Days since equals" },
  { value: "days-till-less-than", label: "Days till is less than" },
  { value: "days-till-less-than-equal-to", label: "Days till is less than or equal to" },
  { value: "days-till-greater-than", label: "Days till is greater than" },
  { value: "days-till-greater-than-equal-to", label: "Days till is greater than or equal to" },
  { value: "days-till-equals", label: "Days till equals" }
];

const draft = reactive({
  fieldName: props.condition?.fieldName || "releaseDate",
  operator: props.condition?.operator || "days-since-less-than",
  fieldValue: props.condition?.fieldValue?.toString() || "14"
});

const isValid = computed(() => (
  calendarFields.some((field) => field.name === draft.fieldName)
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
