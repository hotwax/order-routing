<template>
  <div class="section-header">
    <h1>{{ translate("Products by date") }}</h1>
  </div>

  <ion-card>
    <ion-card-content>
      <div class="calendar-condition-rows">
        <div v-for="row in calendarConditionRows" :key="row.id" class="calendar-condition-row">
          <ion-select
            fill="outline"
            interface="popover"
            aria-label="Calendar date"
            :placeholder="translate('Select date')"
            :value="row.condition.fieldName"
            @ionChange="updateCondition(row, { fieldName: $event.detail.value })"
          >
            <ion-select-option v-for="field in calendarFields" :key="field.name" :value="field.name">
              {{ translate(field.label) }}
            </ion-select-option>
          </ion-select>
          <ion-select
            fill="outline"
            interface="popover"
            aria-label="Date direction"
            :placeholder="translate('Select direction')"
            :value="row.condition.conditionTypeEnumId"
            @ionChange="updateCondition(row, { conditionTypeEnumId: $event.detail.value })"
          >
            <ion-select-option v-for="direction in PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS" :key="direction.value" :value="direction.value">
              {{ translate(direction.label) }}
            </ion-select-option>
          </ion-select>
          <ion-select
            fill="outline"
            interface="popover"
            aria-label="Date comparison"
            :placeholder="translate('Select comparison')"
            :value="row.condition.operator"
            @ionChange="updateCondition(row, { operator: $event.detail.value })"
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
            :placeholder="translate('Days')"
            :value="row.condition.fieldValue"
            @ionInput="updateCondition(row, { fieldValue: $event.detail.value ?? '' })"
          />
          <ion-note class="calendar-condition-days">{{ translate("days") }}</ion-note>
          <ion-button fill="clear" color="medium" aria-label="Remove calendar date condition" @click="removeCondition(row)">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </div>
      </div>

      <ion-button class="calendar-condition-actions" fill="clear" size="small" @click="addCondition">
        {{ translate("Add condition") }}
        <ion-icon slot="end" :icon="addCircleOutline" />
      </ion-button>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { IonButton, IonCard, IonCardContent, IonIcon, IonInput, IonNote, IonSelect, IonSelectOption } from "@ionic/vue";
import { addCircleOutline, trashOutline } from "ionicons/icons";
import { translate } from "@common";
import {
  PRODUCT_STORE_PRODUCT_DATE_CONDITION_TYPES,
  PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS,
  PRODUCT_STORE_PRODUCT_DATE_OPERATORS,
} from "@/utils/productCalendarDateConditions";

type CalendarCondition = Record<string, any>;
type CalendarConditionRow = {
  id: string;
  kind: "saved" | "draft" | "base";
  condition: CalendarCondition;
  index: number;
};

const props = defineProps<{ conditions: CalendarCondition[] }>();
const emit = defineEmits<{ "update:conditions": [conditions: CalendarCondition[]] }>();

const calendarFields = [
  { name: "introductionDate", label: "Introduction date" },
  { name: "releaseDate", label: "Launch date" },
  { name: "supportDiscontinuationDate", label: "Support discontinuation date" },
  { name: "salesDiscontinuationDate", label: "Sales discontinuation date" },
];

const baseCondition = ref<CalendarCondition>(createEmptyCondition());
const draftConditions = ref<Array<{ id: string; condition: CalendarCondition }>>([]);
let nextDraftId = 1;

const calendarConditionRows = computed<CalendarConditionRow[]>(() => {
  const savedRows = props.conditions.map((condition, index) => ({
    id: `saved:${condition.conditionSeqId || `${condition.conditionTypeEnumId}:${condition.fieldName}:${index}`}`,
    kind: "saved" as const,
    condition,
    index,
  }));
  const draftRows = draftConditions.value.map((draft, index) => ({
    id: draft.id,
    kind: "draft" as const,
    condition: draft.condition,
    index,
  }));

  if (!savedRows.length && !draftRows.length) {
    return [{ id: "base", kind: "base", condition: baseCondition.value, index: 0 }];
  }

  return [...savedRows, ...draftRows];
});

function createEmptyCondition(): CalendarCondition {
  return {
    conditionTypeEnumId: "",
    fieldName: "",
    operator: "",
    fieldValue: "",
  };
}

function isCompleteCondition(condition: CalendarCondition) {
  return calendarFields.some((field) => field.name === condition.fieldName)
    && PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS.some((direction) => direction.value === condition.conditionTypeEnumId)
    && PRODUCT_STORE_PRODUCT_DATE_OPERATORS.some((operator) => operator.value === condition.operator)
    && /^\d+$/.test(String(condition.fieldValue));
}

function updateCondition(row: CalendarConditionRow, updates: CalendarCondition) {
  const updatedCondition = { ...row.condition, ...updates };

  if (row.kind === "saved") {
    emit("update:conditions", props.conditions.map((condition, index) => (
      index === row.index ? updatedCondition : condition
    )));
    return;
  }

  if (row.kind === "base") {
    baseCondition.value = updatedCondition;
  } else {
    draftConditions.value = draftConditions.value.map((draft, index) => (
      index === row.index ? { ...draft, condition: updatedCondition } : draft
    ));
  }

  if (!isCompleteCondition(updatedCondition)) return;

  emit("update:conditions", [...props.conditions, updatedCondition]);
  if (row.kind === "base") baseCondition.value = createEmptyCondition();
  else draftConditions.value = draftConditions.value.filter((_, index) => index !== row.index);
}

function addCondition() {
  draftConditions.value = [
    ...draftConditions.value,
    { id: `draft:${nextDraftId++}`, condition: createEmptyCondition() },
  ];
}

function removeCondition(row: CalendarConditionRow) {
  if (row.kind === "base") {
    baseCondition.value = createEmptyCondition();
    return;
  }

  if (row.kind === "draft") {
    draftConditions.value = draftConditions.value.filter((_, index) => index !== row.index);
    return;
  }

  emit("update:conditions", props.conditions.filter((_, index) => index !== row.index));
  if (props.conditions.length === 1 && !draftConditions.value.length) {
    baseCondition.value = createEmptyCondition();
  }
}
</script>

<style scoped>
.calendar-condition-rows {
  display: grid;
  gap: var(--spacer-sm);
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

.calendar-condition-actions {
  margin-block-start: var(--spacer-sm);
}

@media (max-width: 767px) {
  .calendar-condition-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
