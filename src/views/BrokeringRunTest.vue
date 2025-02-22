<template>
  <ion-page>
    <RouteDetails menu-id="route-details" side="end" :group="currentRoutingGroup" :routing="currentRoute"/>
    <RuleDetails menu-id="rule-details" side="end" :group="group" :rule="currentRule"/>

    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/brokering" />
        </ion-buttons>
        <ion-title>{{ translate("Test drive") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content id="main-content">
      <div>
        <main>
          <section class="route-details">
            <ion-card class="info">
              <div>
                <ion-card-header>
                  <ion-card-title>{{ group.groupName || "" }}</ion-card-title>
                  <ion-card-subtitle>{{ group.routingGroupId }}</ion-card-subtitle>
                </ion-card-header>
                <div class="ion-padding">
                  <ion-button fill="outline" size="small" @click="router.go(-1)">
                    <ion-icon slot="start" :icon="speedometerOutline"/>
                    {{ translate("Exit test mode") }}
                  </ion-button>
                </div>
              </div>
              <div>
                <ion-item>
                  <ion-label>{{ translate("Created at") }}</ion-label>
                  <ion-label slot="end">{{ getDateAndTime(group.createdDate) }}</ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>{{ translate("Updated at") }}</ion-label>
                  <ion-label slot="end">{{ getDateAndTime(group.lastUpdatedStamp) }}</ion-label>
                </ion-item>
                <ion-item lines="none">
                  <ion-icon slot="start" :icon="pulseOutline" />
                  <ion-label>{{ translate("Status") }}</ion-label>
                  <ion-label slot="end">{{ job.paused === "N" ? "Active" : "Draft" }}</ion-label>
                </ion-item>
              </div>
            </ion-card>
            <template v-if="!currentOrder.orderId">
              <ion-searchbar v-model="queryString" @keyup.enter="queryString = $event.target.value; searchOrders()"/>
              <ion-list v-if="orders.length">
                <ion-item v-for="order in orders" :key="order.groupId">
                  <ion-label>
                    {{ order.orderName }}
                    <p>{{ order.orderId }}</p>
                    <p>{{ order.orderStatusDesc }}</p>
                  </ion-label>
                  <ion-button slot="end" fill="outline" @click="updateCurrentOrder(order)">{{ translate("Test Order") }}</ion-button>
                </ion-item>
              </ion-list>
              <!-- Added error message check as in case of no order found we display an error message thus not need to display this helper string -->
              <p class="ion-text-center" v-else-if="!errorMessage">{{ translate("Enter order id, product id or customer name to search") }}</p>
            </template>
            <template v-else>
              <div class="order-test-header">
                <ion-item lines="none">
                  <ion-label slot="start">
                    <h1>{{ currentOrder.orderName }}</h1>
                    <p>{{ currentOrder.orderId }}</p>
                  </ion-label>
                </ion-item>
                <ion-item lines="none" button @click="updateCurrentOrder()">
                  <ion-label>{{ translate("Try another order") }}</ion-label>
                  <ion-icon :icon="searchOutline"/>
                </ion-item>
              </div>

              <ion-row class="ion-margin-start">
                <ion-chip v-for="(shipGroup, shipGroupSeqId, index) in currentOrder.groups" :key="shipGroupSeqId" @click="updateCurrentShipGroupId(shipGroupSeqId, shipGroup)" :outline="currentShipGroupId !== shipGroupSeqId">
                  {{ index + 1 }}: {{ shipGroup[0].facilityName || shipGroup[0].facilityId }}
                </ion-chip>
              </ion-row>

              <div class="ship-groups ion-margin">
                <div class="order-group">
                  <ion-button class="ion-margin-horizontal" v-if="isOrderBrokered" @click="resetOrder()">
                    <ion-icon slot="start" :icon="arrowUndoOutline" />
                    {{ translate("Reset order") }}
                  </ion-button>
                  <ion-card class="order-items" v-if="currentShipGroup[0]?.shipGroupSeqId">
                    <ion-item-divider color="light">
                      <ion-label>{{ currentShipGroup[0].facilityName || currentShipGroup[0].facilityId }}</ion-label>
                    </ion-item-divider>
                    <ion-item v-if="isOrderBrokered && brokeringDecisionReason">
                      <ion-label>
                        {{ brokeringDecisionReason }}
                      </ion-label>
                    </ion-item>
                    <ion-item>
                      <ion-label>
                        {{ shippingMethods[currentShipGroup[0].shipmentMethodTypeId]?.description || currentShipGroup[0].shipmentMethodTypeId }}
                        <p>{{ carriers[currentShipGroup[0].carrierPartyId]?.name || currentShipGroup[0].carrierPartyId }}</p>
                      </ion-label>
                      <ion-note slot="end">{{ carriers[currentShipGroup[0].carrierPartyId]?.deliveryDays?.[currentShipGroup[0].shipmentMethodTypeId] || "-" }}{{ " days" }}</ion-note>
                    </ion-item>
                    <ion-item v-for="item in currentShipGroup" :key="item.orderItemSeqId">
                      <ion-thumbnail slot="start">
                        <Image :src="getProduct(item.productId).mainImageUrl"/>
                      </ion-thumbnail>
                      <ion-label>
                        {{ getProduct(item.productId).productName }}
                        <p v-if="isOrderBrokered">{{ getProductStock(item.productId, item.facilityId).availableToPromiseTotal || "-" }} {{ translate("ATP") }}{{ " | " }}{{ getProductStock(item.productId, item.facilityId).quantityOnHandTotal || "-" }} {{ translate("QOH") }}</p>
                      </ion-label>
                      <ion-badge slot="end">{{ item.orderItemStatusDesc }}</ion-badge>
                    </ion-item>
                  </ion-card>
                  <ion-button v-if="!isOrderBrokered && currentShipGroup[0]?.shipGroupSeqId && !errorMessage" @click="brokerOrder()">
                    <ion-icon slot="start" :icon="compassOutline" />
                    {{ translate("Broker Order") }}
                  </ion-button>
                </div>
              </div>
            </template>
            <p v-if="errorMessage" class="ion-text-center">{{ errorMessage }}</p>
          </section>
          <section class="route-details">
            <ion-list v-if="group.routings?.length">
              <ion-card v-for="(routing, index) in group.routings" :key="routing.orderRoutingId" :class="{ 'selected-rule': eligibleOrderRoutings.includes(routing.orderRoutingId) || brokeringRoute === routing.orderRoutingId }">
                <ion-item lines="full">
                  <ion-label>
                    <h1>{{ routing.routingName }}</h1>
                  </ion-label>
                  <ion-chip outline>{{ `${index + 1}/${group.routings.length}` }}</ion-chip>
                </ion-item>
                <ion-item lines="full" v-if="routing.filtersCount">
                  <ion-label>{{ routing.filtersCount }}{{ " filters" }}</ion-label>
                  <ion-icon :icon="filterOutline" slot="end" />
                </ion-item>
                <ion-item lines="full" v-if="routing.sortCount">
                  <ion-label>{{ routing.sortCount }}{{ " sortings" }}</ion-label>
                  <ion-icon :icon="swapVerticalOutline" slot="end" />
                </ion-item>
                <ion-item lines="none">
                  <ion-badge class="pointer" :color="routing.statusId === 'ROUTING_ACTIVE' ? 'success' : 'medium'">{{ getStatusDesc(routing.statusId) }}</ion-badge>
                  <ion-button fill="clear" slot="end" @click.stop="openRouteDetails(routing)">{{ $t("Details") }}</ion-button>
                </ion-item>
              </ion-card>
            </ion-list>
          </section>
        </main>
        <aside>
          <ion-list>
            <ion-item-group v-for="routing in group.routings" :key="routing.orderRoutingId" class="ion-margin-vertical">
              <ion-item-divider color="light">{{ routing.routingName }}</ion-item-divider>
              <ion-item v-for="rule in routing.rules" :key="rule.routingRuleId" :class="{ 'selected-rule': brokeringRule === rule.routingRuleId }">
                <ion-label>
                  <h2>{{ rule.ruleName }}</h2>
                  <ion-note :color="rule.statusId === 'RULE_ACTIVE' ? 'success' : 'medium'">{{ getStatusDesc(rule.statusId) }}</ion-note>
                </ion-label>
                <ion-button fill="clear" slot="end" @click.stop="openRuleDetails(rule)">{{ translate("Details") }}</ion-button>
              </ion-item>
              <p v-if="!routing.rules?.length" class="ion-text-center">{{ translate("No rules available") }}</p>
            </ion-item-group>
          </ion-list>
        </aside>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonList, IonNote, IonPage, IonRow, IonSearchbar, IonThumbnail, IonTitle, IonToolbar, onIonViewWillEnter, alertController, menuController } from "@ionic/vue";
import { arrowUndoOutline, compassOutline, copyOutline, filterOutline, pulseOutline, searchOutline, speedometerOutline, swapVerticalOutline } from "ionicons/icons"
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps, Ref, ref } from "vue";
import { Group } from "@/types";
import { OrderRoutingService } from "@/services/RoutingService";
import logger from "@/logger";
import { hasError, getDateAndTime, showToast, sortSequence } from "@/utils";
import emitter from "@/event-bus";
import { translate } from "@/i18n";
import Image from "@/components/Image.vue"
import RouteDetails from "@/components/RouteDetails.vue"
import RuleDetails from "@/components/RuleDetails.vue"

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

let group = ref({}) as any
let currentOrder = ref({}) as any
let orders = ref([]) as any
let queryString = ref("")
let errorMessage = ref("")
let currentShipGroupId = ref("")
let isOrderBrokered = ref(false)
let brokeringDecisionReason = ref("")
let eligibleOrderRoutings: Ref<string[]> = ref([])
let brokeringRoute = ref("")
let brokeringRule = ref("")
let currentRoute = ref({})
let currentRule = ref({})
let isOrderAlreadyBrokered = ref(false) // Keeps track whether the order is fetched in the brokered state or not

// TODO: fetch job information for displaying status
let job = ref({}) as any
let orderRoutings = ref([]) as any

const currentRoutingGroup: any = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))
const routingHistory = computed(() => store.getters["orderRouting/getRoutingHistory"])

const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])
const currentShipGroup = computed(() => currentShipGroupId.value ? currentOrder.value.groups[currentShipGroupId.value] : [])
const carriers = computed(() => store.getters["util/getCarriers"])
const facilities = computed(() => store.getters["util/getPhysicalFacilities"])
const virtualFacilities = computed(() => store.getters["util/getVirtualFacilities"])
const getProduct = computed(() => (id: string) => store.getters["product/getProductById"](id)) as any
const getProductStock = computed(() => (productId: string, facilityId: string) => store.getters["product/getProductStock"](productId, facilityId)) as any
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])

onIonViewWillEnter(async () => {
  await fetchRoutingGroupInformation()
  await fetchRoutingsInformation()

  await Promise.all([store.dispatch("util/fetchFacilities"), store.dispatch("util/fetchStatusInformation"), store.dispatch("util/fetchShippingMethods"), store.dispatch("orderRouting/fetchRoutingHistory", props.routingGroupId)])

  orderRoutings.value = currentRoutingGroup.value["routings"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"] : []
})

async function fetchRoutingGroupInformation() {
  emitter.emit("presentLoader", { message: "Fetching information", backdropDismiss: false })

  try {
    const resp = await OrderRoutingService.fetchRoutingGroupInformation(props.routingGroupId);

    if(!hasError(resp) && resp.data) {
      group.value = resp.data
    } else {
      throw resp.data
    }
  } catch(err) {
    logger.error(err);
  }

  if(group.value.routings?.length) {
    group.value.routings = sortSequence(group.value.routings)
  }

  emitter.emit("dismissLoader")
}

async function fetchRoutingsInformation() {
  // TODO: update logic to fetch the routings in parallel
  await group.value.routings.forEach(async (routing: any) => {
    let route = {} as any
    try {
      const resp = await OrderRoutingService.fetchOrderRouting(routing.orderRoutingId);
  
      if(!hasError(resp) && resp.data) {
        route = resp.data
  
        if(route["orderFilters"]?.length) {
          route["orderFilters"].map((filter: any) => {
            if(filter.operator === "not-equals" || filter.operator === "not-in") {
              filter.fieldName += "_excluded"
            }
          })
        }
        
        route["rules"] = route["rules"]?.length ? sortSequence(route["rules"]) : []
        
        routing["orderFilters"] = route["orderFilters"]
        routing["rules"] = route["rules"]

        routing["filterConditions"] = routing["orderFilters"].reduce((filters: any, orderFilter: any) => {
          if(orderFilter.conditionTypeEnumId === "ENTCT_FILTER") {
            filters[orderFilter.fieldName] = orderFilter
          }
          return filters
        }, {})
        routing["sortConditions"] = routing["orderFilters"].reduce((sort: any, orderFilter: any) => {
          if(orderFilter.conditionTypeEnumId === "ENTCT_SORT_BY") {
            sort[orderFilter.fieldName] = orderFilter
          }
          return sort
        }, {})
        routing["filtersCount"] = Object.keys(routing["filterConditions"])?.length
        routing["sortCount"] = Object.keys(routing["sortConditions"])?.length
        routing["rulesCount"] = routing["rules"].length
      } else {
        throw resp.data
      }
    } catch(err) {
      logger.error(err);
    }
  })
}

async function searchOrders() {
  orders.value = []
  errorMessage.value = ""
  if(!queryString.value.trim()) {
    showToast(translate("Enter valid order attribute for searching"))
    return;
  }

  const resp = await OrderRoutingService.findOrder(queryString.value.trim()) as any;

  if(resp.errorMessage) {
    errorMessage.value = resp.errorMessage
  } else {
    orders.value = resp.orders
  }
}

async function updateCurrentOrder(order?: any) {
  if(order?.orderId) {
    currentOrder.value = order
    // By default select the first shipGroup
    const orderShipGroup: any = Object.values(order.groups)[0]
    updateCurrentShipGroupId(orderShipGroup[0].shipGroupSeqId, orderShipGroup)
    return;
  }

  // If the order is already in brokered state, then do not display the reset alert
  if(!isOrderAlreadyBrokered.value && brokeringRoute.value) {
    const alert = await alertController
      .create({
        header: translate("Reset order before leaving"),
        message: translate("Testing an order also allocates it to inventory in the OMS. Make sure to reset tested orders before trying another order or exiting test mode."),
        buttons: [{
          text: translate("Dismiss"),
          role: "cancel"
        }]
      });

    return alert.present();
  }

  queryString.value = ""
  orders.value = []
  currentOrder.value = {}
  currentShipGroupId.value = ""
  isOrderBrokered.value = false
  eligibleOrderRoutings.value = []
  brokeringRoute.value = ""
  brokeringRule.value = ""
  errorMessage.value = ""
  isOrderAlreadyBrokered.value = false
  return;
}

function updateCurrentShipGroupId(shipGroupId: any, shipGroup: any) {
  eligibleOrderRoutings.value = []
  brokeringRoute.value = ""
  brokeringRule.value = ""
  errorMessage.value = ""
  isOrderAlreadyBrokered.value = false

  if(!shipGroupId) {
    currentShipGroupId.value = ""
    return;
  }

  // If the same ship group seq id is clicked again
  if(currentShipGroupId.value === shipGroupId) {
    return;
  }

  currentShipGroupId.value = shipGroupId

  const shipGroupFacilityId = shipGroup[0].facilityId
  isOrderBrokered.value = facilities.value[shipGroupFacilityId]

  // If order is already brokered then fetch the brokering info for order
  if(isOrderBrokered.value) {
    isOrderAlreadyBrokered.value = true
    getOrderBrokeringInfo(!isOrderBrokered.value)
  } else {
    getEligibleRoutesForBrokering();
  }
}

function getEligibleRoutesForBrokering() {
  // Defined excluded filters as we are not directly getting information for these params in order, thus for now excluded these when checking for brokering possibility
  // TODO: add support to honor the below excluded filters
  const excludedFilters = ["priority", "promiseDaysCutoff", "originFacilityGroupId", "productCategoryId"]
  const eligibleRoutings = [] as any
  const shipGroup = currentShipGroup.value[0]

  group.value.routings.map((routing: any) => {
    // If the routing if not active, then it won't be used for brokering hence not adding the same in the eligible routings array
    if(routing.statusId !== "ROUTING_ACTIVE") {
      return
    }

    const orderFilters = routing.orderFilters?.filter((orderFilter: any) => orderFilter.conditionTypeEnumId === "ENTCT_FILTER")

    // If the current routing do not have filters applied it means that this routing will pick all the orders, thus adding such routings in the eligible routing array
    if(!orderFilters?.length) {
      eligibleRoutings.push(routing.orderRoutingId)
      return
    }

    // TODO: we can use some method here
    const matchedFilters = orderFilters.filter((orderFilter: any) => {
      const key = orderFilter.fieldName
      const value = orderFilter.fieldValue

      if(excludedFilters.includes(key)) {
        return true;
      }

      switch(orderFilter.operator) {
        case "in":
          return value.split(",").includes(shipGroup[key])
        case "not-in":
          return !value.split(",").includes(shipGroup[key])
        case "equals":
          return shipGroup[key] === value
        case "not-equals":
          return shipGroup[key] !== value
        default:
          return true
      }
    })

    // If all of the filters are matched and the corresponding route has some rules available
    if(matchedFilters.length === orderFilters.length && routing.rules?.length) {
      eligibleRoutings.push(routing.orderRoutingId)
    }
  })

  if(!eligibleRoutings.length) {
    errorMessage.value = "This order will not be brokered in this routing because of the selected order filters or no route is in active status."
    return;
  }

  eligibleOrderRoutings.value = eligibleRoutings
}

async function brokerOrder() {
  try {
    let resp = await OrderRoutingService.brokerOrder({
      routingGroupId: props.routingGroupId,
      orderId: currentOrder.value.orderId,
      shipGroupSeqId: currentShipGroupId.value,
      productStoreId: currentEComStore.value.productStoreId
    })

    // If group has attempted the brokering for the order then it means brokering is success, otherwise displaying the error message
    if(!hasError(resp) && resp.data.attemptedItemCount) {
      // Removed the eligible routings once the order is brokered
      // eligibleOrderRoutings.value = []
      getOrderBrokeringInfo(true);
    } else {
      throw resp.data;
    }
  } catch(err) {
    errorMessage.value = "Failed to broker order using this group, try with some other group"
    logger.error(err)
  }
  // Removed the eligible routings once the order is either brokered or failed
  eligibleOrderRoutings.value = []
}

async function getOrderBrokeringInfo(updateOrderInfo = false) {
  // TODO: add support to pass orderItemSeqId when fetching recent brokering info
  const payload = {
    orderId: currentOrder.value.orderId,
    orderItemSeqId: currentShipGroup.value[0].orderItemSeqId
  }

  try {
    let resp = await OrderRoutingService.getRecentOrderFacilityChangeInfo(payload)

    const orderBrokeringInfo = resp.data?.routingHistoryList?.find((history: any) => history.orderItemSeqId === currentShipGroup.value[0].orderItemSeqId)
    
    if(!hasError(resp) && orderBrokeringInfo) {
      // TODO: need to update the logic once the broker api returns correct data
      // If the order is brokered by the user then update the order shipGroup info
      if(updateOrderInfo) {
        isOrderBrokered.value = true

        // Not using solr query to fetch the updated information as solr doc updation is async and thus might take some time to update
        // Adding a new ship group to the order
        currentOrder.value.groups[orderBrokeringInfo.shipGroupSeqId] = currentOrder.value.groups[currentShipGroupId.value].map((item: any) => ({
          ...item,
          fromFacilityId: orderBrokeringInfo.fromFacilityId,
          facilityId: orderBrokeringInfo.facilityId,
          facilityName: facilities.value[orderBrokeringInfo.facilityId]?.facilityName ?? virtualFacilities.value[orderBrokeringInfo.facilityId]?.facilityName,
          shipGroupSeqId: orderBrokeringInfo.shipGroupSeqId
        }))

        // Removing the previous ship group from the order only if the shipGroup is changed
        // As there might be a case where same shipGroup is updated as brokering is not successfull
        if(currentShipGroupId.value !== orderBrokeringInfo.shipGroupSeqId) {
          delete currentOrder.value.groups[currentShipGroupId.value]
        }

        // Updating the value of current ship group with the new ship group
        currentShipGroupId.value = orderBrokeringInfo.shipGroupSeqId
      }

      // TODO: what if the rule brokered the order but after that the rule is updated, this might create confusion
      if(orderBrokeringInfo.routingGroupId === props.routingGroupId) {
        brokeringRoute.value = orderBrokeringInfo.orderRoutingId
        brokeringRule.value = orderBrokeringInfo.routingRuleId
      }
      store.dispatch("product/fetchStock", currentOrder.value.groups[currentShipGroupId.value])
      brokeringDecisionReason.value = orderBrokeringInfo.comments
    } else {
      throw resp.data
    }
  } catch(err) {
    logger.error(err)
    errorMessage.value = "Unable to fetch brokering information for this order."
  }
}

async function openRouteDetails(routing: any) {
  currentRoute.value = routing
  await menuController.open("route-details");
}

async function openRuleDetails(rule: any) {
  const ruleInfo = await store.dispatch("orderRouting/fetchInventoryRuleInformation", rule.routingRuleId)
  currentRule.value = {
    ...rule,
    ...ruleInfo
  }
  await menuController.open("rule-details");
}

async function resetOrder() {
  try {
    let resp = await OrderRoutingService.resetOrder({
      orderId: currentOrder.value.orderId,
      notify: false,
      items: currentShipGroup.value.map((item: any) => ({
        facilityId: item.facilityId,
        shipmentMethodTypeId: item.shipmentMethodTypeId,
        quantity: item.quantity,
        orderItemSeqId: item.orderItemSeqId,
        toFacilityId: item.fromFacilityId ?? "_NA_", // TODO: pass the parkingId from where it was released
        recordVariance: "N",
        rejectReason: "NO_VARIANCE_LOG"
      }))
    })

    // TODO: handle error cases, currently success and error are in the same messages property hence having issue in differentiating between the two
    if(!hasError(resp) && resp.data?.rejectedItemsList?.length) {
      brokeringRoute.value = ""
      brokeringRule.value = ""
      errorMessage.value = ""
      await getOrderBrokeringInfo(true);
      isOrderBrokered.value = false;
      getEligibleRoutesForBrokering();
    } else {
      throw resp.data;
    }
  } catch(err) {
    showToast(translate("Unable to reset the order"))
    logger.error(err)
  }
}
</script>

<style scoped>
main {
  display: grid;
  grid-template-columns: 2fr 1fr;
}

ion-content > div {
  display: grid;
  grid-template-columns: 1fr minmax(375px, 25%);
  height: 100%;
}

aside {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-left: 1px solid #92949C;
}

.info {
  grid-column: span 2;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(345px, 1fr));
}

.info > div {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

ion-card > ion-button[expand="block"] {
  margin-inline: var(--spacer-sm);
  margin-bottom: var(--spacer-sm);
}

.order-test-header {
  display: flex;
  width: 100%;
}

.order-test-header > ion-item {
  flex: 1;
}

.empty-state {
  text-align: center;
  margin: 0;
}

.order-items {
  width: 100%;
}

.ship-groups {
  display: grid;
  grid-template-columns: minmax(343px, 25%) 1fr;
}

.order-group {
  justify-items: center;
}

.selected-rule {
  box-shadow: 0px 8px 10px 0px rgba(0, 0, 0, 0.14), 0px 3px 14px 0px rgba(0, 0, 0, 0.12), 0px 4px 5px 0px rgba(0, 0, 0, 0.20);
  scale: 1.03;
  margin-block: var(--spacer-sm);
}

.rule-item {
  transition: .5s all ease;
}
</style>
