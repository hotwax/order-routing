<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/tabs/brokering/${currentRoutingGroup.routingGroupId}/routes`" />
        </ion-buttons>
        <ion-title>{{ currentRouting.routingName }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <main>
        <section id="order-filters" class="menu">
          <ion-item lines="none">
            <ion-label>
              <h1 v-show="!isRouteNameUpdating">{{ currentRouting.routingName }}</h1>
              <!-- Added class as we can't change the background of ion-input with css property, and we need to change the background to show the user that now this value is editable -->
              <ion-input ref="routeNameRef" :class="isRouteNameUpdating ? 'name' : ''" v-show="isRouteNameUpdating" aria-label="route name" v-model="routeName"></ion-input>
            </ion-label>
            <ion-chip slot="end" outline>
              {{ getRouteIndex() }}
            </ion-chip>
          </ion-item>
          <ion-button class="ion-margin-start" color="medium" fill="outline" size="small" @click="isRouteNameUpdating ? updateRouteName() : editRouteName()">
            <ion-icon slot="start" :icon="isRouteNameUpdating ? saveOutline : pencilOutline" />
            {{ isRouteNameUpdating ? translate("Save") : translate("Rename") }}
          </ion-button>
          <!-- <ion-button color="medium" fill="outline" size="small">
            <ion-icon slot="start" :icon="copyOutline" />
            {{ translate("Clone") }}
          </ion-button> -->
          <ion-item>
            <ion-icon slot="start" :icon="pulseOutline" />
            <ion-select :label="translate('Status')" interface="popover" :interface-options="{ subHeader: translate('Status') }" :value="routingStatus" @ionChange="updateOrderRouting($event.detail.value)">
              <ion-select-option value="ROUTING_ACTIVE">{{ translate("Active") }}</ion-select-option>
              <ion-select-option value="ROUTING_DRAFT">{{ translate("Draft") }}</ion-select-option>
              <ion-select-option value="ROUTING_ARCHIVED">{{ translate("Archive") }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item lines="full">
            <ion-icon :icon="timeOutline" slot="start" />
            <ion-label>{{ translate("Last run") }}</ion-label>
            <ion-chip outline @click.stop="openRoutingHistoryModal()">
              <ion-label>{{ routingHistory[currentRouting.orderRoutingId] ? getDateAndTimeShort(routingHistory[currentRouting.orderRoutingId][0].startDate) : "-" }}</ion-label>
            </ion-chip>
          </ion-item>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Filters") }}</ion-label>
              <ion-button slot="end" fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item-divider>
            <p class="empty-state" v-if="!orderRoutingFilterOptions || !Object.keys(orderRoutingFilterOptions).length">
              {{ translate("Add order filters.") }} <br />
              {{ translate("All orders in all parkings will be attempted if no filter is applied.") }}
            </p>
            <!-- Using hardcoded options for filters, as in filters we have multiple ways of value selection for filters like select, chip -->
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE')">
              <ion-select multiple :placeholder="translate('queue')" :label="translate('Queue')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'QUEUE', true)">
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD')">
              <ion-select multiple :placeholder="translate('shipping method')" interface="popover" :label="translate('Shipping method')" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SHIPPING_METHOD', true)">
                <ion-select-option v-for="(shippingMethod, shippingMethodId) in shippingMethods" :key="shippingMethodId" :value="shippingMethodId">{{ shippingMethod.description || shippingMethodId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY')">
              <ion-select :placeholder="translate('priority')" interface="popover" :label="translate('Order priority')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY').fieldValue" @ionChange="updateOrderFilterValue($event, 'PRIORITY')">
                <ion-select-option value="HIGH">{{ translate("High") }}</ion-select-option>
                <ion-select-option value="MEDIUM">{{ translate("Medium") }}</ion-select-option>
                <ion-select-option value="Low">{{ translate("Low") }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE')">
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-chip outline @click="selectPromiseFilterValue($event)">
                {{ getPromiseDateValue() }}
              </ion-chip>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL')">
              <ion-select multiple :placeholder="translate('sales channel')" :label="translate('Sales Channel')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SALES_CHANNEL', true)">
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP')">
              <ion-select multiple :placeholder="translate('facility group')" :label="translate('Origin Facility Group')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'ORIGIN_FACILITY_GROUP', true)">
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in facilityGroups" :key="facilityGroupId" :value="facilityGroupId">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-item-group>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Sort") }}</ion-label>
              <ion-button slot="end" fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item-divider>
            <!-- Added check for undefined as well as empty object, as on initial load there might be a case in which route sorting options are not available thus it will be undefined but when updating the values from the modal this will always return an object -->
            <p class="empty-state" v-if="!orderRoutingSortOptions || !Object.keys(orderRoutingSortOptions).length">
              {{ translate("Add sorting rules.") }} <br />
              {{ translate("Orders will be brokered based on order date if no sorting is specified.") }}
            </p>
            <ion-reorder-group @ionItemReorder="doRouteSortReorder($event)" :disabled="false">
              <ion-item v-for="(sort, code) in orderRoutingSortOptions" :key="code">
                <ion-label>{{ getLabel("ORD_SORT_PARAM_TYPE", code) || code }}</ion-label>
                <ion-reorder />
              </ion-item>
            </ion-reorder-group>
          </ion-item-group>
        </section>
        <section v-if="inventoryRules.length" id="inventory-rules">
          <section id="inventory-sequence" class="menu">
            <ion-list>
              <ion-reorder-group @ionItemReorder="doReorder($event)" :disabled="false">
                <ion-item lines="full" v-for="rule in inventoryRules" :key="rule.routingRuleId && inventoryRules.length" :color="rule.routingRuleId === selectedRoutingRule?.routingRuleId ? 'light' : ''" @click="fetchRuleInformation(rule.routingRuleId)" button>
                  <ion-label>
                    <h2>{{ rule.ruleName }}</h2>
                    <ion-note :color="rule.statusId === 'RULE_ACTIVE' ? 'success' : rule.statusId === 'RULE_ARCHIVED' ? 'warning' : ''">{{ rule.statusId === "RULE_ACTIVE" ? translate("Active") : rule.statusId === "RULE_ARCHIVED" ? translate("Archived") : translate("Draft") }}</ion-note>
                  </ion-label>
                  <!-- Don't display reordering option when there is a single rule -->
                  <ion-reorder v-show="inventoryRules.length > 1" />
                </ion-item>
              </ion-reorder-group>
            </ion-list>
            <ion-button fill="outline" @click="addInventoryRule">
              {{ translate("Add inventory rule") }}
              <ion-icon :icon="addCircleOutline" slot="end"/>
            </ion-button>
          </section>
          <div v-if="selectedRoutingRule?.routingRuleId">
            <ion-card class="rule-info">
              <ion-item lines="none">
                <ion-label>
                  <p>{{ getRuleIndex() }}</p>
                  <h1 v-show="!isRuleNameUpdating">{{ selectedRoutingRule.ruleName }}</h1>
                </ion-label>
                <!-- Added class as we can't change the background of ion-input with css property, and we need to change the background to show the user that now this value is editable -->
                <ion-input ref="ruleNameRef" :class="isRuleNameUpdating ? 'name' : ''" v-show="isRuleNameUpdating" aria-label="rule name" v-model="selectedRoutingRule.ruleName"></ion-input>
              </ion-item>
              <div>
                <ion-item>
                  <ion-icon slot="start" :icon="pulseOutline" />
                  <ion-select :label="translate('Status')" interface="popover" :value="selectedRoutingRule.statusId" :interface-options="{ subHeader: translate('Status') }" @ionChange="updateRuleStatus($event, selectedRoutingRule.routingRuleId)">
                    <ion-select-option value="RULE_ACTIVE">{{ translate("Active") }}</ion-select-option>
                    <ion-select-option value="RULE_DRAFT">{{ translate("Draft") }}</ion-select-option>
                    <ion-select-option value="RULE_ARCHIVED">{{ translate("Archived") }}</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <div slot="end">
                    <ion-button size="small" @click="isRuleNameUpdating ? updateRuleName(selectedRoutingRule.routingRuleId) : editRuleName()" fill="outline">
                      <ion-icon slot="start" :icon="isRuleNameUpdating ? saveOutline : pencilOutline" />
                      {{ isRuleNameUpdating ? translate("Save") : translate("Rename") }}
                    </ion-button>
                    <!-- <ion-button size="small" @click="cloneRule" fill="outline">
                      <ion-icon slot="start" :icon="copyOutline"/>
                      {{ translate("Clone") }}
                    </ion-button> -->
                  </div>
                </ion-item>
              </div>
            </ion-card>
            <section class="filters">
              <ion-card>
                <ion-item>
                  <ion-icon slot="start" :icon="filterOutline"/>
                  <h4>{{ translate("Filters") }}</h4>
                  <ion-button slot="end" fill="clear" @click="addInventoryFilterOptions('INV_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                    <ion-icon slot="icon-only" :icon="optionsOutline"/>
                  </ion-button>
                </ion-item>
                <p class="empty-state" v-if="!inventoryRuleFilterOptions || !Object.keys(inventoryRuleFilterOptions).length">{{ translate("Select filter to apply") }}</p>
                <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP')">
                  <ion-select :placeholder="translate('facility group')" interface="popover" :label="translate('Group')" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP').fieldValue" @ionChange="updateRuleFilterValue($event, 'FACILITY_GROUP')">
                    <ion-select-option v-for="(facilityGroup, facilityGroupId) in getFacilityGroupsForBrokering()" :key="facilityGroupId" :value="facilityGroupId">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'PROXIMITY')">
                  <!-- TODO: Confirm on the possible options -->
                  <ion-label>{{ translate("Proximity") }}</ion-label>
                  <div>
                    <ion-chip outline @click.stop="chipClickEvent(measurementRef)">
                      <ion-select @click.stop ref="measurementRef" :placeholder="translate('measurement unit')" aria-label="measurement" interface="popover" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'MEASUREMENT_SYSTEM')?.fieldValue" @ionChange="updateRuleFilterValue($event, 'MEASUREMENT_SYSTEM')">
                        <ion-select-option value="METRIC">{{ translate("kms") }}</ion-select-option>
                        <ion-select-option value="IMPERIAL">{{ translate("miles") }}</ion-select-option>
                      </ion-select>
                    </ion-chip>
                    <ion-chip outline @click="selectValue('PROXIMITY', 'Add proximity')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue : "-" }}</ion-chip>
                  </div>
                </ion-item>
                <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'BRK_SAFETY_STOCK')">
                  <ion-label>{{ translate("Brokering safety stock") }}</ion-label>
                  <div>
                    <ion-chip outline @click.stop="chipClickEvent(operatorRef)">
                      <!-- Added click.stop to override the default click event of ion-select, as we handled the click event using ion-chip -->
                      <ion-select @click.stop ref="operatorRef" :placeholder="translate('operator')" aria-label="operator" interface="popover" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'BRK_SAFETY_STOCK').operator" @ionChange="updateOperator($event)">
                        <ion-select-option value="greater-equals">{{ translate("greater than or equal to") }}</ion-select-option>
                        <ion-select-option value="greater">{{ translate("greater") }}</ion-select-option>
                      </ion-select>
                    </ion-chip>
                    <ion-chip outline @click="selectValue('BRK_SAFETY_STOCK', 'Add safety stock')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue : "-" }}</ion-chip>
                  </div>
                </ion-item>
              </ion-card>
              <ion-card>
                <ion-item>
                  <ion-icon slot="start" :icon="swapVerticalOutline"/>
                  <h4>{{ translate("Sort") }}</h4>
                  <ion-button slot="end" fill="clear" @click="addInventoryFilterOptions('INV_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                    <ion-icon slot="icon-only" :icon="optionsOutline"/>
                  </ion-button>
                </ion-item>
                <p class="empty-state" v-if="!inventoryRuleSortOptions || !Object.keys(inventoryRuleSortOptions).length">{{ translate("Select sorting to apply") }}</p>
                <ion-reorder-group @ionItemReorder="doConditionSortReorder($event)" :disabled="false">
                  <ion-item v-for="(sort, code) in inventoryRuleSortOptions" :key="code">
                    <ion-label>{{ getLabel("INV_SORT_PARAM_TYPE", code) || code }}</ion-label>
                    <ion-reorder />
                  </ion-item>
                </ion-reorder-group>
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
                    <!-- When selecting promiseDate route filter we will show the partial allocation option as checked on UI, but will not update its value on backend. Discussed with Aditya Sir -->
                    <ion-toggle :disabled="isPromiseDateFilterApplied()" :checked="selectedRoutingRule.assignmentEnumId === 'ORA_MULTI' || isPromiseDateFilterApplied()" @ionChange="updatePartialAllocation($event.detail.checked)">{{ translate("Allow partial allocation") }}</ion-toggle>
                  </ion-item>
                  <ion-item v-show="isPromiseDateFilterApplied()" lines="none">
                    <ion-label class="ion-text-wrap">
                      <p>{{ translate("Partial allocation cannot be disabled. Orders are filtered by item when filtering by promise date.") }}</p>
                    </ion-label>
                  </ion-item>
                  <ion-item lines="none">
                    <ion-toggle :disabled="selectedRoutingRule.assignmentEnumId !== 'ORA_MULTI' && !isPromiseDateFilterApplied()" :checked="isPartialGroupItemsAllocationActive()" @ionChange="updatePartialGroupItemsAllocation($event.detail.checked)">{{ translate("Partially allocate grouped items") }}</ion-toggle>
                  </ion-item>
                </ion-card>
                <ion-card>
                  <ion-card-header>
                    <ion-card-title>
                      {{ translate("Unavailable items") }}
                    </ion-card-title>
                  </ion-card-header>
                  <ion-item lines="none">
                    <ion-select :placeholder="translate('action')" :label="translate('Move items to')" interface="popover" :value="ruleActionType" @ionChange="updateUnfillableActionType($event.detail.value)">
                      <ion-select-option :value="actionEnums['NEXT_RULE'].id">
                        {{ translate("Next rule") }}
                        <ion-icon :icon="playForwardOutline"/>
                      </ion-select-option>
                      <ion-select-option :value="actionEnums['MOVE_TO_QUEUE'].id">
                        {{ translate("Queue") }}
                        <ion-icon :icon="golfOutline"/>
                      </ion-select-option>
                    </ion-select>
                  </ion-item>
                  <ion-item lines="none" v-show="ruleActionType === actionEnums['MOVE_TO_QUEUE'].id">
                    <ion-select :placeholder="translate('queue')" :label="translate('Queue')" interface="popover" :value="inventoryRuleActions[ruleActionType]?.actionValue" @ionChange="updateRuleActionValue($event.detail.value)">
                      <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                  <ion-item lines="none">
                    <ion-toggle :checked="inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue" @ionChange="clearAutoCancelDays($event.detail.checked)">{{ translate("Clear auto cancel days") }}</ion-toggle>
                  </ion-item>
                  <ion-item lines="none" v-show="!inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue">
                    <ion-label>{{ translate("Auto cancel days") }}</ion-label>
                    <ion-chip outline @click="updateAutoCancelDays()">
                      <template v-if="inventoryRuleActions[actionEnums['AUTO_CANCEL_DAYS'].id]?.actionValue">
                        <ion-icon :icon="closeCircleOutline" @click.stop="removeAutoCancelDays()"/>
                        <ion-label>{{ `${inventoryRuleActions[actionEnums["AUTO_CANCEL_DAYS"].id].actionValue} days` }}</ion-label>
                      </template>
                      <template v-else>
                        {{ translate("select days") }}
                      </template>
                    </ion-chip>
                  </ion-item>
                </ion-card>
              </div>
            </section>
          </div>
          <div class="empty-state" v-else>{{ translate("Please select a rule or refresh") }}</div>
        </section>
        <section v-else class="empty-state">
          <img src="../assets/images/InventoryRuleEmptyState.png" />
          <ion-button @click="addInventoryRule">
            {{ translate("Add inventory rule") }}
            <ion-icon slot="end" :icon="addCircleOutline"></ion-icon>
          </ion-button>
        </section>
      </main>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button :disabled="!hasUnsavedChanges" @click="save">
          <ion-icon :icon="saveOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonNote, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonTitle, IonToggle, IonToolbar, alertController, modalController, onIonViewWillEnter, popoverController } from "@ionic/vue";
import { addCircleOutline, closeCircleOutline, copyOutline, filterOutline, golfOutline, optionsOutline, pencilOutline, playForwardOutline, pulseOutline, saveOutline, swapVerticalOutline, timeOutline } from "ionicons/icons"
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { computed, defineProps, nextTick, ref } from "vue";
import store from "@/store";
import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";
import { getDateAndTimeShort, hasError, showToast, sortSequence } from "@/utils";
import { Rule } from "@/types";
import AddOrderRouteFilterOptions from "@/components/AddOrderRouteFilterOptions.vue"
import PromiseFilterPopover from "@/components/PromiseFilterPopover.vue"
import logger from "@/logger";
import { DateTime } from "luxon";
import emitter from "@/event-bus";
import { translate } from "@/i18n";
import RoutingHistoryModal from "@/components/RoutingHistoryModal.vue"
import { OrderRoutingService } from "@/services/RoutingService";

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

const currentRoutingGroup: any = computed(() => store.getters["orderRouting/getCurrentRoutingGroup"])
const currentRouting = computed(() => store.getters["orderRouting/getCurrentOrderRouting"])
const routingRules = computed(() => store.getters["orderRouting/getRulesInformation"])
const facilities = computed(() => store.getters["util/getFacilities"])
const enums = computed(() => store.getters["util/getEnums"])
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])
const facilityGroups = computed(() => store.getters["util/getFacilityGroups"])
const routingHistory = computed(() => store.getters["orderRouting/getRoutingHistory"])
const currentRuleId = computed(() => store.getters["orderRouting/getCurrentRuleId"])

let ruleActionType = ref("")
let selectedRoutingRule = ref({}) as any
let inventoryRules = ref([]) as any
let orderRoutingFilterOptions = ref({}) as any
let orderRoutingSortOptions = ref({}) as any
let inventoryRuleFilterOptions = ref({}) as any
let inventoryRuleSortOptions = ref({}) as any
let inventoryRuleActions = ref({}) as any
let rulesInformation = ref({}) as any
let hasUnsavedChanges = ref(false)
let isRuleNameUpdating = ref(false)
let routingStatus = ref("")
let routeName = ref("")
let isRouteNameUpdating = ref(false)

const routeNameRef = ref()
const operatorRef = ref()
const measurementRef = ref()
const ruleNameRef = ref()

onIonViewWillEnter(async () => {
  emitter.emit("presentLoader", { message: "Fetching filters and inventory rules", backdropDismiss: false })
  await Promise.all([store.dispatch("orderRouting/fetchCurrentOrderRouting", props.orderRoutingId), store.dispatch("util/fetchFacilities"), store.dispatch("util/fetchOmsEnums", { enumTypeId: "ORDER_SALES_CHANNEL" }), store.dispatch("util/fetchShippingMethods"), store.dispatch("util/fetchFacilityGroups")])
  store.dispatch("orderRouting/fetchRoutingHistory", router.currentRoute.value.params.routingGroupId)

  // Fetching the group information again if the group stored in the state and the groupId in the route params are not same. This case occurs when we are on the route details page of a group and then directly hit the route details for a different group.
  if(currentRoutingGroup.value.routingGroupId !== router.currentRoute.value.params.routingGroupId) {
    await store.dispatch("orderRouting/fetchCurrentRoutingGroup", router.currentRoute.value.params.routingGroupId)
  }

  if(currentRouting.value["orderFilters"]?.length) {
    initializeOrderRoutingOptions()
  }

  // Added check to not fetch any rule related information as when a new route will be created no rule will be available thus no need to fetch any other information
  if(currentRouting.value["rules"]?.length) {
    inventoryRules.value = sortSequence(JSON.parse(JSON.stringify(currentRouting.value["rules"])))
    await fetchRuleInformation(currentRuleId.value || inventoryRules.value[0].routingRuleId);
  }

  routeName.value = currentRouting.value["routingName"] ? currentRouting.value["routingName"] : ""

  routingStatus.value = currentRouting.value.statusId
  emitter.emit("dismissLoader")
})

onBeforeRouteLeave(async (to) => {
  if(to.path === "/login") return;

  if(!hasUnsavedChanges.value) {
    // clearning the selected ruleId whenever user tries to leave the page, we need to clear this id, as if user opens some other routing then the id will not be found which will result in an empty state scenario
    store.dispatch("orderRouting/updateRoutingRuleId", "")
    store.dispatch("orderRouting/clearRules")
    return;
  }

  const alert = await alertController.create({
    header: translate("Save changes"),
    message: translate("Do you want to save your changes before leaving this page?"),
    buttons: [
      {
        text: translate("Discard")
      },
      {
        text: translate("Save"),
        handler: async () => {
          await save();
        },
      },
    ],
  });

  alert.present();
  const data = await alert.onDidDismiss()

  // If clicking backdrop just close the modal and do not redirect the user to previous page
  if(data?.role === "backdrop") {
    return false;
  }

  // clearning the selected ruleId whenever user leaves the page, we need to clear this id, as if user opens some other routing then the id will not be found which will result in an empty state scenario
  store.dispatch("orderRouting/updateRoutingRuleId", "")
  store.dispatch("orderRouting/clearRules")
  return;
})

/*
When using ion-select inside ion-chip, if the user clicks on ion-chip and not on ion-select, the select popover does not open.
This happens because ionic does not provide any events for ion-chip OOTB.

Defined ref for specific select those are inside ion-chip and on clicking the chip, explicitely calling the click event of ion-select that triggers the select options to be displayed
*/
async function chipClickEvent(ref: any) {
  ref.$el.click();
}

function getRouteIndex() {
  // Filtering archived routes as the index and total count needs to calculated by excluding the archived routes
  const activeAndDraftRoute = currentRoutingGroup.value["routings"].filter((routing: any) => routing.statusId !== "ROUTING_ARCHIVED")
  const total = activeAndDraftRoute.length
  const currentRouteIndex: any = Object.keys(activeAndDraftRoute).find((key: any) => activeAndDraftRoute[key].orderRoutingId === props.orderRoutingId)

  // adding one (1) as currentRouteIndex will have the index based on array, and used + as currentRouteIndex is a string
  return `${+currentRouteIndex + 1}/${total}`
}

function getRuleIndex() {
  const total = inventoryRules.value.length
  const currentRuleIndex: any = Object.keys(inventoryRules.value).find((key: any) => inventoryRules.value[key].routingRuleId == selectedRoutingRule.value.routingRuleId)

  // adding one (1) as currentRuleIndex will have the index based on array, and used + as currentRuleIndex is a string
  return `${+currentRuleIndex + 1}/${total}`
}

function getFacilityGroupsForBrokering() {
  return Object.values(facilityGroups.value)?.reduce((facilityGroups: any, group: any) => {
    if(group.facilityGroupTypeId === "BROKERING_GROUP") {
      facilityGroups[group.facilityGroupId] = group
    }
    return facilityGroups
  }, {})
}

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

async function initializeInventoryRules(rule: any) {
  const inventoryRuleFilters = rule["inventoryFilters"] ? rule["inventoryFilters"] : {}

  inventoryRuleActions.value = rule["actions"] || {}
  inventoryRuleFilterOptions.value = inventoryRuleFilters["ENTCT_FILTER"] ? inventoryRuleFilters["ENTCT_FILTER"] : {}
  inventoryRuleSortOptions.value = inventoryRuleFilters["ENTCT_SORT_BY"] ? inventoryRuleFilters["ENTCT_SORT_BY"] : {}

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(inventoryRuleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ""
}

async function editRouteName() {
  isRouteNameUpdating.value = !isRouteNameUpdating.value;
  // Waiting for DOM updations before focus inside the text-area, as it is conditionally rendered in the DOM
  await nextTick()
  routeNameRef.value.$el.setFocus();
}

async function updateRouteName() {
  if(routeName.value.trim() && routeName.value.trim() !== currentRouting.value.routingName.trim()) {

    emitter.emit("presentLoader", { message: "Updating...", backdropDismiss: false })

    const payload = {
      orderRoutingId: props.orderRoutingId,
      routingName: routeName.value
    }

    let orderRoutingId = ''
    try {
      const resp = await OrderRoutingService.updateRouting(payload);

      if(!hasError(resp) && resp.data.orderRoutingId) {
        orderRoutingId = resp.data.orderRoutingId
        showToast(translate("Order routing information updated"))
      } else {
        throw resp.data
      }
    } catch(err) {
      showToast(translate("Failed to update routing information"))
      logger.error(err);
    }

    if(orderRoutingId) {
      await store.dispatch("orderRouting/setCurrentOrderRouting", { ...currentRouting.value, routingName: routeName.value })
    } else {
      routeName.value = currentRouting.value.routingName.trim()
    }

    emitter.emit("dismissLoader")
  }

  isRouteNameUpdating.value = false
}

async function fetchRuleInformation(routingRuleId: string, forceUpdate = false) {
  // Changing the value to false, as when fetching the information initially or after changing the rule we should stop the process of name updation
  isRuleNameUpdating.value = false

  await store.dispatch("orderRouting/updateRoutingRuleId", routingRuleId)

  // When clicking the same enum again do not fetch its information
  // TODO: check behaviour when creating a new rule, when no rule exist and when already some rule exist and a rule is open
  if(selectedRoutingRule.value.routingRuleId === routingRuleId && !forceUpdate) {
    return;
  }

  // Only fetch the rules information, if already not present, as we are updating rule values
  if(!rulesInformation.value[routingRuleId] || forceUpdate) {
    rulesInformation.value[routingRuleId] = await store.dispatch("orderRouting/fetchInventoryRuleInformation", routingRuleId)
  }

  // TODO: check on this condition, remove if not required
  // If there is not an already selected rule, deep clone it for usage. This condition can occur when we does not have any inventory rules for the route and we have created a new rule
  if(!selectedRoutingRule.value.routingRuleId) {
    rulesInformation.value = JSON.parse(JSON.stringify(routingRules.value))
  }

  // Using currentRouting["rules"] deep-cloned object here, as we will update the change in rules with route changes and not with rules filter changes
  selectedRoutingRule.value = inventoryRules.value.find((rule: Rule) => rule.routingRuleId === routingRuleId)

  // If failed to fetch the current routing rule information
  if(!selectedRoutingRule.value || !rulesInformation.value[routingRuleId]?.routingRuleId) {
    selectedRoutingRule.value = {}
  }

  initializeInventoryRules(rulesInformation.value[routingRuleId] ? JSON.parse(JSON.stringify(rulesInformation.value[routingRuleId])) : {});
}

async function addInventoryFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  if(!selectedRoutingRule.value.routingRuleId) {
    logger.error("Failed to identify selected inventory rule, please select a rule or refresh")
    return;
  }
  
  const inventoryFilterOptionsModal = await modalController.create({
    component: AddInventoryFilterOptionsModal,
    componentProps: { ruleConditions: conditionTypeEnumId === "ENTCT_FILTER" ? inventoryRuleFilterOptions.value : inventoryRuleSortOptions.value, routingRuleId: selectedRoutingRule.value.routingRuleId, parentEnumId, conditionTypeEnumId, label }
  })

  inventoryFilterOptionsModal.onDidDismiss().then((result: any) => {
    // Using role to determine when to update the filters
    // When closing the modal without save and when unselecting all the filter, in both the cases we get filters object as empty thus passing a role from the modal to update the filter only when save action is performed
    if(result.role === "save") {
      conditionTypeEnumId === "ENTCT_FILTER" ? ( inventoryRuleFilterOptions.value = result.data.filters ) : ( inventoryRuleSortOptions.value = result.data.filters )
      updateRule()
    }
  })

  await inventoryFilterOptionsModal.present();
}

async function addOrderRouteFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  const orderRouteFilterOptions = await modalController.create({
    component: AddOrderRouteFilterOptions,
    componentProps: { orderRoutingFilters: conditionTypeEnumId === "ENTCT_FILTER" ? orderRoutingFilterOptions.value : orderRoutingSortOptions.value, orderRoutingId: props.orderRoutingId, parentEnumId, conditionTypeEnumId, label }
  })

  orderRouteFilterOptions.onDidDismiss().then((result: any) => {
    // Using role to determine when to update the filters
    // When closing the modal without save and when unselecting all the filter, in both the cases we get filters object as empty thus passing a role from the modal to update the filter only when save action is performed
    if(result.role === "save") {
      conditionTypeEnumId === "ENTCT_FILTER" ? ( orderRoutingFilterOptions.value = result.data.filters ) : ( orderRoutingSortOptions.value = result.data.filters )
      hasUnsavedChanges.value = true
    }
  })

  await orderRouteFilterOptions.present();
}

async function openRoutingHistoryModal() {
  const routingHistoryModal = await modalController.create({
    component: RoutingHistoryModal,
    componentProps: { routingHistory: routingHistory.value[currentRouting.value.orderRoutingId], routingName: currentRouting.value.routingName, groupName: currentRoutingGroup.value.groupName }
  })

  routingHistoryModal.present();
}

async function addInventoryRule() {
  const newRuleAlert = await alertController.create({
    header: translate("New Inventory Rule"),
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save"),
      handler: (data) => {
        if(!data.ruleName?.trim().length) {
          showToast(translate("Please enter a valid name"))
          return false;
        }
      }
    }],
    inputs: [{
      name: "ruleName",
      placeholder: translate("Rule name")
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
        createdDate: DateTime.now().toMillis()
      }

      const routingRuleId = await store.dispatch("orderRouting/createRoutingRule", payload)
      if(routingRuleId) {
        // Updating the rule action to NEXT_RULE by default after creation
        await store.dispatch("orderRouting/updateRule", {
          routingRuleId,
          orderRoutingId: props.orderRoutingId,
          actions: [{
            actionTypeEnumId: "ORA_NEXT_RULE",
            actionValue: "",
            createdDate: DateTime.now().toMillis()
          }]
        })
        // TODO: Fix warning of duplicate keys when creating a new rule
        inventoryRules.value = sortSequence(JSON.parse(JSON.stringify(currentRouting.value["rules"])))
        fetchRuleInformation(routingRuleId)
      }
    }
  })

  return newRuleAlert.present();
}

// When changing the selected rule, updating any changes made in filter, sort and actions of the current rule
function updateRule() {
  rulesInformation.value[selectedRoutingRule.value.routingRuleId]["inventoryFilters"] = { "ENTCT_FILTER": inventoryRuleFilterOptions.value, "ENTCT_SORT_BY": inventoryRuleSortOptions.value }
  rulesInformation.value[selectedRoutingRule.value.routingRuleId]["actions"] = inventoryRuleActions.value
  hasUnsavedChanges.value = true
}

function updateOrderRouting(value: string) {
  routingStatus.value = value
  hasUnsavedChanges.value = true
}

function updateUnfillableActionType(value: string) {
  const actionType = ruleActionType.value
  ruleActionType.value = value

  inventoryRuleActions.value[ruleActionType.value] = {
    actionTypeEnumId: value,
    actionValue: "", // after changing action type, as next_rule action does not need to have a value, so in all cases making intially the value as empty and will update if required from some other function
    createdDate: DateTime.now().toMillis()
  }
  // deleting previous action type, but using the data of previous action
  delete inventoryRuleActions.value[actionType]
  updateRule()
}

function updateRuleActionValue(value: string) {
  if(inventoryRuleActions.value[ruleActionType.value]) {
    inventoryRuleActions.value[ruleActionType.value]["actionValue"] = value
  } else {
    inventoryRuleActions.value = {
      ...inventoryRuleActions.value,
      [ruleActionType.value]: {
        actionValue: value
      }
    }
  }
  updateRule()
}

async function removeAutoCancelDays() {
  delete inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id]
  updateRule()
}

async function updateAutoCancelDays() {
  const alert = await alertController.create({
    header: translate("Auto cancel days"),
    inputs: [{
      name: "autoCancelDays",
      placeholder: translate("auto cancel days"),
      type: "number",
      min: 0,
      value: inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id]?.actionValue,
      attributes: {
        // Added check to not allow mainly .(period) and other special characters to be entered in the alert input
        onkeydown: ($event: any) => {
          if(/[`!@#$%^&*()_+\-=\\|,.<>?~]/.test($event.key)) $event.preventDefault();
        }
      }
    }],
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    },
    {
      text: translate("Save"),
      handler: (data) => {
        // Added check for `>= 0` as we not need to allow negative values for autoCancelDays value
        if(data?.autoCancelDays && data.autoCancelDays >= 0) {
          if(inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id]?.actionValue) {
            inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id].actionValue = data.autoCancelDays
          } else {
            inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id] = {
              actionTypeEnumId: actionEnums["AUTO_CANCEL_DAYS"].id,
              actionValue: data.autoCancelDays,
              createdDate: DateTime.now().toMillis(),
            }
          }
        } else {
          showToast(translate("Enter a valid value"))
          return false;
        }
        updateRule()
      }
    }]
  })
  await alert.present()
}

function updatePartialAllocation(checked: any) {
  inventoryRules.value.map((inventoryRule: any) => {
    if(inventoryRule.routingRuleId === selectedRoutingRule.value.routingRuleId) {
      inventoryRule.assignmentEnumId = checked ? "ORA_MULTI" : "ORA_SINGLE"
    }
  })
  hasUnsavedChanges.value = true
}

function isPromiseDateFilterApplied() {
  if(!currentRouting.value["rules"]?.length) {
    return;
  }

  // When user updates partial allocation and then selects promiseDate filter then we will assume that the user wants to change the value for partialAllocation on server and thus we will not revert any change made in the partial allocation action and update its value on server
  const filter = getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE")
  return filter?.fieldValue || filter?.fieldValue == 0
}

function getPromiseDateValue() {
  const value = orderRoutingFilterOptions.value?.[ruleEnums["PROMISE_DATE"].code]?.fieldValue
  if(value || value == 0) {
    return value == 0 ? translate("already passed") : value.startsWith("-") ? `${value.replace("-", "")} days passed` : `upcoming in ${value} days`
  }
  return translate("select range")
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
    return parameter === "SHIPPING_METHOD" ? shippingMethods.value[value[0]]?.description || value[0] : parameter === "SALES_CHANNEL" ? enums.value["ORDER_SALES_CHANNEL"] ? enums.value["ORDER_SALES_CHANNEL"][value[0]]?.description : value[0] : parameter === "ORIGIN_FACILITY_GROUP" ? facilityGroups.value[value[0]]?.facilityGroupName || value[0] : facilities.value[value[0]]?.facilityName || value[0]
  }
}

function getLabel(parentType: string, code: string) {
  const enumerations = enums.value[parentType]
  const enumInfo: any = enumerations ? Object.values(enumerations).find((enumeration: any) => enumeration.enumCode === code) : null

  return enumInfo?.description
}

async function selectPromiseFilterValue(ev: CustomEvent) {
  const popover = await popoverController
    .create({
      component: PromiseFilterPopover,
      componentProps: {
        value: getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE").fieldValue
      },
      event: ev,
      translucent: true,
      showBackdrop: true
    })

  popover.onDidDismiss().then((result: any) => {
    if(result.data?.duration || result.data?.duration == 0) {
      getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE").fieldValue = result.data?.isPastDuration ? `-${result.data?.duration}` : result.data?.duration
      hasUnsavedChanges.value = true
    }
    getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE").operator = "less-equals"
  })

  return popover.present();
}

async function selectValue(id: string, header: string) {
  const filter = getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, id)
  const valueAlert = await alertController.create({
    header,
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save")
    }],
    inputs: [{
      name: "value",
      placeholder: translate("value"),
      value: filter.fieldValue
    }]
  })

  valueAlert.onDidDismiss().then(async (result: any) => {
    const value = result.data?.values?.value;
    // Considering that when having role in result, its negative action and not need to do anything
    if(!result.role && value) {
      filter.fieldValue = value
      // When selecting a filter value making the operator to default `equals` if not present already
      // For proximity filter we need to have less-equals as operator
      filter.operator = (id === "PROXIMITY" ? "less-equals" : filter.operator || "equals")
      updateRule()
    }
  })

  return valueAlert.present();
}

function updateOperator(event: CustomEvent) {
  getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, "BRK_SAFETY_STOCK").operator = event.detail.value
  updateRule()
}

function updateOrderFilterValue(event: CustomEvent, id: string, multi = false) {
  let value = event.detail.value
  let operator = "equals"
  // When the filter has multiple selection support then we will receive an array in the event value and thus creating a string before updating the same as the fieldValue supports a string as value
  if(multi && value.length > 1) {
    value = value.join(',')
    operator = "in"
  } else if(multi) {
    // When filter is having a single option selected with multiple selection enabled, we will receive an array with single value, but as we need to pass a string, so fetching the 0th index from the array
    value = value[0]
  }

  orderRoutingFilterOptions.value[ruleEnums[id].code].fieldValue = value
  orderRoutingFilterOptions.value[ruleEnums[id].code].operator = operator
  hasUnsavedChanges.value = true
}

function updateRuleFilterValue(event: CustomEvent, id: string) {
  inventoryRuleFilterOptions.value[conditionFilterEnums[id].code].fieldValue = event.detail.value
  updateRule()
}

function clearAutoCancelDays(checked: any) {
  if(inventoryRuleActions.value[actionEnums["RM_AUTO_CANCEL_DATE"].id]) {
    inventoryRuleActions.value[actionEnums["RM_AUTO_CANCEL_DATE"].id].actionValue = checked
  } else {
    inventoryRuleActions.value = {
      ...inventoryRuleActions.value,
      [actionEnums["RM_AUTO_CANCEL_DATE"].id]: {
        actionValue: checked,
        actionTypeEnumId: actionEnums["RM_AUTO_CANCEL_DATE"].id,
        createdDate: DateTime.now().toMillis()
      }
    }
  }

  updateRule()
}

// Updating rule status
function updateRuleStatus(event: CustomEvent, routingRuleId: string) {
  inventoryRules.value.map((inventoryRule: any) => {
    if(inventoryRule.routingRuleId === routingRuleId) {
      inventoryRule.statusId = event.detail.value
    }
  })
  hasUnsavedChanges.value = true
}

async function editRuleName() {
  isRuleNameUpdating.value = !isRuleNameUpdating.value;
  // Waiting for DOM updations before focus inside the text-area, as it is conditionally rendered in the DOM
  await nextTick()
  ruleNameRef.value.$el.setFocus();
}

function updateRuleName(routingRuleId: string) {
  // Checking the updated name with the original object, as we have reference to inventoryRules that will also gets updated on updating selectedRoutingRule
  currentRouting.value["rules"].map((inventoryRule: any) => {
    if(inventoryRule.routingRuleId === routingRuleId && inventoryRule.ruleName.trim() !== selectedRoutingRule.value.ruleName.trim()) {
      hasUnsavedChanges.value = true
    }
  })
  isRuleNameUpdating.value = false;
}

async function cloneRule() {
  emitter.emit("presentLoader", { message: `Cloning ${selectedRoutingRule.value.ruleName}`, backdropDismiss: false })

  try {
    const resp = await OrderRoutingService.cloneRule({
      routingRuleId: selectedRoutingRule.value.routingRuleId,
      newOrderRoutingId: props.orderRoutingId,
      newRuleName: `${selectedRoutingRule.value.ruleName} copy`
    })

    if(hasError(resp) || !resp.data.newRoutingRuleId) {
      throw resp.data
    }

    await store.dispatch("orderRouting/fetchCurrentOrderRouting", props.orderRoutingId)
  } catch (err) {
    logger.error(err)
    showToast(translate("Failed to clone rule"))
  }

  emitter.emit("dismissLoader")
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

  // considering that on reordering there is some change in the order
  hasUnsavedChanges.value = true
}

function doConditionSortReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(Object.values(inventoryRuleSortOptions.value)))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(Object.values(inventoryRuleSortOptions.value))));

  const updatedSeqenceNum = Object.keys(previousSeq).map((filter: any) => previousSeq[filter].sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  inventoryRuleSortOptions.value = updatedSeq.reduce((filters: any, filter: any) => {
    filters[filter.fieldName] = filter
    return filters
  }, {})

  updateRule()
}

function findRulesDiff(previousSeq: any, updatedSeq: any) {
  const diffSeq: any = Object.keys(previousSeq).reduce((diff, key) => {
    if (updatedSeq[key].routingRuleId === previousSeq[key].routingRuleId && updatedSeq[key].statusId === previousSeq[key].statusId && updatedSeq[key].assignmentEnumId === previousSeq[key].assignmentEnumId && updatedSeq[key].ruleName === previousSeq[key].ruleName) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, {})
  return diffSeq;
}

function findSortDiff(previousSeq: any, updatedSeq: any) {
  let seqToUpdate = {} as any
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

  // Updated the keys of the object as there are some cases in which the field is same for both filter and sort options thus causing issue when doing same kind operation (addtion or deletion) of fields
  seqToUpdate = Object.keys(seqToUpdate).reduce((updatedSeq: any, key) => {
    updatedSeq[key + '_sort'] = seqToUpdate[key]
    return updatedSeq
  }, {})

  seqToRemove = Object.keys(seqToRemove).reduce((updatedSeq: any, key) => {
    updatedSeq[key + '_sort'] = seqToRemove[key]
    return updatedSeq
  }, {})

  return { seqToUpdate, seqToRemove };
}

function findFilterDiff(previousSeq: any, updatedSeq: any) {
  let seqToUpdate = {} as any
  let seqToRemove = {} as any

  seqToUpdate = Object.keys(previousSeq).reduce((diff, key) => {
    if(!updatedSeq[key]) {
      seqToRemove[key] = previousSeq[key]
      return diff
    }

    // Not using strict equality comparison for fieldValue as for some filters the type of value returned from server and the updated value from the app will not be the same(ex. Promise date filter)
    if (updatedSeq[key].fieldName === previousSeq[key].fieldName && updatedSeq[key].fieldValue == previousSeq[key].fieldValue && updatedSeq[key].operator === previousSeq[key].operator) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, seqToUpdate)

  seqToUpdate = Object.keys(updatedSeq).reduce((diff, key) => {
    // Added fieldValue check as we have considered that when adding a filter option, it should always have a value, and added check for zero, as in some filters value as 0 is possible
    if(!previousSeq[key] && (updatedSeq[key].fieldValue || updatedSeq[key].fieldValue === 0)) {
      diff = {
        ...diff,
        [key]: updatedSeq[key]
      }
    }

    return diff
  }, seqToUpdate)

  // Updated the keys of the object as there are some cases in which the field is same for both filter and sort options thus causing issue when doing same kind operation (addtion or deletion) of fields
  seqToUpdate = Object.keys(seqToUpdate).reduce((updatedSeq: any, key) => {
    updatedSeq[key + '_filter'] = seqToUpdate[key]
    return updatedSeq
  }, {})

  seqToRemove = Object.keys(seqToRemove).reduce((updatedSeq: any, key) => {
    updatedSeq[key + '_filter'] = seqToRemove[key]
    return updatedSeq
  }, {})

  return { seqToUpdate, seqToRemove };
}

function findActionDiff(previousSeq: any, updatedSeq: any) {
  let seqToUpdate = {}
  let seqToRemove = {} as any

  seqToUpdate = Object.keys(previousSeq).reduce((diff, key) => {
    if(!updatedSeq[key]) {
      seqToRemove[key] = previousSeq[key]
      return diff
    }

    // Not using strict equality comparison for actionValue as for some filters the type of value returned from server and the updated value from the app will not be the same.
    if (updatedSeq[key].actionTypeEnumId === previousSeq[key].actionTypeEnumId && updatedSeq[key].actionValue == previousSeq[key].actionValue) return diff
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

function doReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(inventoryRules.value))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(inventoryRules.value)));

  let diffSeq = findRulesDiff(previousSeq, updatedSeq)

  const updatedSeqenceNum = previousSeq.map((rule: Rule) => rule.sequenceNum)
  Object.keys(diffSeq).map((key: any) => {
    diffSeq[key].sequenceNum = updatedSeqenceNum[key]
  })

  diffSeq = Object.keys(diffSeq).map((key) => diffSeq[key])

  inventoryRules.value = updatedSeq
  hasUnsavedChanges.value = true
}

async function save() {
  emitter.emit("presentLoader", { message: "Updating inventory rules and filters", backdropDismiss: false })
  const orderRouting = {
    orderRoutingId: props.orderRoutingId,
    routingGroupId: currentRouting.value.routingGroupId
  } as any

  // Check if the status of currentRouting is changed, if yes then update the status for routing
  if(currentRouting.value.statusId !== routingStatus.value) {
    orderRouting["statusId"] = routingStatus.value
  }

  // Find diff for inventory rules
  if(currentRouting.value["rules"]) {
    let diffSeq = findRulesDiff(currentRouting.value["rules"], inventoryRules.value)
  
    const updatedSeqenceNum = currentRouting.value["rules"].map((rule: Rule) => rule.sequenceNum)
    Object.keys(diffSeq).map((key: any) => {
      diffSeq[key].sequenceNum = updatedSeqenceNum[key]
    })
  
    diffSeq = Object.keys(diffSeq).map((key) => diffSeq[key])
  
    if(diffSeq.length) {
      orderRouting["rules"] = diffSeq
    }
  }
  // Inventory rules diff calculated

  // Find order filters diff
  const initialOrderFilters = currentRouting.value["orderFilters"]?.length ? currentRouting.value["orderFilters"].reduce((filters: any, filter: any) => {
    if(filters[filter.conditionTypeEnumId]) {
      filters[filter.conditionTypeEnumId][filter.fieldName] = filter
    } else {
      filters[filter.conditionTypeEnumId] = {
        [filter.fieldName]: filter
      }
    }
    return filters
  }, {}) : {}

  const routeSortOptionsDiff = findSortDiff(initialOrderFilters["ENTCT_SORT_BY"] ? initialOrderFilters["ENTCT_SORT_BY"] : {}, orderRoutingSortOptions.value)
  const routeFilterOptionsDiff = findFilterDiff(initialOrderFilters["ENTCT_FILTER"] ? initialOrderFilters["ENTCT_FILTER"] : {}, orderRoutingFilterOptions.value)

  const filtersToRemove = Object.values({ ...routeFilterOptionsDiff.seqToRemove, ...routeSortOptionsDiff.seqToRemove })
  const filtersToUpdate = Object.values({ ...routeFilterOptionsDiff.seqToUpdate, ...routeSortOptionsDiff.seqToUpdate })
  // Diff found for removing and updating filters

  if(filtersToRemove?.length) {
    await store.dispatch("orderRouting/deleteRoutingFilters", { filters: filtersToRemove, orderRoutingId: props.orderRoutingId })

    // TODO: check when to update the filters in state, currently not updating and fetching the records again, as when creating new filter we get conditionSeqId from response, but we can't add it in the state
    // if(isSuccess) {
    //   await store.dispatch("orderRouting/setCurrentOrderRouting", { ...currentRouting.value, orderFilters: Object.values({ ...orderRoutingFilterOptions.value, ...orderRoutingSortOptions.value }) })
    // }
  }

  if(filtersToUpdate?.length || orderRouting["rules"]?.length || orderRouting.statusId) {
    orderRouting["orderFilters"] = filtersToUpdate
    const orderRoutingId = await store.dispatch("orderRouting/updateRouting", orderRouting)

    if(orderRoutingId) {
      await store.dispatch("orderRouting/setCurrentOrderRouting", { ...currentRouting.value, orderFilters: Object.values({ ...orderRoutingFilterOptions.value, ...orderRoutingSortOptions.value }) })
    }
  }

  const initialInventoryRulesInformation = JSON.parse(JSON.stringify(routingRules.value))

  // Whenever we will be having a feature to delete a rule then this logic needs updation
  const rulesDiff = Object.keys(initialInventoryRulesInformation).map((ruleId: string) => {
    const previousRuleSortOptions = initialInventoryRulesInformation[ruleId]["inventoryFilters"]?.["ENTCT_SORT_BY"] ? initialInventoryRulesInformation[ruleId]["inventoryFilters"]["ENTCT_SORT_BY"] : {}
    const updatedRuleSortOptions = rulesInformation.value[ruleId]["inventoryFilters"]?.["ENTCT_SORT_BY"] ? rulesInformation.value[ruleId]["inventoryFilters"]["ENTCT_SORT_BY"] : {}
    const sortOptionsDiff = findSortDiff(previousRuleSortOptions, updatedRuleSortOptions)

    const previousRuleFilterOptions = initialInventoryRulesInformation[ruleId]["inventoryFilters"]?.["ENTCT_FILTER"] ? initialInventoryRulesInformation[ruleId]["inventoryFilters"]["ENTCT_FILTER"] : {}
    const updatedRuleFilterOptions = rulesInformation.value[ruleId]["inventoryFilters"]?.["ENTCT_FILTER"] ? rulesInformation.value[ruleId]["inventoryFilters"]["ENTCT_FILTER"] : {}
    const filterOptionsDiff = findFilterDiff(previousRuleFilterOptions, updatedRuleFilterOptions)

    const previousRuleActionOptions = initialInventoryRulesInformation[ruleId]["actions"] ? initialInventoryRulesInformation[ruleId]["actions"] : {}
    const updatedRuleActionOptions = rulesInformation.value[ruleId]["actions"] ? rulesInformation.value[ruleId]["actions"] : {}
    const ruleActionsDiff = findActionDiff(previousRuleActionOptions, updatedRuleActionOptions)

    return {
      routingRuleId: ruleId,
      orderRoutingId: props.orderRoutingId,
      filtersToRemove: Object.values({ ...filterOptionsDiff.seqToRemove, ...sortOptionsDiff.seqToRemove }),
      filtersToUpdate: Object.values({ ...filterOptionsDiff.seqToUpdate, ...sortOptionsDiff.seqToUpdate }),
      actionsToRemove: Object.values(ruleActionsDiff.seqToRemove),
      actionsToUpdate: Object.values(ruleActionsDiff.seqToUpdate)
    }
  })

  for(const key in rulesDiff) {
    const rule = rulesDiff[key]
    
    if(rule.filtersToRemove?.length) {
      await store.dispatch("orderRouting/deleteRuleConditions", { routingRuleId: rule.routingRuleId, conditions: rule.filtersToRemove })
    }

    if(rule.actionsToRemove?.length) {
      await store.dispatch("orderRouting/deleteRuleActions", { routingRuleId: rule.routingRuleId, actions: rule.actionsToRemove })
    }

    if(rule.filtersToUpdate?.length || rule.actionsToUpdate?.length) {
      await store.dispatch("orderRouting/updateRule", {
        routingRuleId: rule.routingRuleId,
        orderRoutingId: rule.orderRoutingId,
        inventoryFilters: rule.filtersToUpdate,
        actions: rule.actionsToUpdate
      })
    }
  }

  await store.dispatch("orderRouting/fetchCurrentOrderRouting", props.orderRoutingId)
  if(currentRouting.value["orderFilters"]?.length) {
    initializeOrderRoutingOptions()
  }

  // Added check to not fetch any rule related information as when a new route will be created no rule will be available thus no need to fetch any other information
  if(currentRouting.value["rules"]?.length) {
    inventoryRules.value = sortSequence(JSON.parse(JSON.stringify(currentRouting.value["rules"])))
    // Passed true as when updating an existing rule we get seqIds in the response so to fetch the latest seqIds for the rule calling rule api again by passing true
    // TODO: Need to update this logic by just updating the state instead of making an api call, this can also be handled when in the update api call we will get latest information again
    await fetchRuleInformation(currentRuleId.value, true);
  }

  hasUnsavedChanges.value = false
  emitter.emit("dismissLoader")
}

function updatePartialGroupItemsAllocation(checked: boolean) {
  if(inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code]){
    inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code].fieldValue = checked ? 'Y' : 'N'
  } else {
    inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code] = {
      routingRuleId: selectedRoutingRule.value.routingRuleId,
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: conditionFilterEnums["SPLIT_ITEM_GROUP"].code,
      fieldValue: checked ? "Y" : "N",
      sequenceNum: Object.keys(inventoryRuleFilterOptions.value).length && inventoryRuleFilterOptions.value[Object.keys(inventoryRuleFilterOptions.value)[Object.keys(inventoryRuleFilterOptions.value).length - 1]]?.sequenceNum >= 0 ? inventoryRuleFilterOptions.value[Object.keys(inventoryRuleFilterOptions.value)[Object.keys(inventoryRuleFilterOptions.value).length - 1]].sequenceNum + 5 : 0,
      createdDate: DateTime.now().toMillis()
    }
  }
  updateRule()
}

function isPartialGroupItemsAllocationActive() {
  return inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code]?.fieldValue === 'Y';
}
</script>

<style scoped>
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

ion-content > main, #inventory-rules {
  display: grid;
  grid-template-columns: minmax(375px, 25%) 1fr;
  height: 100%;
}

.menu {
  border-right: 1px solid var(--ion-color-medium);
}

#inventory-sequence {
  text-align: center;
}

ion-chip > ion-select {
  /* Adding min-height as auto-styling is getting appLied when not using legacy select option */
  min-height: unset;
}

.empty-state {
  text-align: center;
}
</style>
