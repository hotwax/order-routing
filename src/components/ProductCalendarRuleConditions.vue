<template>
  <ion-card>
    <ion-card-header>
      <ion-card-subtitle>{{ translate("Product calendar") }}</ion-card-subtitle>
      <ion-card-title>{{ translate("Date conditions") }}</ion-card-title>
    </ion-card-header>

    <ion-card-content>
      <ion-note v-if="!conditions.length">{{ translate("Add a condition to scope this rule by a product calendar date.") }}</ion-note>

      <div v-else class="calendar-condition-rows">
        <div v-for="(condition, index) in conditions" :key="condition.conditionSeqId || `${condition.conditionTypeEnumId}:${condition.fieldName}:${index}`" class="calendar-condition-row">
          <ion-select
            fill="outline"
            interface="popover"
            aria-label="Calendar date"
            :value="condition.fieldName"
            @ionChange="updateCondition(index, { fieldName: $event.detail.value })"
          >
            <ion-select-option v-for="field in calendarFields" :key="field.name" :value="field.name">
              {{ translate(field.label) }}
            </ion-select-option>
          </ion-select>
          <ion-select
            fill="outline"
            interface="popover"
            aria-label="Date direction"
            :value="condition.conditionTypeEnumId"
            @ionChange="updateCondition(index, { conditionTypeEnumId: $event.detail.value })"
          >
            <ion-select-option v-for="direction in PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS" :key="direction.value" :value="direction.value">
              {{ translate(direction.label) }}
            </ion-select-option>
          </ion-select>
          <ion-select
            fill="outline"
            interface="popover"
            aria-label="Date comparison"
            :value="condition.operator"
            @ionChange="updateCondition(index, { operator: $event.detail.value })"
          >
            <ion-select-option v-for="operator in PRODUCT_STORE_PRODUCT_DATE_OPERATORS" :key="operator.value" :value="operator.value">
              {{ translate(operator.label) }}
            </ion-select-option>
          </ion-select>
          <ion-input
            fill="outline"
            type="number"
            min="0"
            step="1"
            aria-label="Days"
            :value="condition.fieldValue"
            @ionInput="updateCondition(index, { fieldValue: $event.detail.value || '' })"
          />
          <ion-note class="calendar-condition-days">{{ translate("days") }}</ion-note>
          <ion-button fill="clear" color="medium" aria-label="Remove calendar date condition" @click="removeCondition(index)">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </div>
      </div>

      <ion-button fill="outline" size="small" @click="addCondition">
        <ion-icon slot="start" :icon="calendarOutline" />
        {{ translate("Add condition") }}
      </ion-button>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonInput, IonNote, IonSelect, IonSelectOption } from "@ionic/vue";
import { calendarOutline, trashOutline } from "ionicons/icons";
import { translate } from "@common";
import {
  PRODUCT_STORE_PRODUCT_DATE_CONDITION_TYPES,
  PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS,
  PRODUCT_STORE_PRODUCT_DATE_OPERATORS,
} from "@/utils/productCalendarDateConditions";

const props = defineProps<{ conditions: any[] }>();
const emit = defineEmits<{ "update:conditions": [conditions: any[]] }>();

const calendarFields = [
  { name: "introductionDate", label: "Introduction date" },
  { name: "releaseDate", label: "Launch date" },
  { name: "supportDiscontinuationDate", label: "Support discontinuation date" },
  { name: "salesDiscontinuationDate", label: "Sales discontinuation date" },
];

function updateCondition(index: number, updates: Record<string, any>) {
  emit("update:conditions", props.conditions.map((condition, conditionIndex) => (
    conditionIndex === index ? { ...condition, ...updates } : condition
  )));
}

function addCondition() {
  emit("update:conditions", [
    ...props.conditions,
    {
      conditionTypeEnumId: PRODUCT_STORE_PRODUCT_DATE_CONDITION_TYPES.SINCE,
      fieldName: "releaseDate",
      operator: "less-than",
      fieldValue: "14",
    },
  ]);
}

function removeCondition(index: number) {
  emit("update:conditions", props.conditions.filter((_, conditionIndex) => conditionIndex !== index));
}
</script>

<style scoped>
.calendar-condition-rows {
  display: grid;
  gap: var(--spacer-sm);
  margin-block-end: var(--spacer-sm);
}

.calendar-condition-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 0.6fr) auto auto;
  align-items: center;
  gap: var(--spacer-sm);
}

.calendar-condition-days {
  white-space: nowrap;
}

.calendar-condition-row ion-button {
  margin: 0;
}

@media (max-width: 767px) {
  .calendar-condition-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
