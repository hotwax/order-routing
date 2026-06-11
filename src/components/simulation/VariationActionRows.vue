<template>
  <div class="action-rows">
    <div v-for="a in actions" :key="a.actionSeqId" class="action-row">
      <ion-input :value="a.actionTypeEnumId" :placeholder="translate('action type')" @ionBlur="commit(a, 'actionTypeEnumId', $event)" />
      <ion-input :value="a.actionValue" :placeholder="translate('value')" @ionBlur="commit(a, 'actionValue', $event)" />
      <ion-button fill="clear" color="danger" @click="remove(a.actionSeqId)"><ion-icon :icon="trashOutline" /></ion-button>
      <ion-spinner v-if="store.saving['action:' + ruleId + ':' + a.actionSeqId] === 'saving'" name="dots" />
    </div>
    <ion-button size="small" fill="outline" @click="add">{{ translate("Add action") }}</ion-button>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { trashOutline } from "ionicons/icons";
import { IonButton, IonIcon, IonInput, IonSpinner } from "@ionic/vue";
import { variationStore } from "@/store/variationStore";
import { nextSeqId } from "@/util/variationTree";
import type { VariationAction } from "@/types/variation";

const props = defineProps<{ routingId: string; ruleId: string; actions: VariationAction[] }>();
const store = variationStore();

function commit(a: VariationAction, field: string, ev: any) {
  const value = ev?.target?.value ?? ev?.detail?.value ?? null;
  store.upsertAction(props.routingId, props.ruleId, {
    actionSeqId: a.actionSeqId,
    actionTypeEnumId: field === "actionTypeEnumId" ? value : a.actionTypeEnumId,
    actionValue: field === "actionValue" ? value : a.actionValue,
  });
}
function remove(seqId: string) { store.removeAction(props.routingId, props.ruleId, seqId); }
function add() {
  const seqId = nextSeqId(props.actions, "actionSeqId");
  store.upsertAction(props.routingId, props.ruleId, { actionSeqId: seqId, actionTypeEnumId: "ORA_NEXT_RULE", actionValue: null });
}
</script>

<style scoped>
.action-row { display: flex; align-items: center; gap: var(--spacer-sm); }
</style>
