<template>
  <div class="cond-rows">
    <div v-for="c in conditions" :key="c.conditionSeqId" class="cond-row" :class="{ placeholder: isPlaceholder(c) }">
      <ion-input
        :value="c.fieldName"
        :placeholder="translate('field')"
        @ionBlur="commit(c, 'fieldName', $event)"
      />
      <ion-select :value="c.operator || 'equals'" interface="popover" @ionChange="commit(c, 'operator', $event)">
        <ion-select-option value="equals">=</ion-select-option>
        <ion-select-option value="in">in</ion-select-option>
        <ion-select-option value="not-equals">≠</ion-select-option>
        <ion-select-option value="not-in">not in</ion-select-option>
      </ion-select>
      <ion-input :value="c.fieldValue" :placeholder="translate('value')" @ionBlur="commit(c, 'fieldValue', $event)" />
      <ion-button fill="clear" color="danger" @click="remove(c.conditionSeqId)">
        <ion-icon :icon="trashOutline" />
      </ion-button>
      <ion-spinner v-if="saveStatus(c.conditionSeqId) === 'saving'" name="dots" />
    </div>
    <ion-button size="small" fill="outline" @click="add">{{ translate("Add condition") }}</ion-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { translate } from "@common";
import { trashOutline } from "ionicons/icons";
import { IonButton, IonIcon, IonInput, IonSelect, IonSelectOption, IonSpinner } from "@ionic/vue";
import { variationStore } from "@/store/variationStore";
import { isPlaceholder, nextSeqId } from "@/util/variationTree";
import type { VariationCondition } from "@/types/variation";

const props = defineProps<{
  kind: "filter" | "invcond";
  routingId: string;
  ruleId?: string;
  conditions: VariationCondition[];
}>();
const store = variationStore();

const keyPrefix = computed(() => (props.kind === "filter" ? `filter:${props.routingId}` : `invcond:${props.ruleId}`));
const saveStatus = (seqId: string) => store.saving[`${keyPrefix.value}:${seqId}`];

function buildInput(c: VariationCondition, field: string, ev: any) {
  const value = ev?.target?.value ?? ev?.detail?.value ?? null;
  return {
    conditionSeqId: c.conditionSeqId,
    fieldName: field === "fieldName" ? value : (c.fieldName ?? ""),
    operator: field === "operator" ? value : (c.operator ?? "equals"),
    fieldValue: field === "fieldValue" ? value : (c.fieldValue ?? ""),
    sequenceNum: c.sequenceNum,
  };
}

function commit(c: VariationCondition, field: string, ev: any) {
  const input = buildInput(c, field, ev);
  if (props.kind === "filter") store.upsertFilter(props.routingId, input);
  else store.upsertInventoryCondition(props.routingId, props.ruleId!, input);
}

function remove(seqId: string) {
  if (props.kind === "filter") store.removeFilter(props.routingId, seqId);
  else store.removeInventoryCondition(props.routingId, props.ruleId!, seqId);
}

function add() {
  const seqId = nextSeqId(props.conditions, "conditionSeqId");
  const input = { conditionSeqId: seqId, fieldName: "", operator: "equals", fieldValue: "", sequenceNum: props.conditions.length };
  if (props.kind === "filter") store.upsertFilter(props.routingId, input);
  else store.upsertInventoryCondition(props.routingId, props.ruleId!, input);
}
</script>

<style scoped>
.cond-row { display: flex; align-items: center; gap: var(--spacer-sm); }
.cond-row.placeholder { opacity: 0.55; }
</style>
