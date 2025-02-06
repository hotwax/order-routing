<template>
  <ion-menu menu-id="route-details" content-id="main-content">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-toggle menu="route-details">
            <ion-button>
              <ion-icon slot="icon-only" :icon="arrowBackOutline" />
            </ion-button>
          </ion-menu-toggle>
        </ion-buttons>
        <ion-title>{{ translate("Routing details") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <main>
        <section id="order-filters" class="menu ion-padding-top">
          <ion-item lines="none">
            <ion-label>
              <h1>{{ routing.routingName }}</h1>
            </ion-label>
            <ion-chip slot="end" outline>
              {{ getRouteIndex() }}
            </ion-chip>
          </ion-item>
          <ion-item>
            <ion-icon slot="start" :icon="pulseOutline" />
            <ion-label>{{ translate("Status") }}</ion-label>
            <ion-label slot="end">{{ getStatusDesc(routing.statusId) }}</ion-label>
          </ion-item>
          <ion-item lines="full">
            <ion-icon :icon="timeOutline" slot="start" />
            <ion-label>{{ translate("Last run") }}</ion-label>
            <ion-chip outline @click.stop="openRoutingHistoryModal()">
              <ion-label>{{ routingHistory[routing.orderRoutingId] ? getDateAndTimeShort(routingHistory[routing.orderRoutingId][0].startDate) : "-" }}</ion-label>
            </ion-chip>
          </ion-item>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Filters") }}</ion-label>
            </ion-item-divider>
            <p class="empty-state" v-if="routing.filterConditions && !Object.keys(routing.filterConditions)?.length">
              {{ translate("All orders in all parkings will be attempted if no filter is applied.") }}
            </p>
            <!-- Using hardcoded options for filters, as in filters we have multiple ways of value selection for filters like select, chip -->
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'QUEUE')">
              <ion-label>{{ translate("Queue") }}</ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'QUEUE') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'QUEUE_EXCLUDED')">
              <ion-label>
                {{ translate("Queue") }}
                <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
              </ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'QUEUE_EXCLUDED') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'SHIPPING_METHOD')">
              <ion-label>{{ translate("Shipping method") }}</ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'SHIPPING_METHOD') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED')">
              <ion-label>
                {{ translate("Shipping method") }}
                <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
              </ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'PRIORITY')">
              <ion-label>{{ translate("Order priority") }}</ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'PRIORITY') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'PRIORITY_EXCLUDED')">
              <ion-label>
                {{ translate("Order priority") }}
                <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
              </ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'PRIORITY_EXCLUDED') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'PROMISE_DATE')">
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-chip outline>
                {{ getPromiseDateValue() }}
              </ion-chip>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'PROMISE_DATE_EXCLUDED')">
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-chip outline>
                {{ getPromiseDateValue() }}
              </ion-chip>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'SALES_CHANNEL')">
              <ion-label>{{ translate("Sales Channel") }}</ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'SALES_CHANNEL') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'SALES_CHANNEL_EXCLUDED')">
              <div>
                <ion-label>{{ translate("Sales Channel") }}</ion-label>
                <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
              </div>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'SALES_CHANNEL_EXCLUDED') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'ORIGIN_FACILITY_GROUP')">
              <ion-label>{{ translate("Origin Facility Group") }}</ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'ORIGIN_FACILITY_GROUP') }}</ion-label>
            </ion-item>
            <ion-item v-if="getFilterValue(routing.filterConditions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED')">
              <ion-label>
                {{ translate("Origin Facility Group") }}
                <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
              </ion-label>
              <ion-label slot="end">{{ getSelectedValue(routing.filterConditions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED') }}</ion-label>
            </ion-item>
          </ion-item-group>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Sort") }}</ion-label>
            </ion-item-divider>
            <!-- Added check for undefined as well as empty object, as on initial load there might be a case in which route sorting options are not available thus it will be undefined but when updating the values from the modal this will always return an object -->
            <p class="empty-state" v-if="routing.sortConditions && !Object.keys(routing.sortConditions)?.length">
              {{ translate("Orders will be brokered based on order date if no sorting is specified.") }}
            </p>
            <ion-item v-for="(sort, code) in routing.sortConditions" :key="code">
              <ion-label>{{ getLabel("ORD_SORT_PARAM_TYPE", code) || code }}</ion-label>
            </ion-item>
          </ion-item-group>
        </section>
        <section v-if="routing.rules?.length">
          <ion-list>
            <ion-item class="rule-item" lines="full" v-for="rule in routing.rules" :key="rule.routingRuleId">
              <ion-label>
                <h2>{{ rule.ruleName }}</h2>
                <ion-note :color="rule.statusId === 'RULE_ACTIVE' ? 'success' : rule.statusId === 'RULE_ARCHIVED' ? 'warning' : ''">{{ rule.statusId === "RULE_ACTIVE" ? translate("Active") : rule.statusId === "RULE_ARCHIVED" ? translate("Archived") : translate("Draft") }}</ion-note>
              </ion-label>
            </ion-item>
          </ion-list>
        </section>
        <p class="ion-text-center" v-else>{{ translate("No rules available") }}</p>
      </main>
    </ion-content>
  </ion-menu>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import store from "@/store";
import { IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonMenu, IonMenuToggle, IonNote, IonTitle, IonToolbar, modalController } from "@ionic/vue";
import { arrowBackOutline, pulseOutline, timeOutline } from "ionicons/icons"
import { computed, defineProps } from "vue"
import RoutingHistoryModal from "./RoutingHistoryModal.vue";
import { getDateAndTimeShort } from "@/utils";

const props = defineProps({
  routing: {
    type: Object,
    required: true
  },
  group: {
    type: Object,
    required: true
  }
})

const ruleEnums = JSON.parse(process.env?.VUE_APP_RULE_ENUMS as string)

const enums = computed(() => store.getters["util/getEnums"])
const facilities = computed(() => store.getters["util/getVirtualFacilities"])
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])
const facilityGroups = computed(() => store.getters["util/getFacilityGroups"])
const routingHistory = computed(() => store.getters["orderRouting/getRoutingHistory"])
const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))

function getRouteIndex() {
  // Filtering archived routes as the index and total count needs to calculated by excluding the archived routes
  const activeAndDraftRoute = props.group["routings"]?.filter((routing: any) => routing.statusId !== "ROUTING_ARCHIVED")
  const total = activeAndDraftRoute?.length
  const currentRouteIndex: any = activeAndDraftRoute ? Object.keys(activeAndDraftRoute).find((key: any) => activeAndDraftRoute[key].orderRoutingId === props.routing.orderRoutingId) : 0

  // adding one (1) as currentRouteIndex will have the index based on array, and used + as currentRouteIndex is a string
  return `${+currentRouteIndex + 1}/${total}`
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

function getPromiseDateValue() {
  const value = props.routing.filterConditions?.[ruleEnums["PROMISE_DATE"].code]?.fieldValue
  if(value || value == 0) {
    return value == 0 ? translate("already passed") : value.startsWith("-") ? `${value.replace("-", "")} days passed` : `upcoming in ${value} days`
  }
  return translate("select range")
}

async function openRoutingHistoryModal() {
  await store.dispatch("orderRouting/fetchRoutingHistory", props.routing.routingGroupId)
  const routingHistoryModal = await modalController.create({
    component: RoutingHistoryModal,
    componentProps: { routingHistory: routingHistory.value[props.routing.orderRoutingId], routingName: props.routing.routingName, groupName: props.group.groupName }
  })

  routingHistoryModal.present();
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

ion-content > main {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  height: 100%;
}

.menu {
  border-right: 1px solid var(--ion-color-medium);
}

.empty-state {
  text-align: center;
  margin: 0;
}
</style>