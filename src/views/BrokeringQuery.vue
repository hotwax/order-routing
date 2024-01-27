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
              <ion-button fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item-divider>
            <p class="empty-state" v-if="!orderRoutingFilterOptions || !Object.keys(orderRoutingFilterOptions).length">{{ "Select filter to apply" }}</p>
            <!-- Using hardcoded options for filters, as in filters we have multiple ways of value selection for filters like select, chip -->
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE')">
              <ion-select label="Queue" interface="popover" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE').fieldValue" @ionChange="updateOrderFilterValue($event, 'QUEUE')">
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD')">
              <ion-select interface="popover" label="Shipping method" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD').fieldValue" @ionChange="updateOrderFilterValue($event, 'SHIPPING_METHOD')">
                <ion-select-option v-for="(shippingMethod, shippingMethodId) in shippingMethods" :key="shippingMethodId" :value="shippingMethodId">{{ shippingMethod.shippingMethodId || shippingMethodId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY')">
              <ion-select interface="popover" label="Order priority" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY').fieldValue" @ionChange="updateOrderFilterValue($event, 'PRIORITY')">
                <ion-select-option value="HIGH">{{ "High" }}</ion-select-option>
                <ion-select-option value="MEDIUM">{{ "Medium" }}</ion-select-option>
                <ion-select-option value="Low">{{ "Low" }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE')">
              <ion-label>{{ "Promise date" }}</ion-label>
              <ion-chip outline @click="selectPromiseFilterValue($event)">
                <!-- TODO: need to display a string in place of just the value -->
                {{ getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE').fieldValue || getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE').fieldValue == 0 ? getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE').fieldValue : '-' }}
              </ion-chip>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL')">
              <ion-select label="Sales Channel" interface="popover" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL').fieldValue" @ionChange="updateOrderFilterValue($event, 'SALES_CHANNEL')">
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-item-group>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ "Sort" }}</ion-label>
              <ion-button fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item-divider>
            <!-- Added check for undefined as well as empty object, as on initial load there might be a case in which route sorting options are not available thus it will be undefined but when updating the values from the modal this will always return an object -->
            <p class="empty-state" v-if="!orderRoutingSortOptions || !Object.keys(orderRoutingSortOptions).length">{{ "Select sorting to apply" }}</p>
            <ion-reorder-group @ionItemReorder="doRouteSortReorder($event)" :disabled="false">
              <ion-item v-for="(sort, code) in orderRoutingSortOptions" :key="code">
                <ion-label>{{ getLabel("ORD_SORT_PARAM_TYPE", code) || code }}</ion-label>
                <ion-reorder />
              </ion-item>
            </ion-reorder-group>
          </ion-item-group>
        </div>
        <div class="menu">
          <ion-list>
            <ion-reorder-group @ionItemReorder="doReorder($event)" :disabled="false">
              <ion-item v-for="rule in inventoryRules" :key="rule.routingRuleId && inventoryRules.length" :color="rule.routingRuleId === selectedRoutingRule.routingRuleId ? 'light' : ''" @click="fetchRuleInformation(rule.routingRuleId)" button>
                <ion-label>{{ rule.ruleName }}</ion-label>
                <!-- Don't display reordering option when there is a single rule -->
                <ion-reorder v-show="inventoryRules.length > 1" />
              </ion-item>
            </ion-reorder-group>
          </ion-list>
          <ion-button fill="outline" @click="addInventoryRule">
            {{ "Add inventory rule" }}
            <ion-icon :icon="addCircleOutline"/>
          </ion-button>
        </div>
        <div>
          <ion-item lines="none">
            <!-- TODO: add support to archive a rule, add rule status Desc, and add color option -->
            <ion-label>{{ "Rule Status" }}</ion-label>
            <ion-badge v-if="selectedRoutingRule.statusId === 'RULE_DRAFT'" @click="updateRuleStatus(selectedRoutingRule.routingRuleId, 'RULE_ACTIVE')">{{ selectedRoutingRule.statusId }}</ion-badge>
            <ion-badge v-else>{{ selectedRoutingRule.statusId }}</ion-badge>
          </ion-item>
          <section class="filters">
            <ion-card>
              <ion-item>
                <ion-icon slot="start" :icon="filterOutline"/>
                <ion-label>{{ "Filters" }}</ion-label>
                <ion-button fill="clear" @click="addInventoryFilterOptions('INV_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
                </ion-button>
              </ion-item>
              <p class="empty-state" v-if="!inventoryRuleConditions['ENTCT_FILTER'] || !Object.keys(inventoryRuleConditions['ENTCT_FILTER']).length">{{ "Select filter to apply" }}</p>
              <ion-item v-if="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'FACILITY_GROUP')">
                <ion-select interface="popover" label="Group" :value="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'FACILITY_GROUP').fieldValue" @ionChange="updateRuleFilterValue($event, 'ENTCT_FILTER', 'FACILITY_GROUP')">
                  <ion-select-option v-for="(facilityGroup, facilityGroupId) in facilityGroups" :key="facilityGroupId" :value="facilityGroupId">{{ facilityGroup.description || facilityGroupId }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item v-if="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'PROXIMITY')">
                <!-- TODO: Confirm on the possible options -->
                <ion-label>{{ "Proximity" }}</ion-label>
                <ion-chip outline>
                  <ion-select aria-label="measurement" interface="popover" :value="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'MEASUREMENT_SYSTEM')?.fieldValue" @ionChange="updateRuleFilterValue($event, 'ENTCT_FILTER', 'MEASUREMENT_SYSTEM')">
                    <ion-select-option value="METRIC">{{ "kms" }}</ion-select-option>
                    <ion-select-option value="IMPERIAL">{{ "miles" }}</ion-select-option>
                  </ion-select>
                </ion-chip>
                <ion-chip outline @click="selectValue('PROXIMITY', 'Add proximity')">{{ getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'PROXIMITY').fieldValue || getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'PROXIMITY').fieldValue == 0 ? getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'PROXIMITY').fieldValue : '-' }}</ion-chip>
              </ion-item>
              <ion-item v-if="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK')">
                <ion-label>{{ "Brokering safety stock" }}</ion-label>
                <ion-chip outline>
                  <ion-select aria-label="operator" interface="popover" :value="getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK').operator" @ionChange="updateOperator($event)">
                    <ion-select-option v-for="(enumeration, id) in enums['COMPARISON_OPERATOR']" :key="id" :value="enumeration.enumCode">{{ enumeration.description || enumeration.enumCode }}</ion-select-option>
                  </ion-select>
                </ion-chip>
                <ion-chip outline @click="selectValue('BRK_SAFETY_STOCK', 'Add safety stock')">{{ getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK').fieldValue || getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK').fieldValue == 0 ? getFilterValue(inventoryRuleConditions, conditionFilterEnums, 'BRK_SAFETY_STOCK').fieldValue : '-' }}</ion-chip>
              </ion-item>
            </ion-card>
            <ion-card>
              <ion-item>
                <ion-icon slot="start" :icon="swapVerticalOutline"/>
                <ion-label>{{ "Sort" }}</ion-label>
                <ion-button fill="clear" @click="addInventoryFilterOptions('INV_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
                </ion-button>
              </ion-item>
              <p class="empty-state" v-if="!inventoryRuleConditions['ENTCT_SORT_BY'] || !Object.keys(inventoryRuleConditions['ENTCT_SORT_BY']).length">{{ "Select sorting to apply" }}</p>
              <ion-reorder-group @ionItemReorder="doConditionSortReorder($event)" :disabled="false">
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
                  <ion-chip outline @click="updateAutoCancelDays(autoCancelDays)">{{ autoCancelDays ? `${autoCancelDays} days` : '-' }}</ion-chip>
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
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonToggle, alertController, modalController, onIonViewWillEnter, popoverController } from "@ionic/vue";
import { addCircleOutline, chevronUpOutline, filterOutline, golfOutline, optionsOutline, playForwardOutline, swapVerticalOutline } from "ionicons/icons"
import { useRouter } from "vue-router";
import { computed, defineProps, ref } from "vue";
import store from "@/store";
import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";
import { showToast, sortSequence } from "@/utils";
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

let orderRoutingFilterOptions = ref({}) as any
let orderRoutingSortOptions = ref({}) as any


let selectedRoutingRule = ref({}) as any
let inventoryRuleConditions = ref({}) as any
let inventoryRules = ref([]) as any

const currentRouting = computed(() => store.getters["orderRouting/getCurrentOrderRouting"])

const routingRules = computed(() => store.getters["orderRouting/getRoutingRules"])
const ruleActions = computed(() => store.getters["orderRouting/getRuleActions"])
const ruleConditions = computed(() => store.getters["orderRouting/getRuleConditions"])
const facilities = computed(() => store.getters["util/getFacilities"])
const enums = computed(() => store.getters["util/getEnums"])
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])
const facilityGroups = computed(() => store.getters["util/getFacilityGroups"])

onIonViewWillEnter(async () => {
  await Promise.all([store.dispatch("orderRouting/fetchCurrentOrderRouting", props.orderRoutingId), store.dispatch("orderRouting/fetchRoutingRules", props.orderRoutingId), store.dispatch("orderRouting/fetchRoutingFilters", props.orderRoutingId), store.dispatch("util/fetchFacilities"), store.dispatch("util/fetchEnums", { enumTypeId: "ORDER_SALES_CHANNEL" }), store.dispatch("util/fetchShippingMethods"), store.dispatch("util/fetchFacilityGroups")])

  initializeOrderRoutingOptions()

  // Added check to not fetch any rule related information as when a new route will be created no rule will be available thus no need to fetch any other information
  if(!routingRules.value.length) {
    return;
  }

  inventoryRules.value = JSON.parse(JSON.stringify(routingRules.value))

  await fetchRuleInformation(inventoryRules.value[0].routingRuleId);
})

function initializeOrderRoutingOptions() {
  const orderRouteFilters = sortSequence(JSON.parse(JSON.stringify(currentRouting.value["orderFilters"]))).reduce((filters: any, filter: any) => {
    if(filters[filter.conditionTypeEnumId]) {
      filters[filter.conditionTypeEnumId][filter.fieldName] = filter
    } else {
      filters[filter.conditionTypeEnumId] = {
        [filter.fieldName]: filter
      }
    }
    return filters
  }, {})

  orderRoutingFilterOptions.value = orderRouteFilters["ENTCT_FILTER"] ? orderRouteFilters["ENTCT_FILTER"] : {}
  orderRoutingSortOptions.value = orderRouteFilters["ENTCT_SORT_BY"] ? orderRouteFilters["ENTCT_SORT_BY"] : {}
}

async function fetchRuleInformation(routingRuleId: string) {
  // When clicking the same enum again do not fetch its information
  // TODO: check behaviour when creating a new rule, when no rule exist and when already some rule exist and a rule is open
  if(selectedRoutingRule.value.routingRuleId === routingRuleId) {
    return;
  }

  selectedRoutingRule.value = inventoryRules.value.find((rule: Rule) => rule.routingRuleId === routingRuleId)
  await Promise.all([store.dispatch("orderRouting/fetchRuleConditions", routingRuleId), store.dispatch("orderRouting/fetchRuleActions", routingRuleId)])

  inventoryRuleConditions.value = JSON.parse(JSON.stringify(ruleConditions.value))
  autoCancelDays.value = ruleActions.value[actionEnums['AUTO_CANCEL_DAYS'].id]?.actionValue

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(ruleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ''
}

async function addInventoryFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  if(!selectedRoutingRule.value.routingRuleId) {
    // TODO: check if we can show a toast here
    logger.error('Failed to identify selected inventory rule, please select a rule or refresh')
    return;
  }
  
  const inventoryFilterOptionsModal = await modalController.create({
    component: AddInventoryFilterOptionsModal,
    componentProps: { ruleConditions: inventoryRuleConditions.value, routingRuleId: selectedRoutingRule.value.routingRuleId, parentEnumId, conditionTypeEnumId, label }
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

async function addOrderRouteFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  const orderRouteFilterOptions = await modalController.create({
    component: AddOrderRouteFilterOptions,
    componentProps: { orderRoutingFilters: conditionTypeEnumId === 'ENTCT_FILTER' ? orderRoutingFilterOptions.value : orderRoutingSortOptions.value, orderRoutingId: props.orderRoutingId, parentEnumId, conditionTypeEnumId, label }
  })

  orderRouteFilterOptions.onDidDismiss().then((result: any) => {
    // Using role to determine when to update the filters
    // When closing the modal without save and when unselecting all the filter, in both the cases we get filters object as empty thus passing a role from the modal to update the filter only when save action is performed
    if(result.role === 'save') {
      conditionTypeEnumId === 'ENTCT_FILTER' ? ( orderRoutingFilterOptions.value = result.data.filters ) : ( orderRoutingSortOptions.value = result.data.filters )
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
        sequenceNum: inventoryRules.value.length && inventoryRules.value[inventoryRules.value.length - 1].sequenceNum >= 0 ? inventoryRules.value[inventoryRules.value.length - 1].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0, that will result in again setting the new route seqNum to 0,
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
  return options?.[enums[parameter].code]
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
    getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE").fieldValue = result.data?.isPastDuration ? `-${result.data?.duration}` : result.data?.duration
    getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE").operator = "less-equals"
  })

  return popover.present();
}

async function selectValue(id: string, header: string) {
  const valueAlert = await alertController.create({
    header,
    buttons: [{
      text: "Cancel",
      role: "cancel"
    }, {
      text: "Save"
    }],
    inputs: [{
      name: "value",
      placeholder: "value",
      value: getFilterValue(inventoryRuleConditions.value, conditionFilterEnums, id).fieldValue
    }]
  })

  valueAlert.onDidDismiss().then(async (result: any) => {
    const value = result.data?.values?.value;
    // Considering that when having role in result, its negative action and not need to do anything
    if(!result.role && value) {
      getFilterValue(inventoryRuleConditions.value, conditionFilterEnums, id).fieldValue = value
      // When selecting a filter value making the operator to default `equals`
      getFilterValue(inventoryRuleConditions.value, conditionFilterEnums, id).operator = "equals"
    }
  })

  return valueAlert.present();
}

function updateOperator(event: CustomEvent) {
  getFilterValue(inventoryRuleConditions.value, conditionFilterEnums, "BRK_SAFETY_STOCK").operator = event.detail.value
}

function updateOrderFilterValue(event: CustomEvent, id: string) {
  orderRoutingFilterOptions.value[ruleEnums[id].code].fieldValue = event.detail.value
}

function updateRuleFilterValue(event: CustomEvent, conditionTypeEnumId: string, id: string) {
  inventoryRuleConditions.value[conditionTypeEnumId][conditionFilterEnums[id].code].fieldValue = event.detail.value
}

function updateRuleStatus(routingRuleId: string, statusId: string) {
  inventoryRules.value.map((inventoryRule: any) => {
    if(inventoryRule.routingRuleId === routingRuleId) {
      inventoryRule.statusId = statusId
    }
  })
}

function doRouteSortReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(Object.values(orderRoutingSortOptions.value)))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(Object.values(orderRoutingSortOptions.value))));

  const updatedSeqenceNum = Object.keys(previousSeq).map((filter: any) => previousSeq[filter].sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  orderRoutingSortOptions.value = updatedSeq.reduce((filters: any, filter: any) => {
    filters[filter.fieldName] = filter
    return filters
  }, {})
}

function doConditionSortReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(Object.values(inventoryRuleConditions.value["ENTCT_SORT_BY"])))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(Object.values(inventoryRuleConditions.value["ENTCT_SORT_BY"]))));

  const updatedSeqenceNum = Object.keys(previousSeq).map((filter: any) => previousSeq[filter].sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  inventoryRuleConditions.value["ENTCT_SORT_BY"] = updatedSeq.reduce((filters: any, filter: any) => {
    filters[filter.fieldName] = filter
    return filters
  }, {})
}

function findRoutingsDiff(previousSeq: any, updatedSeq: any) {
  const diffSeq: any = Object.keys(previousSeq).reduce((diff, key) => {
    if (updatedSeq[key].routingRuleId === previousSeq[key].routingRuleId) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, {})
  return diffSeq;
}

function findSortDiff(previousSeq: any, updatedSeq: any) {
  let seqToUpdate = {}
  let seqToRemove = {} as any

  seqToUpdate = Object.keys(previousSeq).reduce((diff, key) => {
    if(!updatedSeq[key]) {
      seqToRemove[key] = previousSeq[key]
      return diff
    }

    if (updatedSeq[key].fieldName === previousSeq[key].fieldName && updatedSeq[key].sequenceNum === previousSeq[key].sequenceNum) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, seqToUpdate)

  seqToUpdate = Object.keys(updatedSeq).reduce((diff, key) => {
    if(!previousSeq[key]) {
      diff = {
        ...diff,
        [key]: updatedSeq[key]
      }
    }

    return diff
  }, seqToUpdate)

  return { seqToUpdate, seqToRemove };
}

function findFilterDiff(previousSeq: any, updatedSeq: any) {
  let seqToUpdate = {}
  let seqToRemove = {} as any

  seqToUpdate = Object.keys(previousSeq).reduce((diff, key) => {
    if(!updatedSeq[key]) {
      seqToRemove[key] = previousSeq[key]
      return diff
    }

    if (updatedSeq[key].fieldName === previousSeq[key].fieldName && updatedSeq[key].fieldValue === previousSeq[key].fieldValue && updatedSeq[key].operator === previousSeq[key].operator) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, seqToUpdate)

  seqToUpdate = Object.keys(updatedSeq).reduce((diff, key) => {
    // Added fieldValue check as we have considered that when adding a filter option, it should always have a value
    if(!previousSeq[key] && updatedSeq[key].fieldValue) {
      diff = {
        ...diff,
        [key]: updatedSeq[key]
      }
    }

    return diff
  }, seqToUpdate)

  return { seqToUpdate, seqToRemove };
}

function doReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(routingRules.value))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(inventoryRules.value)));

  let diffSeq = findRoutingsDiff(previousSeq, updatedSeq)

  const updatedSeqenceNum = previousSeq.map((rule: Rule) => rule.sequenceNum)
  Object.keys(diffSeq).map((key: any) => {
    diffSeq[key].sequenceNum = updatedSeqenceNum[key]
  })

  diffSeq = Object.keys(diffSeq).map((key) => diffSeq[key])

  inventoryRules.value = updatedSeq
}

async function save() {
  const orderRouting = {
    orderRoutingId: props.orderRoutingId,
    routingGroupId: currentRouting.value.routingGroupId
  } as any

  const routeSortOptionsDiff = findSortDiff(currentRouting.value["orderFilters"].reduce((filters: any, filter: any) => {
    if(filter.conditionTypeEnumId === "ENTCT_SORT_BY") {
      filters[filter.fieldName] = filter
    }
    return filters
  }, {}), orderRoutingSortOptions.value)

  const routeFilterOptionsDiff = findFilterDiff(currentRouting.value["orderFilters"].reduce((filters: any, filter: any) => {
    if(filter.conditionTypeEnumId === "ENTCT_FILTER") {
      filters[filter.fieldName] = filter
    }
    return filters
  }, {}), orderRoutingFilterOptions.value)

  const filtersToRemove = Object.values({ ...routeFilterOptionsDiff.seqToRemove, ...routeSortOptionsDiff.seqToRemove })
  const filtersToUpdate = Object.values({ ...routeFilterOptionsDiff.seqToUpdate, ...routeSortOptionsDiff.seqToUpdate })

  if(filtersToRemove.length) {
    await store.dispatch("orderRouting/deleteRoutingFilters", { filters: filtersToRemove, orderRoutingId: props.orderRoutingId })

    // TODO: check when to update the filters in state, currently not updating and fetching the records again, as when creating new filter we get conditionSeqId from response, but we can't add it in the state
    // if(isSuccess) {
    //   await store.dispatch("orderRouting/setCurrentOrderRouting", { ...currentRouting.value, orderFilters: Object.values({ ...orderRoutingFilterOptions.value, ...orderRoutingSortOptions.value }) })
    // }
  }

  if(filtersToUpdate.length) {
    orderRouting["orderFilters"] = filtersToUpdate
    const orderRoutingId = await store.dispatch("orderRouting/updateRouting", orderRouting)

    if(orderRoutingId) {
      await store.dispatch("orderRouting/setCurrentOrderRouting", { ...currentRouting.value, orderFilters: Object.values({ ...orderRoutingFilterOptions.value, ...orderRoutingSortOptions.value }) })
    }
  }

  await store.dispatch("orderRouting/fetchCurrentOrderRouting", props.orderRoutingId)
  initializeOrderRoutingOptions();
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

ion-chip > ion-select {
  /* Adding min-height as auto-styling is getting appLied when not using legacy select option */
  min-height: unset;
}
</style>
