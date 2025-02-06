<template>
  <ion-menu menu-id="rule-details" content-id="main-content" @ionWillOpen="initializeInventoryRule()">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-toggle menu="rule-details">
            <ion-button>
              <ion-icon slot="icon-only" :icon="arrowBackOutline" />
            </ion-button>
          </ion-menu-toggle>
        </ion-buttons>
        <ion-title>{{ translate("Rule details") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <main>
        <ion-card class="rule-info">
          <ion-item lines="none">
            <ion-label>
              <p>{{ getRuleIndex() }}</p>
              <h1>{{ rule.ruleName }}</h1>
            </ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-icon slot="start" :icon="bookmarkOutline" />
            <ion-label>{{ translate("Status") }}</ion-label>
            <ion-label slot="end">{{ getStatusDesc(rule.statusId) }}</ion-label>
          </ion-item>
        </ion-card>
        <section class="filters">
          <ion-card>
            <ion-item>
              <ion-icon slot="start" :icon="filterOutline"/>
              <h4>{{ translate("Filters") }}</h4>
            </ion-item>
            <p class="empty-state" v-if="!isInventoryRuleFiltersApplied()">
              {{ translate("All facilities enabled for online fulfillment will be attempted for brokering if no filter is applied.") }}<br /><br />
              <span><a target="_blank" rel="noopener noreferrer" href="https://docs.hotwax.co/documents/v/system-admins/administration/facilities/configure-fulfillment-capacity">{{ translate("Learn more") }}</a>{{ translate(" about enabling a facility for online fulfillment.") }}</span>
            </p>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP')">
              <ion-label>{{ translate("Group") }}</ion-label>
              <ion-label slot="end">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP').fieldValue }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED')">
              <ion-label>
                <ion-label>{{ translate("Group") }}</ion-label>
                <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
              </ion-label>
              <ion-label slot="end">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'PROXIMITY')">
              <ion-label>{{ translate("Proximity") }}</ion-label>
              <ion-label slot="end">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue : "-" }} {{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "MEASUREMENT_SYSTEM").fieldValue ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "MEASUREMENT_SYSTEM").fieldValue : "" }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'BRK_SAFETY_STOCK')">
              <ion-label>{{ translate("Brokering safety stock") }}</ion-label>
              <ion-label slot="end">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue : "-" }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_ORDER_LIMIT')">
              <!-- TODO: for now not changing the UI for this filter, as we need discuss what to display like enabled/disabled, true/false etc-->
              <ion-toggle :checked="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_ORDER_LIMIT').fieldValue === 'Y'" disabled>
                {{ translate("Turn of the facility order limit check") }}
              </ion-toggle>
            </ion-item>
          </ion-card>
          <ion-card>
            <ion-item>
              <ion-icon slot="start" :icon="swapVerticalOutline"/>
              <h4>{{ translate("Sort") }}</h4>
            </ion-item>
            <p class="empty-state" v-if="!inventoryRuleSortOptions || !Object.keys(inventoryRuleSortOptions)?.length">
              {{ translate("Facilities will be sorted based on creation date if no sorting preferences are applied.") }}
            </p>
            <ion-item v-for="(sort, code) in inventoryRuleSortOptions" :key="code">
              <ion-label>{{ getLabel("INV_SORT_PARAM_TYPE", code) || code }}</ion-label>
            </ion-item>
          </ion-card>
        </section>
        <section>
          <h2 class="ion-padding-start">{{ translate("Actions") }}</h2>
          <div class="actions">
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  {{ translate("Partially available") }}
                </ion-card-title>
              </ion-card-header>
              <ion-card-content>
                {{ translate("Select if partial allocation should be allowed in this inventory rule") }}
              </ion-card-content>
              <ion-item lines="none">
                <ion-toggle disabled :checked="rule.assignmentEnumId === 'ORA_MULTI'">{{ translate("Allow partial allocation") }}</ion-toggle>
              </ion-item>
              <ion-item v-show="isPartialGroupItemsAllocationActive()" lines="none">
                <ion-label class="ion-text-wrap">
                  <p>{{ translate("Partial allocation cannot be disabled. Orders are filtered by item when filtering by promise date.") }}</p>
                </ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-toggle disabled :checked="isPartialGroupItemsAllocationActive()">{{ translate("Partially allocate grouped items") }}</ion-toggle>
              </ion-item>
            </ion-card>
            <ion-card>
              <ion-card-header>
                <ion-card-title>
                  {{ translate("Unavailable items") }}
                </ion-card-title>
              </ion-card-header>
              <ion-item lines="none" v-if="actionEnums['NEXT_RULE'].id && actionEnums['MOVE_TO_QUEUE'].id">
                <ion-label>{{ translate("Move items to") }}</ion-label>
                <ion-label slot="end">{{ ruleActionType === actionEnums['MOVE_TO_QUEUE'].id ? translate("Queue") : translate("Next rule") }}</ion-label>
              </ion-item>
              <ion-item lines="none" v-show="ruleActionType === actionEnums['MOVE_TO_QUEUE'].id">
                <ion-label>{{ translate("Queue") }}</ion-label>
                <ion-label slot="end">{{ facilities[inventoryRuleActions[ruleActionType]?.actionValue]?.facilityName || inventoryRuleActions[ruleActionType]?.actionValue }}</ion-label>
              </ion-item>
              <ion-item lines="none">
                <ion-toggle disabled :checked="JSON.parse(inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue ? inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue : false)">{{ translate("Clear auto cancel days") }}</ion-toggle>
              </ion-item>
              <ion-item lines="none" v-show="!JSON.parse(inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue ? inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue : false)">
                <ion-label>{{ translate("Auto cancel days") }}</ion-label>
                <ion-label slot="end">{{ inventoryRuleActions[actionEnums["AUTO_CANCEL_DAYS"].id]?.actionValue ?? "-" }} {{ "days" }}</ion-label>
              </ion-item>
            </ion-card>
          </div>
        </section>
      </main>
    </ion-content>
  </ion-menu>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import store from "@/store";
import { IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonMenu, IonMenuToggle, IonNote, IonTitle, IonToggle, IonToolbar, modalController } from "@ionic/vue";
import { arrowBackOutline, bookmarkOutline, filterOutline, golfOutline, playForwardOutline, pulseOutline, swapVerticalOutline, timeOutline } from "ionicons/icons"
import { computed, defineProps, onMounted, ref } from "vue"
import RoutingHistoryModal from "./RoutingHistoryModal.vue";
import { getDateAndTimeShort } from "@/utils";

const props = defineProps({
  group: {
    type: Object,
    required: true
  },
  rule: {
    type: Object,
    required: true
  }
})

const ruleEnums = JSON.parse(process.env?.VUE_APP_RULE_ENUMS as string)
const actionEnums = JSON.parse(process.env?.VUE_APP_RULE_ACTION_ENUMS as string)
const conditionFilterEnums = JSON.parse(process.env?.VUE_APP_RULE_FILTER_ENUMS as string)
let inventoryRuleFilterOptions = ref({}) as any
let inventoryRuleSortOptions = ref({}) as any
let inventoryRuleActions = ref({}) as any
let ruleActionType = ref("")

const enums = computed(() => store.getters["util/getEnums"])
const facilities = computed(() => store.getters["util/getVirtualFacilities"])
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])
const facilityGroups = computed(() => store.getters["util/getFacilityGroups"])
const routingHistory = computed(() => store.getters["orderRouting/getRoutingHistory"])
const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))

function getRuleIndex() {
  if(!props.group?.routings?.length) {
    return;
  }

  const routingRuleId = props.rule.routingRuleId
  const routing = props.group?.routings?.find((routing: any) => routing.rules?.some((rule: any) => rule.routingRuleId === routingRuleId))

  if(routing) {
    const total = routing.rules?.length
    const currentRuleIndex: any = Object.keys(routing.rules).find((key: any) => routing.rules[key].routingRuleId == props.rule.routingRuleId)
  
    // adding one (1) as currentRuleIndex will have the index based on array, and used + as currentRuleIndex is a string
    return `${+currentRuleIndex + 1}/${total}`
  }
}

function getLabel(parentType: string, code: string) {
  const enumerations = enums.value[parentType]
  const enumInfo: any = enumerations ? Object.values(enumerations).find((enumeration: any) => enumeration.enumCode === code) : null

  return enumInfo?.description
}

function getFilterValue(options: any, enums: any, parameter: string) {
  return enums[parameter] ? options?.[enums[parameter].code] : undefined
}

function getSelectedValue(options: any, enumerations: any, parameter: string) {
  let value = options?.[enumerations[parameter].code].fieldValue

  // Initially when adding a filter no value is selected thus returning empty string
  if(!value) {
    return "";
  }

  value = value?.split(',')

  // If having more than 1 value selected then displaying the count of selected value otherwise returning the facilityName of the selected facility
  if(value?.length > 1) {
    return `${value.length} ${translate("selected")}`
  } else {
    return parameter === "SHIPPING_METHOD" || parameter === "SHIPPING_METHOD_EXCLUDED" ? shippingMethods.value[value[0]]?.description || value[0] : parameter === "SALES_CHANNEL" || parameter === "SALES_CHANNEL_EXCLUDED" ? enums.value["ORDER_SALES_CHANNEL"] ? enums.value["ORDER_SALES_CHANNEL"][value[0]]?.description : value[0] : parameter === "ORIGIN_FACILITY_GROUP" || parameter === "ORIGIN_FACILITY_GROUP_EXCLUDED" ? facilityGroups.value[value[0]]?.facilityGroupName || value[0] : facilities.value[value[0]]?.facilityName || value[0]
  }
}

async function initializeInventoryRule() {
  const rule = props.rule
  const inventoryRuleFilters = rule["inventoryFilters"] ? rule["inventoryFilters"] : {}

  inventoryRuleActions.value = rule["actions"] || {}
  inventoryRuleFilterOptions.value = inventoryRuleFilters["ENTCT_FILTER"] ? inventoryRuleFilters["ENTCT_FILTER"] : {}
  inventoryRuleSortOptions.value = inventoryRuleFilters["ENTCT_SORT_BY"] ? inventoryRuleFilters["ENTCT_SORT_BY"] : {}

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(inventoryRuleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ""
}

function isInventoryRuleFiltersApplied() {
  const ruleFilters = inventoryRuleFilterOptions.value ? Object.keys(inventoryRuleFilterOptions.value).filter((rule: string) => rule !== conditionFilterEnums["SPLIT_ITEM_GROUP"].code) : [];
  return ruleFilters?.length
}

function isPartialGroupItemsAllocationActive() {
  return inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code]?.fieldValue === 'Y';
}
</script>

<style scoped>
ion-menu {
  --width: 60%;
}

.filters {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  align-items: start;
}

.actions {
  max-width: 50%;
}

.rule-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
  gap: var(--spacer-xs)
}

.menu {
  border-right: 1px solid var(--ion-color-medium);
}

.empty-state {
  text-align: center;
  margin: 0;
}
</style>