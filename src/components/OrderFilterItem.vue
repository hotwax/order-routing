<template>
  <template v-if="getFilterValue(routing.filterConditions, ruleEnums, enumId)">
    <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, enumId).length <= 1">
      <ion-label>
        {{ translate(label) }}
        <ion-note v-if="enumId.includes('_EXCLUDED')" color="danger">{{ translate("Excluded") }}</ion-note>
      </ion-label>
      <ion-label slot="end" class="label-with-icon">
        {{ getSelectedValue(routing.filterConditions, ruleEnums, enumId).description }}
        <ion-icon v-if="unmatchedRoutingProperties[enumCode]" :icon="warningOutline" color="danger"></ion-icon>
      </ion-label>
    </ion-item>
    <ion-accordion-group v-else>
      <ion-accordion>
        <ion-item slot="header" lines="full">
          <ion-label>
            {{ translate(label) }}
            <ion-note v-if="enumId.includes('_EXCLUDED')" color="danger">{{ translate("Excluded") }}</ion-note>
          </ion-label>
          <ion-label slot="end" class="label-with-icon">
            {{ getSelectedValue(routing.filterConditions, ruleEnums, enumId).description }}
            <ion-icon v-if="unmatchedRoutingProperties[enumCode]" :icon="warningOutline" color="danger"></ion-icon>
          </ion-label>
        </ion-item>
        <div slot="content">
          <ion-item v-for="value in getSelectedValue(routing.filterConditions, ruleEnums, enumId).values" :key="value.key">
            <ion-label :color="unmatchedRoutingProperties[enumCode]?.includes(value.key) && 'danger'">{{ value.val }}</ion-label>
          </ion-item>
        </div>
      </ion-accordion>
    </ion-accordion-group>
  </template>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import { IonAccordion, IonAccordionGroup, IonIcon, IonItem, IonLabel, IonNote } from "@ionic/vue";
import { computed, defineProps } from "vue";
import store from "@/store";
import { warningOutline } from "ionicons/icons"

const props = defineProps({
  routing: {
    type: Object,
    required: true
  },
  enumId: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  unmatchedRoutingProperties: {
    type: Object,
    required: true
  }
})

const ruleEnums = JSON.parse(process.env?.VUE_APP_RULE_ENUMS as string)

const enums = computed(() => store.getters["util/getEnums"])
const facilities = computed(() => store.getters["util/getVirtualFacilities"])
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])
const facilityGroups = computed(() => store.getters["util/getFacilityGroups"])

const enumCode = props.enumId.includes("_EXCLUDED") ? props.code + "_excluded" : props.code
const orderPriorityDescription: any = {
  "HIGH": "High",
  "MEDIUM": "Medium",
  "LOW": "Low"
}

function getFilterValue(options: any, enums: any, parameter: string) {
  return enums[parameter] ? options?.[enums[parameter].code]?.fieldValue.split(",") : undefined
}

function getPromiseDateValue() {
  const value = props.routing.filterConditions?.[ruleEnums["PROMISE_DATE"].code]?.fieldValue
  if(value || value == 0) {
    return value == 0 ? translate("already passed") : value.startsWith("-") ? `${value.replace("-", "")} days passed` : `upcoming in ${value} days`
  }
  return translate("select range")
}

function getSelectedValue(options: any, enumerations: any, parameter: string): Record<'description' | 'values', string | Array<any>> {
  if(parameter.includes("PROMISE_DATE")) {
    return {
      description: getPromiseDateValue(),
      values: getPromiseDateValue()
    }
  }

  let values = options?.[enumerations[parameter].code].fieldValue

  // Initially when adding a filter no value is selected thus returning empty string
  if(!values) {
    return {
      description: "",
      values: ""
    };
  }

  values = values?.split(",")

  function getValueDescription() {
    if(parameter.includes("SHIPPING_METHOD")) {
      return values.map((value: string) => ({
        key: value,
        val: shippingMethods.value[value]?.description || value
      }))
    }

    if(parameter.includes("SALES_CHANNEL")) {
      return values.map((value: string) => ({
        key: value,
        val: enums.value["ORDER_SALES_CHANNEL"]?.[value]?.description || value
      }))
    }

    if(parameter.includes("ORIGIN_FACILITY_GROUP")) {
      return values.map((value: string) => ({
        key: value,
        val: facilityGroups.value[value]?.facilityGroupName || value
      }))
    }

    if(parameter.includes("PRIORITY")) {
      return values.map((value: string) => ({
        key: value,
        val: orderPriorityDescription[value]
      }))
    }

    return values.map((value: string) => ({
      key: value,
      val: facilities.value[value]?.facilityName || value
    }))
  }

  // If having more than 1 value selected then displaying the count of selected value otherwise returning the facilityName of the selected facility
  if(values?.length > 1) {
    return {
      description: `${values.length} ${translate("selected")}`,
      values: getValueDescription()
    }
  } else {
    const values = getValueDescription()
    return {
      description: values[0].val,
      values
    }
  }
}

</script>