<template>
  <ion-page>
    <ion-content>
      <div>
        <div class="menu">
          <ion-item lines="none">
            <ion-label>{{ currentRouting.routingName }}</ion-label>
            <ion-chip slot="end" outline @click="router.go(-1)">
              <!-- TODO: make route index and count dynamic -->
              {{ "2/4" }}
              <ion-icon :icon="chevronUpOutline" />
            </ion-chip>
          </ion-item>
          <ion-button expand="block" @click="save">{{ "Save Changes" }}</ion-button>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ "Filters" }}</ion-label>
              <ion-button fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item-divider>
            <p class="empty-state" v-if="!orderRoutingFilters['ENTCT_FILTER'] || !Object.keys(orderRoutingFilters['ENTCT_FILTER']).length">{{ "Select filter to apply" }}</p>
            <!-- Using hardcoded options for filters, as in filters we have multiple ways of value selection for filters like select, chip -->
            <ion-item v-if="getFilterValue(orderRoutingFilters, ruleEnums, 'QUEUE')">
              <ion-select label="Queue" interface="popover" :value="getFilterValue(orderRoutingFilters, ruleEnums, 'QUEUE').fieldValue" @ionChange="updateOrderFilterValue($event, 'ENTCT_FILTER', 'QUEUE')">
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilters, ruleEnums, 'SHIPPING_METHOD')">
              <ion-select interface="popover" label="Shipping method" :value="getFilterValue(orderRoutingFilters, ruleEnums, 'SHIPPING_METHOD').fieldValue" @ionChange="updateOrderFilterValue($event, 'ENTCT_FILTER', 'SHIPPING_METHOD')">
                <ion-select-option value="Next Day">{{ "Next Day" }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilters, ruleEnums, 'PRIORITY')">
              <ion-select interface="popover" label="Order priority" :value="getFilterValue(orderRoutingFilters, ruleEnums, 'PRIORITY').fieldValue" @ionChange="updateOrderFilterValue($event, 'ENTCT_FILTER', 'PRIORITY')">
                <ion-select-option value="HIGH">{{ "High" }}</ion-select-option>
                <ion-select-option value="MEDIUM">{{ "Medium" }}</ion-select-option>
                <ion-select-option value="Low">{{ "Low" }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilters, ruleEnums, 'PROMISE_DATE')">
              <ion-label>{{ "Promise date" }}</ion-label>
              <ion-chip @click="selectPromiseFilterValue($event)">
                <!-- TODO: need to display a string in place of just the value -->
                {{ getFilterValue(orderRoutingFilters, ruleEnums, 'PROMISE_DATE').fieldValue || getFilterValue(orderRoutingFilters, ruleEnums, 'PROMISE_DATE').fieldValue == 0 ? getFilterValue(orderRoutingFilters, ruleEnums, 'PROMISE_DATE').fieldValue : '-' }}
              </ion-chip>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilters, ruleEnums, 'SALES_CHANNEL')">
              <ion-select label="Sales Channel" interface="popover" :value="getFilterValue(orderRoutingFilters, ruleEnums, 'SALES_CHANNEL').fieldValue" @ionChange="updateOrderFilterValue($event, 'ENTCT_FILTER', 'SALES_CHANNEL')">
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-item-group>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ "Sort" }}</ion-label>
              <ion-button fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item-divider>
            <!-- Added check for undefined as well as empty object, as on initial load there might be a case in which route sorting options are not available thus it will be undefined but when updating the values from the modal this will always return an object -->
            <p class="empty-state" v-if="!orderRoutingFilters['ENTCT_SORT_BY'] || !Object.keys(orderRoutingFilters['ENTCT_SORT_BY']).length">{{ "Select sorting to apply" }}</p>
            <ion-reorder-group @ionItemReorder="doRouteSortReorder($event)" :disabled="false">
              <ion-item v-for="(sort, code) in orderRoutingFilters['ENTCT_SORT_BY']" :key="code">
                <ion-label>{{ getLabel("ORD_SORT_PARAM_TYPE", code) || code }}</ion-label>
                <ion-reorder />
              </ion-item>
            </ion-reorder-group>
          </ion-item-group>
        </div>
        <div class="menu">
          <ion-list>
            <ion-reorder-group :disabled="false">
              <ion-item v-for="rule in routingRules" :key="rule.routingRuleId && routingRules.length" @click="fetchRuleInformation(rule.routingRuleId)" button>
                <ion-label>{{ rule.ruleName }}</ion-label>
                <!-- Don't display reordering option when there is a single rule -->
                <ion-reorder v-show="routingRules.length > 1" />
              </ion-item>
            </ion-reorder-group>
          </ion-list>
          <ion-button fill="outline" @click="addInventoryRule">
            {{ "Add inventory rule" }}
            <ion-icon :icon="addCircleOutline"/>
          </ion-button>
        </div>
        <div>
          <section class="filters">
            <ion-card>
              <ion-item>
                <ion-icon slot="start" :icon="filterOutline"/>
                <ion-label>{{ "Filters" }}</ion-label>
                <ion-button fill="clear" @click="addInventoryFilterOptions('INV_FILTER_PRM_TYPE', 'ENTCT_FILTER')">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
                </ion-button>
              </ion-item>
              <p class="empty-state" v-if="!inventoryRuleConditions['ENTCT_FILTER'] || !Object.keys(inventoryRuleConditions['ENTCT_FILTER']).length">{{ "Select filter to apply" }}</p>
              <ion-item v-if="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'FACILITY_GROUP')">
                <ion-select label="Group" :value="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'FACILITY_GROUP')" @ionChange="updateRuleFilterValue($event, 'ENTCT_FILTER', 'FACILITY_GROUP')">
                  <ion-select-option value="East coast stores">{{ "East coast stores" }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item v-if="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'PROXIMITY')">
                <ion-select label="Proximity" :value="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'PROXIMITY')">
                  <!-- TODO: add support to select measurement system, by default its in miles -->
                  <!-- TODO: Confirm on the possible options -->
                  <ion-select-option value="Zone 1">{{ "Zone 1" }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item v-if="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK')">
                <ion-label>{{ "Brokering safety stock" }}</ion-label>
                <!-- TODO: add support to select operator -->
                <ion-chip @click="selectSafetyStock()">{{ getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK').fieldValue || getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK').fieldValue == 0 ? getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK').fieldValue : '-' }}</ion-chip>
              </ion-item>
            </ion-card>
            <ion-card>
              <ion-item>
                <ion-icon slot="start" :icon="swapVerticalOutline"/>
                <ion-label>{{ "Sort" }}</ion-label>
                <ion-button fill="clear" @click="addInventoryFilterOptions('INV_SORT_PARAM_TYPE', 'ENTCT_SORT_BY')">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
                </ion-button>
              </ion-item>
              <p class="empty-state" v-if="!inventoryRuleConditions['ENTCT_SORT_BY'] || !Object.keys(inventoryRuleConditions['ENTCT_SORT_BY']).length">{{ "Select sorting to apply" }}</p>
              <ion-reorder-group :disabled="false">
                <ion-item v-for="(sort, code) in inventoryRuleConditions['ENTCT_SORT_BY']" :key="code">
                  <ion-label>{{ getLabel("INV_SORT_PARAM_TYPE", code) || code }}</ion-label>
                  <ion-reorder />
                </ion-item>
              </ion-reorder-group>
            </ion-card>
          </section>
          <section>
            <h2 class="ion-padding-start">{{ "Actions" }}</h2>
            <div class="actions">
              <ion-card>
                <ion-card-header>
                  <ion-card-title>
                    {{ "Allocated Items" }}
                  </ion-card-title>
                </ion-card-header>
                <ion-item lines="none">
                  <ion-toggle>{{ "Clear auto cancel days" }}</ion-toggle>
                </ion-item>
              </ion-card>
              <ion-card>
                <ion-card-header>
                  <ion-card-title>
                    {{ "Partially available" }}
                  </ion-card-title>
                </ion-card-header>
                <ion-card-content>
                  {{ "Select if partial allocation should be allowed in this inventory rule" }}
                </ion-card-content>
                <ion-item lines="none">
                  <ion-toggle :checked="selectedRoutingRule.assignmentEnumId === 'ORA_MULTI'" @ionChange="updatePartialAllocation($event.detail.checked)">{{ "Allow partial allocation" }}</ion-toggle>
                </ion-item>
              </ion-card>
              <ion-card>
                <ion-card-header>
                  <ion-card-title>
                    {{ "Unavailable items" }}
                  </ion-card-title>
                </ion-card-header>
                <ion-item lines="none">
                  <ion-select label="Move items to" interface="popover" :value="ruleActionType" @ionChange="updateRuleActionType($event.detail.value)">
                    <ion-select-option :value="actionEnums['NEXT_RULE'].id">
                      {{ "Next rule" }}
                      <ion-icon :icon="playForwardOutline"/>
                    </ion-select-option>
                    <ion-select-option :value="actionEnums['MOVE_TO_QUEUE'].id">
                      {{ "Queue" }}
                      <ion-icon :icon="golfOutline"/>
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item lines="none" v-show="ruleActionType === actionEnums['MOVE_TO_QUEUE'].id">
                  <ion-select label="Queue" interface="popover" :value="ruleActions[ruleActionType]?.actionValue" @ionChange="updateRuleActionValue($event.detail.value)">
                    <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item lines="none">
                  <ion-label>{{ "Auto cancel days" }}</ion-label>
                  <ion-chip outline @click="updateAutoCancelDays(autoCancelDays)">{{ autoCancelDays }}{{ ' days' }}</ion-chip>
                </ion-item>
              </ion-card>
            </div>
          </section>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonToggle, alertController, modalController, onIonViewWillEnter, popoverController } from "@ionic/vue";
import { addCircleOutline, chevronUpOutline, filterOutline, golfOutline, optionsOutline, playForwardOutline, swapVerticalOutline } from "ionicons/icons"
import { useRouter } from "vue-router";
import { computed, defineProps, ref } from "vue";
import store from "@/store";
import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";
import { showToast } from "@/utils";
import { Rule } from "@/types";
import AddOrderRouteFilterOptions from "@/components/AddOrderRouteFilterOptions.vue"
import PromiseFilterPopover from "@/components/PromiseFilterPopover.vue"
import logger from "@/logger";

const router = useRouter();
const props = defineProps({
  orderRoutingId: {
    type: String,
    required: true
  }
})

const ruleEnums = JSON.parse(process.env?.VUE_APP_RULE_ENUMS as string)
const actionEnums = JSON.parse(process.env?.VUE_APP_RULE_ACTION_ENUMS as string)
const conditionFilterEnums = JSON.parse(process.env?.VUE_APP_RULE_FILTER_ENUMS as string)
const autoCancelDays = ref(0)
const ruleActionType = ref('')
let orderRoutingFilters = ref({}) as any
let selectedRoutingRule = ref({}) as any
let inventoryRuleConditions = ref({}) as any

const currentRouting = computed(() => store.getters["orderRouting/getCurrentOrderRouting"])
const routingRules = computed(() => store.getters["orderRouting/getRoutingRules"])
const routingFilters = computed(() => store.getters["orderRouting/getCurrentRouteFilters"])
const ruleActions = computed(() => store.getters["orderRouting/getRuleActions"])
const ruleConditions = computed(() => store.getters["orderRouting/getRuleConditions"])
const facilities = computed(() => store.getters["util/getFacilities"])
const enums = computed(() => store.getters["util/getEnums"])

onIonViewWillEnter(async () => {
  await Promise.all([store.dispatch("orderRouting/fetchCurrentOrderRouting", props.orderRoutingId), store.dispatch("orderRouting/fetchRoutingRules", props.orderRoutingId), store.dispatch("orderRouting/fetchRoutingFilters", props.orderRoutingId), store.dispatch("util/fetchFacilities"), store.dispatch("util/fetchEnums", { enumTypeId: "ORDER_SALES_CHANNEL" })])

  orderRoutingFilters.value = JSON.parse(JSON.stringify(routingFilters.value))

  // Added check to not fetch any rule related information as when a new route will be created no rule will be available thus no need to fetch any other information
  if(!routingRules.value.length) {
    return;
  }

  await fetchRuleInformation(routingRules.value[0].routingRuleId);
})

async function fetchRuleInformation(routingRuleId: string) {
  // When clicking the same enum again do not fetch its information
  // TODO: check behaviour when creating a new rule, when no rule exist and when already some rule exist and a rule is open
  if(selectedRoutingRule.value.routingRuleId === routingRuleId) {
    return;
  }

  selectedRoutingRule.value = routingRules.value.find((rule: Rule) => rule.routingRuleId === routingRuleId)
  await Promise.all([store.dispatch("orderRouting/fetchRuleConditions", routingRuleId), store.dispatch("orderRouting/fetchRuleActions", routingRuleId)])

  inventoryRuleConditions.value = JSON.parse(JSON.stringify(ruleConditions.value))
  autoCancelDays.value = ruleActions.value[actionEnums['AUTO_CANCEL_DAYS'].id]?.actionValue

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(ruleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ''
}

async function addInventoryFilterOptions(parentEnumId: string, conditionTypeEnumId: string) {
  if(!selectedRoutingRule.value.routingRuleId) {
    // TODO: check if we can show a toast here
    logger.error('Failed to identify selected inventory rule, please select a rule or refresh')
    return;
  }
  
  const inventoryFilterOptionsModal = await modalController.create({
    component: AddInventoryFilterOptionsModal,
    componentProps: { ruleConditions: inventoryRuleConditions.value, routingRuleId: selectedRoutingRule.value.routingRuleId, parentEnumId, conditionTypeEnumId }
  })

  inventoryFilterOptionsModal.onDidDismiss().then((result: any) => {
    // Using role to determine when to update the filters
    // When closing the modal without save and when unselecting all the filter, in both the cases we get filters object as empty thus passing a role from the modal to update the filter only when save action is performed
    if(result.data?.filters && result.role === 'save') {
      inventoryRuleConditions.value = result.data.filters
    }
  })

  await inventoryFilterOptionsModal.present();
}

async function addOrderRouteFilterOptions(parentEnumId: string, conditionTypeEnumId: string) {
  const orderRouteFilterOptions = await modalController.create({
    component: AddOrderRouteFilterOptions,
    componentProps: { orderRoutingFilters: orderRoutingFilters.value, orderRoutingId: props.orderRoutingId, parentEnumId, conditionTypeEnumId }
  })

  orderRouteFilterOptions.onDidDismiss().then((result: any) => {
    // Using role to determine when to update the filters
    // When closing the modal without save and when unselecting all the filter, in both the cases we get filters object as empty thus passing a role from the modal to update the filter only when save action is performed
    if(result.data?.filters && result.role === 'save') {
      orderRoutingFilters.value = result.data.filters
    }
  })

  await orderRouteFilterOptions.present();
}

async function addInventoryRule() {
  const newRuleAlert = await alertController.create({
    header: "New Inventory Rule",
    buttons: [{
      text: "Cancel",
      role: "cancel"
    }, {
      text: "Save"
    }],
    inputs: [{
      name: "ruleName",
      placeholder: "Rule name"
    }]
  })

  newRuleAlert.onDidDismiss().then(async (result: any) => {
    const ruleName = result.data?.values?.ruleName;
    // Considering that when having role in result, its negative action and not need to do anything
    if(!result.role && ruleName) {
      // TODO: check for the default value of params
      const payload = {
        routingRuleId: "",
        orderRoutingId: props.orderRoutingId,
        ruleName,
        statusId: "RULE_DRAFT", // by default considering the rule to be in draft
        sequenceNum: routingRules.value.length && routingRules.value[routingRules.value.length - 1].sequenceNum >= 0 ? routingRules.value[routingRules.value.length - 1].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0, that will result in again setting the new route seqNum to 0,
        assignmentEnumId: "ORA_SINGLE", // by default, considering partial fulfillment to be inactive
        fulfillEntireShipGroup: "N",  // TODO: check for default value
      }

      const resp = await store.dispatch("orderRouting/createRoutingRule", payload)
      if(resp.routingRuleId) {
        fetchRuleInformation(resp.routingRuleId)
      }
    }
  })

  return newRuleAlert.present();
}

function updateRuleActionType(value: string) {
  const actionType = ruleActionType.value
  ruleActionType.value = value

  ruleActions.value[ruleActionType.value] = {
    ...ruleActions.value[actionType],
    actionTypeEnumId: value,
    actionValue: '' // after changing action type, as next_rule action does not need to have a value, so in all cases making intially the value as empty and will update if required from some other function
  }
  // deleting previous action type, but using the data of previous action, as we will not call delete action on server for actionTypes
  delete ruleActions.value[actionType]
}

function updateRuleActionValue(value: string) {
  ruleActions.value[ruleActionType.value]["actionValue"] = value
}

async function updateAutoCancelDays(cancelDays: any) {
  const alert = await alertController.create({
    header: "Auto Cancel Days",
    inputs: [{
      name: "autoCancelDays",
      placeholder: "auto cancel days",
      type: "number",
      min: 0,
      value: cancelDays
    }],
    buttons: [{
      text: "Cancel",
      role: "cancel"
    },
    {
      text: "Save",
      handler: (data) => {
        if(data) {
          if(data.autoCancelDays === '') {
            showToast("Please provide a value")
            return false;
          } else if(data.autoCancelDays < 0) {
            showToast("Provide a value greater than or equal to 0")
            return false;
          } else {
            autoCancelDays.value = data.autoCancelDays
            ruleActions.value[actionEnums['AUTO_CANCEL_DAYS'].id].actionValue = data.autoCancelDays
          }
        }
      }
    }]
  })
  await alert.present()
}

function updatePartialAllocation(checked: any) {
  selectedRoutingRule.value.assignmentEnumId = checked ? "ORA_MULTI" : "ORA_SINGLE"
}

function getFilterValue(options: any, enums: any, parameter: string) {
  // TODO: Only show filters when a value is associated
  return options['ENTCT_FILTER']?.[enums[parameter].code]
}

function getLabel(parentType: string, code: string) {
  const enumerations = enums.value[parentType]
  const enumInfo: any = Object.values(enumerations).find((enumeration: any) => enumeration.enumCode === code)

  return enumInfo?.description
}

async function selectPromiseFilterValue(ev: CustomEvent) {
  const popover = await popoverController
    .create({
      component: PromiseFilterPopover,
      event: ev,
      translucent: true,
      showBackdrop: true
    })

  popover.onDidDismiss().then((result: any) => {
    getFilterValue(orderRoutingFilters.value, ruleEnums, "PROMISE_DATE").fieldValue = result.data?.isPastDuration ? `-${result.data?.duration}` : result.data?.duration
    getFilterValue(orderRoutingFilters.value, ruleEnums, "PROMISE_DATE").operator = "less-equals"
  })

  return popover.present();
}

async function selectSafetyStock() {
  const safetyStockAlert = await alertController.create({
    header: "Add Brokering Safety Stock",
    buttons: [{
      text: "Cancel",
      role: "cancel"
    }, {
      text: "Save"
    }],
    inputs: [{
      name: "safetyStock",
      placeholder: "safety stock"
    }]
  })

  safetyStockAlert.onDidDismiss().then(async (result: any) => {
    const safetyStock = result.data?.values?.safetyStock;
    // Considering that when having role in result, its negative action and not need to do anything
    if(!result.role && safetyStock) {
      getFilterValue(inventoryRuleConditions.value, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue = safetyStock
      // TODO: make operator value dynamic
      getFilterValue(inventoryRuleConditions.value, conditionFilterEnums, "BRK_SAFETY_STOCK").operator = "equals"
    }
  })

  return safetyStockAlert.present();
}

function updateOrderFilterValue(event: CustomEvent, conditionTypeEnumId: string, id: string) {
  orderRoutingFilters.value[conditionTypeEnumId][ruleEnums[id].code].fieldValue = event.detail.value
}

function updateRuleFilterValue(event: CustomEvent, conditionTypeEnumId: string, id: string) {
  inventoryRuleConditions.value[conditionTypeEnumId][conditionFilterEnums[id].code].fieldValue = event.detail.value
}

function doRouteSortReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(Object.values(orderRoutingFilters.value["ENTCT_SORT_BY"])))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(Object.values(orderRoutingFilters.value["ENTCT_SORT_BY"]))));

  const updatedSeqenceNum = Object.keys(previousSeq).map((filter: any) => previousSeq[filter].sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  orderRoutingFilters.value["ENTCT_SORT_BY"] = updatedSeq.reduce((filters: any, filter: any) => {
    filters[filter.fieldName] = filter
    return filters
  }, {})
}

// checks whether values for all the properties of two objects are same
function isObjectUpdated(initialObj: any, finalObj: any) {
  return !Object.keys(initialObj).every((key: string) => finalObj[key] === initialObj[key]) || Object.keys(initialObj).length !== Object.keys(finalObj).length
}

async function save() {
  const valueRequiredForRouteFilter = "ENTCT_FILTER"
  const filtersToUpdate = [] as any, filtersToRemove = [] as any, filtersToCreate = [] as any
  const orderRouteFilterTypes = Object.keys(enums.value["CONDITION_TYPE"])

  orderRouteFilterTypes.map((filterType: string) => {
    if(orderRoutingFilters.value[filterType]) {
      Object.keys(orderRoutingFilters.value[filterType]).map((key: string) => {
        if(routingFilters.value[filterType]?.[key]) {
          const isSeqChanged = isObjectUpdated(routingFilters.value[filterType][key], orderRoutingFilters.value[filterType]?.[key])
          if(isSeqChanged) {
            // Expanding object, as when the filter which is updated needs to use the values from original object, but if there is some change in the latest object(like seqNum due to reordering) then needs to override it
            filtersToUpdate.push({
              ...routingFilters.value[filterType][key],
              ...orderRoutingFilters.value[filterType][key]
            })
          }
        } else {
          // Added check for 0, as when applying promiseDate filter the value can be zero
          if(filterType === valueRequiredForRouteFilter && (orderRoutingFilters.value[filterType][key]?.["fieldValue"] || orderRoutingFilters.value[filterType][key]?.["fieldValue"] == 0)) {
            filtersToCreate.push(orderRoutingFilters.value[filterType][key])
          } else if(filterType !== valueRequiredForRouteFilter) {
            filtersToCreate.push(orderRoutingFilters.value[filterType][key])
          }
        }
      })
    }

    if(routingFilters.value[filterType]) {
      Object.keys(routingFilters.value[filterType]).map((key: string) => {
        if(!orderRoutingFilters.value[filterType]?.[key]) {
          filtersToRemove.push(routingFilters.value[filterType][key])
        }
      })
    }
  })

  const conditionsToUpdate = [] as any, conditionsToRemove = [] as any, conditionsToCreate = [] as any
  // const orderRouteFilterTypes = Object.keys(enums.value["CONDITION_TYPE"])

  orderRouteFilterTypes.map((filterType: string) => {
    if(inventoryRuleConditions.value[filterType]) {
      Object.keys(inventoryRuleConditions.value[filterType]).map((key: string) => {
        if(ruleConditions.value[filterType]?.[key]) {
          const isSeqChanged = isObjectUpdated(ruleConditions.value[filterType][key], inventoryRuleConditions.value[filterType]?.[key])
          if(isSeqChanged) {
            // Expanding object, as when the filter which is updated needs to use the values from original object, but if there is some change in the latest object(like seqNum due to reordering) then needs to override it
            conditionsToUpdate.push({
              ...ruleConditions.value[filterType][key],
              ...inventoryRuleConditions.value[filterType][key]
            })
          }
        } else {
          // Added check for 0, as when applying safetyStock filter the value can be zero
          if(filterType === valueRequiredForRouteFilter && (inventoryRuleConditions.value[filterType][key]?.["fieldValue"] || inventoryRuleConditions.value[filterType][key]?.["fieldValue"] == 0)) {
            conditionsToCreate.push(inventoryRuleConditions.value[filterType][key])
          } else if(filterType !== valueRequiredForRouteFilter) {
            conditionsToCreate.push(inventoryRuleConditions.value[filterType][key])
          }
        }
      })
    }

    if(ruleConditions.value[filterType]) {
      Object.keys(ruleConditions.value[filterType]).map((key: string) => {
        if(!inventoryRuleConditions.value[filterType]?.[key]) {
          conditionsToRemove.push(ruleConditions.value[filterType][key])
        }
      })
    }
  })

  // TODO: add support to update filters

  if(filtersToCreate.length) {
    await store.dispatch("orderRouting/createRoutingFilters", { filters: filtersToCreate, orderRoutingId: props.orderRoutingId })
  }

  if(filtersToRemove.length) {
    await store.dispatch("orderRouting/deleteRoutingFilters", { filters: filtersToRemove, orderRoutingId: props.orderRoutingId })
  }

  // TODO: add support to update conditions

  if(conditionsToCreate.length) {
    await store.dispatch("orderRouting/createRuleConditions", { conditions: conditionsToCreate, routingRuleId: selectedRoutingRule.value.routingRuleId })
  }

  if(conditionsToRemove.length) {
    await store.dispatch("orderRouting/deleteRuleConditions", { conditions: conditionsToRemove, routingRuleId: selectedRoutingRule.value.routingRuleId })
  }
}
</script>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(2, auto);
}

.actions {
  max-width: 50%;
}

ion-content > div {
  display: grid;
  grid-template-columns: 300px 300px 1fr;
  height: 100%;
}

ion-content > div > .menu {
  border-right: 1px solid #92949C;
  justify-content: center;
}
</style>
