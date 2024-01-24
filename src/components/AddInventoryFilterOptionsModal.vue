<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ "Inventory Filters" }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal()">{{ $t('Close') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-for="condition in enumerations" :key="condition.enumId">
          <ion-checkbox :checked="isConditionOptionSelected(condition.enumCode)" @ionChange="addConditionOption(condition)">{{ condition.description || condition.enumCode }}</ion-checkbox>
        </ion-item>
      </ion-list>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="saveConditionOptions()">
          <ion-icon :icon="saveOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonButtons, IonCheckbox, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonList, IonPage, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { useStore } from "vuex";
import { computed, defineProps, onMounted, ref } from "vue";
import { saveOutline } from "ionicons/icons";

const store = useStore();
const enums = computed(() => store.getters["util/getEnums"])

const props = defineProps({
  routingRuleId: {
    type: String,
    required: true
  },
  ruleConditions: {
    type: Object,
    required: true
  },
  parentEnumId: {
    type: String,
    required: true
  },
  conditionTypeEnumId: {
    type: String,
    required: true
  }
})
let inventoryRuleConditions = ref({}) as any
let enumerations = ref({}) as any
const hiddenOptions = ["IIP_MSMNT_SYSTEM"]

onMounted(() => {
  inventoryRuleConditions.value = props.ruleConditions ? JSON.parse(JSON.stringify(props.ruleConditions)) : {}
  enumerations.value = Object.values(enums.value[props.parentEnumId]).filter((enumeration: any) => !hiddenOptions.includes(enumeration.enumId))
})

function addConditionOption(condition: any) {
  const isConditionOptionAlreadyApplied = isConditionOptionSelected(condition.enumCode)?.fieldName

  if(isConditionOptionAlreadyApplied) {
    delete inventoryRuleConditions.value[props.conditionTypeEnumId][condition.enumCode]
  } else {
    // checking unchecking an option and then checking it again, we need to use the same values
    if(props.ruleConditions[props.conditionTypeEnumId]?.[condition.enumCode]) {
      inventoryRuleConditions.value[props.conditionTypeEnumId][condition.enumCode] = props.ruleConditions[props.conditionTypeEnumId][condition.enumCode]
    } else {
      // when adding a new value, we don't need to pass conditionSeqId
      // Added check that whether the filters for the conditionType exists or not, if not then create a new value for conditionType
      inventoryRuleConditions.value[props.conditionTypeEnumId] ? inventoryRuleConditions.value[props.conditionTypeEnumId][condition.enumCode] = {
        routingRuleId: props.routingRuleId,
        conditionTypeEnumId: props.conditionTypeEnumId,
        fieldName: condition.enumCode,
        sequenceNum: Object.keys(inventoryRuleConditions.value[props.conditionTypeEnumId]).length && inventoryRuleConditions.value[props.conditionTypeEnumId][Object.keys(inventoryRuleConditions.value[props.conditionTypeEnumId])[Object.keys(inventoryRuleConditions.value[props.conditionTypeEnumId]).length - 1]]?.sequenceNum >= 0 ? inventoryRuleConditions.value[props.conditionTypeEnumId][Object.keys(inventoryRuleConditions.value[props.conditionTypeEnumId])[Object.keys(inventoryRuleConditions.value[props.conditionTypeEnumId]).length - 1]].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new seqNum to 0
      } : inventoryRuleConditions.value = {
        ...inventoryRuleConditions.value,
        [props.conditionTypeEnumId]: {
          [condition.enumCode]: {
            routingRuleId: props.routingRuleId,
            conditionTypeEnumId: props.conditionTypeEnumId,
            fieldName: condition.enumCode,
            sequenceNum: 0
          }
        }
      }
    }
  }
}

function saveConditionOptions() {
  closeModal(inventoryRuleConditions.value, 'save');
}

function isConditionOptionSelected(code: string) {
  return inventoryRuleConditions.value[props.conditionTypeEnumId]?.[code]
}

function closeModal(filters = {}, action = 'close') {
  modalController.dismiss({ dismissed: true, filters }, action)
}
</script>
