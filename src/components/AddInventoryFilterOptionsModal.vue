<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate(`Inventory ${props.label}`) }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal()">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="!enumerations.length" class="empty-state">
        <p>{{ translate(`Failed to fetch ${props.label?.toLowerCase()} options`) }}</p>
      </div>
      <ion-list v-else>
        <ion-item v-for="condition in enumerations" :key="condition.enumId">
          <ion-checkbox :checked="isConditionOptionSelected(condition.enumCode)" @ionChange="addConditionOption(condition)">{{ condition.description || condition.enumCode }}</ion-checkbox>
        </ion-item>
      </ion-list>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button :disabled="!areFiltersUpdated" @click="saveConditionOptions()">
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
import { DateTime } from "luxon";
import { translate } from "@/i18n";

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
  },
  label: {
    type: String
  }
})
let inventoryRuleConditions = ref({}) as any
let enumerations = ref([]) as any
let areFiltersUpdated = ref(false)

const hiddenOptions = ["IIP_MSMNT_SYSTEM", "IIP_SPLIT_ITEM_GROUP"]
// managing this object, as we have some filters for which we need to have its associated filter, like in this case when we have PROXIMITY we also need to add MEASUREMENT_SYSTEM(this is not available on UI for selection and included in hiddenOptions)
const associatedOptions = { IIP_PROXIMITY: { enum: "IIP_MSMNT_SYSTEM", defaultValue: "IMPERIAL" }} as any

onMounted(() => {
  inventoryRuleConditions.value = props.ruleConditions ? JSON.parse(JSON.stringify(props.ruleConditions)) : {}
  enumerations.value = enums.value[props.parentEnumId] ? Object.values(enums.value[props.parentEnumId]).filter((enumeration: any) => !hiddenOptions.includes(enumeration.enumId)) : []
})

function checkFilters() {
  areFiltersUpdated.value = false;
  areFiltersUpdated.value = Object.keys(inventoryRuleConditions.value).some((options: string) => {
    return !props.ruleConditions[options]
  })

  areFiltersUpdated.value = areFiltersUpdated.value ? areFiltersUpdated.value : Object.keys(props.ruleConditions).some((options: string) => {
    return !inventoryRuleConditions.value[options]
  })
}

function addConditionOption(condition: any) {
  const isConditionOptionAlreadyApplied = isConditionOptionSelected(condition.enumCode)?.fieldName
  const associatedEnum = enums.value[props.parentEnumId][associatedOptions[condition.enumId]?.enum]
  if(isConditionOptionAlreadyApplied) {
    delete inventoryRuleConditions.value[condition.enumCode]
    // When removing a condition, also remove its associated option if available
    associatedEnum && delete inventoryRuleConditions.value[associatedEnum.enumCode]
  } else {
    // checking unchecking an option and then checking it again, we need to use the same values
    if(props.ruleConditions?.[condition.enumCode]) {
      inventoryRuleConditions.value[condition.enumCode] = props.ruleConditions[condition.enumCode]
      associatedEnum && (inventoryRuleConditions.value[associatedEnum.enumCode] = props.ruleConditions[associatedEnum.enumCode])
    } else {
      // when adding a new value, we don't need to pass conditionSeqId
      // Added check that whether the filters for the conditionType exists or not, if not then create a new value for conditionType
      inventoryRuleConditions.value[condition.enumCode] = {
        routingRuleId: props.routingRuleId,
        conditionTypeEnumId: props.conditionTypeEnumId,
        fieldName: condition.enumCode,
        sequenceNum: Object.keys(inventoryRuleConditions.value).length && inventoryRuleConditions.value[Object.keys(inventoryRuleConditions.value)[Object.keys(inventoryRuleConditions.value).length - 1]]?.sequenceNum >= 0 ? inventoryRuleConditions.value[Object.keys(inventoryRuleConditions.value)[Object.keys(inventoryRuleConditions.value).length - 1]].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new seqNum to 0
        createdDate: DateTime.now().toMillis()
      }

      // Adding associatedEnum out of ternary, as we will always get the conditionTypeEnumId, as the filter will already handle that
      associatedEnum && (inventoryRuleConditions.value[associatedEnum.enumCode] = {
        routingRuleId: props.routingRuleId,
        conditionTypeEnumId: props.conditionTypeEnumId,
        fieldName: associatedEnum.enumCode,
        fieldValue: associatedOptions[condition.enumId]?.defaultValue,
        sequenceNum: Object.keys(inventoryRuleConditions.value).length && inventoryRuleConditions.value[Object.keys(inventoryRuleConditions.value)[Object.keys(inventoryRuleConditions.value).length - 1]]?.sequenceNum >= 0 ? inventoryRuleConditions.value[Object.keys(inventoryRuleConditions.value)[Object.keys(inventoryRuleConditions.value).length - 1]].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new seqNum to 0
        createdDate: DateTime.now().toMillis()
      })
    }
  }

  checkFilters()
}

function saveConditionOptions() {
  closeModal("save");
}

function isConditionOptionSelected(code: string) {
  return inventoryRuleConditions.value?.[code]
}

function closeModal(action = "close") {
  modalController.dismiss({ dismissed: true, filters: inventoryRuleConditions.value }, action)
}
</script>
