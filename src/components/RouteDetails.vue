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
            <ion-label slot="end" class="label-with-icon">
              {{ getStatusDesc(routing.statusId) }}
              <ion-icon v-if="unmatchedRoutingProperties['statusId']" :icon="warningOutline" color="danger"></ion-icon>
            </ion-label>
          </ion-item>
          <ion-item lines="full">
            <ion-icon :icon="timeOutline" slot="start" />
            <ion-label>{{ translate("Last run") }}</ion-label>
            <ion-chip outline @click.stop="openRoutingHistoryModal()">
              <ion-label>{{ routingHistory[routing.orderRoutingId] ? getDateAndTimeShort(routingHistory[routing.orderRoutingId][0].startDate) : translate("No run history") }}</ion-label>
            </ion-chip>
          </ion-item>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Filters") }}</ion-label>
            </ion-item-divider>
            <p class="empty-state" v-if="!routing.filtersCount">
              {{ translate("All orders in all parkings will be attempted if no filter is applied.") }}
            </p>
            <OrderFilterItem
              v-for="option in filterOptions"
              :key="option.enumId"
              :enumId="option.enumId"
              :code="option.code"
              :label="option.label"
              :routing="routing"
              :unmatchedRoutingProperties="unmatchedRoutingProperties"
            />
          </ion-item-group>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Sort") }}</ion-label>
            </ion-item-divider>
            <!-- Added check for undefined as well as empty object, as on initial load there might be a case in which route sorting options are not available thus it will be undefined but when updating the values from the modal this will always return an object -->
            <p class="empty-state" v-if="!routing.sortCount">
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
import { arrowBackOutline, pulseOutline, timeOutline, warningOutline } from "ionicons/icons"
import { computed, defineProps } from "vue"
import RoutingHistoryModal from "./RoutingHistoryModal.vue";
import { getDateAndTimeShort } from "@/utils";
import OrderFilterItem from "./OrderFilterItem.vue";

const props = defineProps({
  routing: {
    type: Object,
    required: true
  },
  group: {
    type: Object,
    required: true
  },
  unmatchedRoutingProperties: {
    type: Object,
    required: true
  }
})

const ruleEnums = JSON.parse(process.env?.VUE_APP_RULE_ENUMS as string)
const filterOptions = [{
  enumId: "PROD_CATEGORY",
  code: "productCategoryId",
  label: "Product Category"
}, {
  enumId: "QUEUE",
  code: "facilityId",
  label: "Queue"
}, {
  enumId: "PROD_CATEGORY_EXCLUDED",
  code: "productCategoryId",
  label: "Product Category"
}, {
  enumId: "QUEUE_EXCLUDED",
  code: "facilityId",
  label: "Queue"
}, {
  enumId: "SHIPPING_METHOD",
  code: "shipmentMethodTypeId",
  label: "Shipping method"
}, {
  enumId: "SHIPPING_METHOD_EXCLUDED",
  code: "shipmentMethodTypeId",
  label: "Shipping method"
}, {
  enumId: "PRIORITY",
  code: "priority",
  label: "Order priority"
}, {
  enumId: "PRIORITY_EXCLUDED",
  code: "priority",
  label: "Order priority"
}, {
  enumId: "PROMISE_DATE",
  code: "promiseDaysCutoff",
  label: "Promise date"
}, {
  enumId: "PROMISE_DATE_EXCLUDED",
  code: "promiseDaysCutoff",
  label: "Promise date"
}, {
  enumId: "SALES_CHANNEL",
  code: "salesChannelEnumId",
  label: "Sales Channel"
}, {
  enumId: "SALES_CHANNEL_EXCLUDED",
  code: "salesChannelEnumId",
  label: "Sales Channel"
}, {
  enumId: "ORIGIN_FACILITY_GROUP",
  code: "originFacilityGroupId",
  label: "Origin Facility Group"
}, {
  enumId: "ORIGIN_FACILITY_GROUP_EXCLUDED",
  code: "originFacilityGroupId",
  label: "Origin Facility Group"
}]

const enums = computed(() => store.getters["util/getEnums"])
const facilities = computed(() => store.getters["util/getVirtualFacilities"])
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])
const facilityGroups = computed(() => store.getters["util/getFacilityGroups"])
const routingHistory = computed(() => store.getters["orderRouting/getRoutingHistory"])
const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))

function getRouteIndex() {
  const total = props.group["routings"]?.length
  const currentRouteIndex: any = props.group["routings"] ? Object.keys(props.group["routings"]).find((key: any) => props.group["routings"][key].orderRoutingId === props.routing.orderRoutingId) : 0

  // adding one (1) as currentRouteIndex will have the index based on array, and used + as currentRouteIndex is a string
  return `${+currentRouteIndex + 1}/${total}`
}

function getLabel(parentType: string, code: string) {
  const enumerations = enums.value[parentType]
  const enumInfo: any = enumerations ? Object.values(enumerations).find((enumeration: any) => enumeration.enumCode === code) : null

  return enumInfo?.description
}

async function openRoutingHistoryModal() {
  await store.dispatch("orderRouting/fetchRoutingHistory", props.group.routingGroupId)
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