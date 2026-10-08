<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ translate("Inventory {label}", { label: props.label }) }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal()">{{ translate("Close") }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="!enumerations.length" class="empty-state">
        <p>{{ translate("Failed to fetch {label} options", { label: props.label?.toLowerCase() }) }}</p>
      </div>

      <ion-list v-else>
        <ion-item v-for="condition in enumerations" :key="condition.enumId">
          <ion-checkbox :disabled="!!getDisabledReason(condition)" :checked="isConditionOptionSelected(condition.enumCode)" @ionChange="addConditionOption(condition)">
            <template v-if="getDisabledReason(condition)">
              <ion-label>{{ condition.description || condition.enumCode }}</ion-label>
              <ion-note>{{ getDisabledReason(condition) }}</ion-note>
            </template>
            <template v-else-if="condition.enumCode.includes('_excluded')">
              <ion-label>{{ condition.description || condition.enumCode }}</ion-label>
              <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
            </template>
            <template v-else>
              {{ condition.description || condition.enumCode }}
            </template>
          </ion-checkbox>
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
import { IonButton, IonButtons, IonCheckbox, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonNote, IonPage, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { useUtilStore } from "@/store/utilStore";
import { computed, onMounted, ref } from "vue";
import { saveOutline } from "ionicons/icons";
import { DateTime } from "luxon";
import { translate } from "@common";

const utilStore = useUtilStore();
const enums = computed(() => utilStore.getEnums)

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
  },
  filterOptions: {
    type: Object
  },
  sortOptions: {
    type: Object
  }
})
let inventoryRuleConditions = ref({}) as any
let enumerations = ref([]) as any
let areFiltersUpdated = ref(false)

// Added those enums here that needs to be hidden form the UI
const hiddenOptions = ["IIP_MSMNT_SYSTEM", "IIP_SPLIT_ITEM_GROUP"]

const cpcmLabel = "Use Carrier Postal Code Mapping"

// Add entries for the enums those are dependent on another filter {enumId: { code, label }}
// Shipping zone and ground transit time come from the carrier postal code mapping, so they are only usable once useCpcm is added to the rule
const dependentOptions = {
  ISP_CUST_SEQ: { code: "facilityGroupId", label: "Facility group" },
  IFP_SHIPPING_ZONE: { code: "useCpcm", label: cpcmLabel },
  IFP_GROUND_TRANSIT_TIME: { code: "useCpcm", label: cpcmLabel },
  ISP_SHIPPING_ZONE: { code: "useCpcm", label: cpcmLabel },
  ISP_GROUND_TRANSIT_TIME: { code: "useCpcm", label: cpcmLabel }
} as any
// Options that must not be mixed on the same rule {enumId: [{ code, label, type }]}, type tells whether the conflicting code is a filter or a sort
// A rule either selects facilities by distance or by carrier postal code mapping, not both
const conflictingOptions = {
  IIP_PROXIMITY: [{ code: "useCpcm", label: cpcmLabel, type: "filter" }],
  ISP_PROXIMITY: [{ code: "useCpcm", label: cpcmLabel, type: "filter" }],
  IFP_USE_CPCM: [{ code: "distance", label: "Proximity filter", type: "filter" }, { code: "distance", label: "Proximity sort", type: "sort" }]
} as any
// managing this object, as we have some filters for which we need to have its associated filter, like in this case when we have PROXIMITY we also need to add MEASUREMENT_SYSTEM(this is not available on UI for selection and included in hiddenOptions)
const associatedOptions = { IIP_PROXIMITY: { enum: "IIP_MSMNT_SYSTEM", defaultValue: "IMPERIAL" }} as any
// This is a presence-based override: selecting it always means bypass the facility order limit.
// Removing the condition restores the normal limit check.
// useCpcm is also presence-based, the backend only enables the mapping when the value is "true".
const fixedConditionValues = { IFP_IGNORE_ORD_FAC_LIMIT: "Y", IFP_USE_CPCM: "true" } as Record<string, string>
// Operator to preselect when adding a new comparison condition
const defaultOperators = { IFP_SHIPPING_ZONE: "equals", IFP_GROUND_TRANSIT_TIME: "less-equals" } as Record<string, string>

const isFilterModal = computed(() => props.conditionTypeEnumId === "ENTCT_FILTER")

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

  if (!areFiltersUpdated.value) {
    areFiltersUpdated.value = enumerations.value.some((condition: any) => {
      if (!fixedConditionValues[condition.enumId]) return false;
      return props.ruleConditions?.[condition.enumCode]?.fieldValue !== inventoryRuleConditions.value[condition.enumCode]?.fieldValue;
    })
  }
}

function addConditionOption(condition: any) {
  const isConditionOptionAlreadyApplied = Boolean(isConditionOptionSelected(condition.enumCode))
  const associatedEnum = enums.value[props.parentEnumId][associatedOptions[condition.enumId]?.enum]
  if(isConditionOptionAlreadyApplied) {
    delete inventoryRuleConditions.value[condition.enumCode]
    // When removing a condition, also remove its associated option if available
    associatedEnum && delete inventoryRuleConditions.value[associatedEnum.enumCode]
    // Also remove the filters that are only applicable along with the removed filter
    if(isFilterModal.value) {
      enumerations.value
        .filter((option: any) => dependentOptions[option.enumId]?.code === condition.enumCode)
        .forEach((option: any) => delete inventoryRuleConditions.value[option.enumCode])
    }
  } else {
    // checking unchecking an option and then checking it again, we need to use the same values
    if(props.ruleConditions?.[condition.enumCode]) {
      inventoryRuleConditions.value[condition.enumCode] = {
        ...props.ruleConditions[condition.enumCode],
        ...(fixedConditionValues[condition.enumId] ? { fieldValue: fixedConditionValues[condition.enumId] } : {})
      }
      associatedEnum && (inventoryRuleConditions.value[associatedEnum.enumCode] = props.ruleConditions[associatedEnum.enumCode])
    } else {
      // when adding a new value, we don't need to pass conditionSeqId
      // Added check that whether the filters for the conditionType exists or not, if not then create a new value for conditionType
      inventoryRuleConditions.value[condition.enumCode] = {
        routingRuleId: props.routingRuleId,
        conditionTypeEnumId: props.conditionTypeEnumId,
        fieldName: condition.enumCode,
        sequenceNum: Object.keys(inventoryRuleConditions.value).length && inventoryRuleConditions.value[Object.keys(inventoryRuleConditions.value)[Object.keys(inventoryRuleConditions.value).length - 1]]?.sequenceNum >= 0 ? inventoryRuleConditions.value[Object.keys(inventoryRuleConditions.value)[Object.keys(inventoryRuleConditions.value).length - 1]].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0 which will result in again setting the new seqNum to 0
        createdDate: DateTime.now().toMillis(),
        operator: condition.enumCode.includes("_excluded") ? "not-equals" : fixedConditionValues[condition.enumId] ? "equals" : defaultOperators[condition.enumId] || "",
        ...(fixedConditionValues[condition.enumId] ? { fieldValue: fixedConditionValues[condition.enumId] } : {})
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
  const condition = inventoryRuleConditions.value?.[code]
  const enumeration = enumerations.value.find((option: any) => option.enumCode === code)
  if (!fixedConditionValues[enumeration?.enumId]) return condition

  return [true, "Y", "true"].includes(condition?.fieldValue)
}

function closeModal(action = "close") {
  modalController.dismiss({ dismissed: true, filters: inventoryRuleConditions.value }, action)
}

// Filters/sorts being edited in this modal are read from the local state, the other type from the rule
function isRuleOptionApplied(code: string, type: "filter" | "sort") {
  const options = (type === "filter") === isFilterModal.value ? inventoryRuleConditions.value : type === "filter" ? props.filterOptions : props.sortOptions
  const condition = options?.[code]
  return Boolean(condition) && ![false, "N", "false"].includes(condition.fieldValue)
}

// Returns the reason for which the option can't be selected, an already selected option is never disabled so that it can be removed
function getDisabledReason(condition: any) {
  if(isConditionOptionSelected(condition.enumCode)) return ""

  // Added check on code as we only have code once a filter is selected
  const dependentOption = dependentOptions[condition.enumId]
  if(dependentOption && !isRuleOptionApplied(dependentOption.code, "filter")) {
    return translate("Only applicable when {label} is selected", { label: translate(dependentOption.label) })
  }

  const conflictingOption = conflictingOptions[condition.enumId]?.find((option: any) => isRuleOptionApplied(option.code, option.type))
  if(conflictingOption) {
    return translate("Not applicable when {label} is selected", { label: translate(conflictingOption.label) })
  }

  return ""
}
</script>
