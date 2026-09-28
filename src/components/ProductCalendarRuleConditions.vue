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
            <ion-select-option v-for="field in PRODUCT_STORE_PRODUCT_DATE_FIELDS" :key="field.name" :value="field.name">
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
import { computed, ref, watch } from "vue";
import { IonButton, IonCard, IonCardContent, IonIcon, IonInput, IonNote, IonSelect, IonSelectOption } from "@ionic/vue";
import { addCircleOutline, trashOutline } from "ionicons/icons";
import { translate } from "@common";
import {
  PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS,
  PRODUCT_STORE_PRODUCT_DATE_FIELDS,
  PRODUCT_STORE_PRODUCT_DATE_OPERATORS,
  productStoreProductDateConditionKey,
} from "@/utils/productCalendarDateConditions";

type CalendarCondition = Record<string, any>;
type CalendarConditionRow = {
  id: string;
  kind: "saved" | "draft";
  condition: CalendarCondition;
  index: number;
};

const props = defineProps<{ conditions: CalendarCondition[] }>();
const emit = defineEmits<{ "update:conditions": [conditions: CalendarCondition[]] }>();

const draftConditions = ref<Array<{ id: string; condition: CalendarCondition }>>([]);
// An incomplete edit to an already-saved row is parked here rather than emitted, so a half-typed
// condition can never reach the parent's save payload.
const pendingSavedEdits = ref<Record<string, CalendarCondition>>({});
let nextDraftId = 1;

const calendarConditionRows = computed<CalendarConditionRow[]>(() => {
  const savedRows = props.conditions.map((condition, index) => {
    const id = `saved:${condition.conditionSeqId || `${condition.conditionTypeEnumId}:${condition.fieldName}:${index}`}`;
    return { id, kind: "saved" as const, condition: pendingSavedEdits.value[id] || condition, index };
  });
  const draftRows = draftConditions.value.map((draft, index) => ({
    id: draft.id,
    kind: "draft" as const,
    condition: draft.condition,
    index,
  }));

  return [...savedRows, ...draftRows];
});

// The card always offers somewhere to type, so an empty list keeps one blank draft open.
watch(
  [() => props.conditions.length, () => draftConditions.value.length],
  ([savedCount, draftCount]) => { if (!savedCount && !draftCount) addCondition(); },
  { immediate: true },
);

function createEmptyCondition(): CalendarCondition {
  return {
    conditionTypeEnumId: "",
    fieldName: "",
    operator: "",
    fieldValue: "",
  };
}

function isCompleteCondition(condition: CalendarCondition) {
  return PRODUCT_STORE_PRODUCT_DATE_FIELDS.some((field) => field.name === condition.fieldName)
    && PRODUCT_STORE_PRODUCT_DATE_DIRECTIONS.some((direction) => direction.value === condition.conditionTypeEnumId)
    && PRODUCT_STORE_PRODUCT_DATE_OPERATORS.some((operator) => operator.value === condition.operator)
    && /^\d+$/.test(String(condition.fieldValue));
}

// A condition is identified by its direction and date alone, so the emitted list carries at most
// one row per identity. Two rows sharing a pair would both match the same persisted condition in
// buildLegacyRuleConditions and be handed the same conditionSeqId.
function withCondition(condition: CalendarCondition, replaceIndex = -1) {
  const identity = productStoreProductDateConditionKey(condition);
  const next = replaceIndex >= 0
    ? props.conditions.map((existing, index) => (index === replaceIndex ? condition : existing))
    : [...props.conditions, condition];
  const writtenIndex = replaceIndex >= 0 ? replaceIndex : next.length - 1;
  return next.filter((existing, index) => (
    index === writtenIndex || productStoreProductDateConditionKey(existing) !== identity
  ));
}

function clearPendingEdit(rowId: string) {
  if (!(rowId in pendingSavedEdits.value)) return;
  const remaining = { ...pendingSavedEdits.value };
  delete remaining[rowId];
  pendingSavedEdits.value = remaining;
}

function updateCondition(row: CalendarConditionRow, updates: CalendarCondition) {
  const updatedCondition = { ...row.condition, ...updates };

  if (row.kind === "saved") {
    if (!isCompleteCondition(updatedCondition)) {
      pendingSavedEdits.value = { ...pendingSavedEdits.value, [row.id]: updatedCondition };
      return;
    }
    clearPendingEdit(row.id);
    emit("update:conditions", withCondition(updatedCondition, row.index));
    return;
  }

  draftConditions.value = draftConditions.value.map((draft, index) => (
    index === row.index ? { ...draft, condition: updatedCondition } : draft
  ));

  if (!isCompleteCondition(updatedCondition)) return;

  emit("update:conditions", withCondition(updatedCondition));
  draftConditions.value = draftConditions.value.filter((_, index) => index !== row.index);
}

function addCondition() {
  draftConditions.value = [
    ...draftConditions.value,
    { id: `draft:${nextDraftId++}`, condition: createEmptyCondition() },
  ];
}

function removeCondition(row: CalendarConditionRow) {
  if (row.kind === "draft") {
    draftConditions.value = draftConditions.value.filter((_, index) => index !== row.index);
    return;
  }

  clearPendingEdit(row.id);
  emit("update:conditions", props.conditions.filter((_, index) => index !== row.index));
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
