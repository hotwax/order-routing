<template>
  <div class="ion-margin">
    <template v-if="!testRoutingInfo.currentOrderId">
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
      <p class="ion-text-center" v-else-if="!testRoutingInfo.errorMessage">{{ translate("Enter order id, product id or customer name to search") }}</p>
    </template>
    <template v-else>
      <div class="order-test-header">
        <ion-item lines="none">
          <ion-label slot="start">
            <h1>{{ testRoutingInfo.currentOrder.orderName }}</h1>
            <p>{{ testRoutingInfo.currentOrder.orderId }}</p>
          </ion-label>
        </ion-item>
        <ion-item lines="none" button @click="updateCurrentOrder()">
          <ion-label>{{ translate("Try another order") }}</ion-label>
          <ion-icon :icon="searchOutline"/>
        </ion-item>
      </div>

      <ion-row>
        <ion-chip v-for="(shipGroup, shipGroupSeqId, index) in testRoutingInfo.currentOrder.groups" :key="shipGroupSeqId" @click="updateCurrentShipGroupId(shipGroupSeqId, shipGroup)" :outline="testRoutingInfo.currentShipGroupId !== shipGroupSeqId">
          {{ index + 1 }}: {{ shipGroup[0].facilityName || shipGroup[0].facilityId }}
        </ion-chip>
      </ion-row>

      <div class="ship-groups ion-margin">
        <div class="order-group">
          <ion-button class="ion-margin-horizontal" v-if="testRoutingInfo.isOrderBrokered || testRoutingInfo.isOrderAlreadyBrokered" @click="resetOrder()">
            <ion-icon slot="start" :icon="arrowUndoOutline" />
            {{ translate("Reset order") }}
          </ion-button>
          <ion-card class="order-items" v-if="currentShipGroup[0]?.shipGroupSeqId">
            <ion-item v-if="testRoutingInfo.brokeringDecisionReason">
              <ion-label>
                {{ testRoutingInfo.brokeringDecisionReason }}
              </ion-label>
            </ion-item>
            <ion-item v-if="currentShipGroup[0]?.shipmentMethodTypeId || currentShipGroup[0]?.carrierPartyId">
              <ion-label>
                {{ shippingMethods[currentShipGroup[0].shipmentMethodTypeId]?.description || currentShipGroup[0].shipmentMethodTypeId }}
                <p>{{ carriers[currentShipGroup[0].carrierPartyId]?.name || currentShipGroup[0].carrierPartyId }}</p>
              </ion-label>
              <ion-note slot="end" v-if="carriers[currentShipGroup[0].carrierPartyId]?.deliveryDays?.[currentShipGroup[0].shipmentMethodTypeId]">{{ carriers[currentShipGroup[0].carrierPartyId]?.deliveryDays?.[currentShipGroup[0].shipmentMethodTypeId] }} {{ translate("days") }}</ion-note>
            </ion-item>
            <ion-item v-for="item in currentShipGroup" :key="item.orderItemSeqId">
              <ion-thumbnail slot="start">
                <Image :src="getProduct(item.productId).mainImageUrl"/>
              </ion-thumbnail>
              <ion-label>
                {{ getProduct(item.productId).productName }}
                <p v-if="getProduct(item.productId)[productIdentifier.primary]">{{ getProduct(item.productId)[productIdentifier.primary] }}</p>
                <p v-if="productIdentifier.secondary && getProduct(item.productId)[productIdentifier.secondary]">{{ getProduct(item.productId)[productIdentifier.secondary] }}</p>
                <p v-if="testRoutingInfo.isOrderBrokered">{{ getProductStock(item.productId, item.facilityId).availableToPromiseTotal || "-" }} {{ translate("ATP") }}{{ " | " }}{{ getProductStock(item.productId, item.facilityId).quantityOnHandTotal || "-" }} {{ translate("QOH") }}</p>
              </ion-label>
              <ion-badge slot="end" :color="getColorByDesc(item.orderItemStatusDesc)">{{ item.orderItemStatusDesc }}</ion-badge>
            </ion-item>
          </ion-card>
          <ion-button v-if="!(testRoutingInfo.isOrderBrokered || testRoutingInfo.isOrderAlreadyBrokered) && currentShipGroup[0]?.shipGroupSeqId && !testRoutingInfo.errorMessage" @click="brokerOrder()">
            <ion-icon slot="start" :icon="compassOutline" />
            {{ translate("Broker Order") }}
          </ion-button>
        </div>
      </div>
    </template>
    <p v-if="testRoutingInfo.errorMessage" class="ion-text-center">{{ testRoutingInfo.errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { alertController, IonBadge, IonButton, IonCard, IonChip, IonIcon, IonItem, IonLabel, IonList, IonNote, IonRow, IonSearchbar, IonThumbnail } from "@ionic/vue";
import { arrowUndoOutline, compassOutline, searchOutline } from "ionicons/icons"
import { computed, defineProps, onMounted, ref } from "vue";
import store from "@/store";
import { getColorByDesc, hasError, showToast } from "@/utils";
import logger from "@/logger";
import { translate } from "@/i18n";
import { OrderRoutingService } from "@/services/RoutingService";
import Image from "@/components/Image.vue"
import emitter from "@/event-bus";

const props = defineProps({
  routingRuleId: {
    type: String,
    default: ""
  },
  orderRoutingId: {
    type: String,
    default: ""
  },
  routingGroupId: {
    type: String,
    required: true
  },
  routingGroup: {
    type: Object
  },
  orderRoutingFilterOptions: {
    required: false
  },
  userTestingSession: {
    default: {},
    required: false
  }
})

onMounted(() => {
  if(testRoutingInfo.value.currentOrderId) {
    searchOrders(testRoutingInfo.value.currentOrderId);
    getOrderBrokeringInfo()
  }
})

let queryString = ref("")
let orders = ref([]) as any

const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])
const currentShipGroup = computed(() => testRoutingInfo.value.currentShipGroupId ? testRoutingInfo.value.currentOrder.groups[testRoutingInfo.value.currentShipGroupId] : [])
const carriers = computed(() => store.getters["util/getCarriers"])
const facilities = computed(() => store.getters["util/getPhysicalFacilities"])
const virtualFacilities = computed(() => store.getters["util/getVirtualFacilities"])
const getProduct = computed(() => (id: string) => store.getters["product/getProductById"](id)) as any
const getProductStock = computed(() => (productId: string, facilityId: string) => store.getters["product/getProductStock"](productId, facilityId)) as any
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])
const testRoutingInfo = computed(() => store.getters["orderRouting/getTestRoutingInfo"])
const productIdentifier = computed(() => store.getters["util/getProductIdentifier"])

async function searchOrders(orderId = "") {
  const searchedQuery = orderId ? orderId : queryString.value.trim()
  orders.value = []
  await store.dispatch("orderRouting/updateRoutingTestInfo", [
    { key: "errorMessage", value: "" }
  ])
  if(!searchedQuery) {
    showToast(translate("Enter valid order attribute for searching"))
    return;
  }

  emitter.emit("presentLoader", { message: "Searching orders...", backdropDismiss: false })
  const resp = await OrderRoutingService.findOrder(searchedQuery, orderId) as any;

  if(resp.errorMessage) {
    await store.dispatch("orderRouting/updateRoutingTestInfo", [
      { key: "errorMessage", value: resp.errorMessage }
    ])
  } else {
    orders.value = resp.orders

    // Update the current order if searching is directly performed on orderId
    if(orderId) {
      updateCurrentOrder(resp.orders.find((order: any) => order.orderId === orderId))
    }
  }
  emitter.emit("dismissLoader")
}

async function updateCurrentOrder(order?: any) {
  if(order?.orderId) {
    await store.dispatch("orderRouting/updateRoutingTestInfo", [
      { key: "currentOrder", value: order },
      { key: "currentOrderId", value: order.orderId }
    ])
    // By default select the first shipGroup
    const orderShipGroup: any = Object.values(order.groups)[0]
    updateCurrentShipGroupId(orderShipGroup[0].shipGroupSeqId, orderShipGroup)
    return;
  }

  // If the order is already in brokered state(means not brokered manually), then do not display the reset alert
  if(!testRoutingInfo.value.isOrderAlreadyBrokered && testRoutingInfo.value.brokeringRoute) {
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

  // Passing the value of enabled properties as saved in state, because we do not want to exit the test mode
  // but need to clear the routing test info state
  await store.dispatch("orderRouting/clearRoutingTestInfo", {
    isRuleTestEnabled: testRoutingInfo.value.isRuleTestEnabled,
    isRoutingTestEnabled: testRoutingInfo.value.isRoutingTestEnabled
  })
  // hasUnmatchedFilters.value = false
  return;
}

async function updateCurrentShipGroupId(shipGroupId: any, shipGroup: any) {
  await store.dispatch("orderRouting/updateRoutingTestInfo", [
    { key: "brokeringRoute", value: "" },
    { key: "brokeringRule", value: "" },
    { key: "isOrderAlreadyBrokered", value: false },
    { key: "errorMessage", value: "" },
    { key: "eligibleOrderRoutings", value: [] },
    { key: "selectedRuleId", value: "" },
    { key: "unmatchedOrderFilters", value: [] }
  ])

  if(!shipGroupId) {
    await store.dispatch("orderRouting/updateRoutingTestInfo", [{ key: "currentShipGroupId", value: "" }])
    return;
  }

  const shipGroupFacilityId = shipGroup[0].facilityId
  await store.dispatch("orderRouting/updateRoutingTestInfo", [
    { key: "currentShipGroupId", value: shipGroupId }
  ])
  // hasUnmatchedFilters.value = false

  const isOrderBrokered = facilities.value[shipGroupFacilityId]
  if(isOrderBrokered) {
    await store.dispatch("orderRouting/updateRoutingTestInfo", [
      { key: "isOrderAlreadyBrokered", value: true }
    ])
  } else if(props.orderRoutingId) {
    checkOrderBrokeringPossibility();
  } else {
    getEligibleRoutesForBrokering();
  }
  getOrderBrokeringInfo()
}

function getEligibleRoutesForBrokering() {
  // Defined excluded filters as we are not directly getting information for these params in order, thus for now excluded these when checking for brokering possibility
  // TODO: add support to honor the below excluded filters
  const excludedFilters = ["priority", "promiseDaysCutoff", "originFacilityGroupId", "productCategoryId"]
  const eligibleRoutings = [] as any
  const shipGroup = currentShipGroup.value[0]
  const inactiveRoutings = [] as Array<string>

  props.routingGroup.routings.map((routing: any) => {
    // If the routing if not active, then it won't be used for brokering hence not adding the same in the eligible routings array
    if(routing.statusId !== "ROUTING_ACTIVE") {
      inactiveRoutings.push(routing.orderRoutingId)
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
    store.dispatch("orderRouting/updateRoutingTestInfo", [
      { key: "errorMessage", value: inactiveRoutings.length == props.routingGroup.routings?.length ? "This order will not be brokered in this routing because no route is in active status." : "This order will not be brokered in this routing because of the selected order filters." }
    ])
    return;
  }

  store.dispatch("orderRouting/updateRoutingTestInfo", [
    { key: "eligibleOrderRoutings", value: eligibleRoutings }
  ])
}

function checkOrderBrokeringPossibility() {
  // Defined excluded filters as we are not directly getting information for these params in order, thus for now excluded these when checking for brokering possibility
  // TODO: add support to honor the below excluded filters
  const excludedFilters = ["priority", "promiseDaysCutoff", "originFacilityGroupId", "productCategoryId"]
  const filters = [] as any
  const shipGroup = currentShipGroup.value[0]
  if(props.orderRoutingFilterOptions && Object.keys(props.orderRoutingFilterOptions)) {

    Object.entries(props.orderRoutingFilterOptions).map(([key, value]: any) => {
      if(excludedFilters.includes(key)) {
        return;
      }

      switch(value.operator) {
        case "in":
          !value.fieldValue.split(",").includes(shipGroup[key]) && filters.push(key)
          break;
        case "not-in":
          value.fieldValue.split(",").includes(shipGroup[key]) && filters.push(key)
          break;
        case "equals":
          shipGroup[key] !== value.fieldValue && filters.push(key)
          break;
        case "not-equals":
          shipGroup[key] === value.fieldValue && filters.push(key)
          break;
        default:
          filters.push(key)
      }
    })

    if(filters.length) {
      // hasUnmatchedFilters.value = true
      store.dispatch("orderRouting/updateRoutingTestInfo", [
        { key: "errorMessage", value: "This order will not be brokered in this routing because of the selected order filters."},
        { key: "unmatchedOrderFilters", value: filters }
      ])
    }
  }
}

async function brokerOrder() {
  emitter.emit("presentLoader", { message: "Brokering order...", backdropDismiss: false })
  try {
    const payload = {
      routingGroupId: props.routingGroupId,
      orderId: testRoutingInfo.value.currentOrderId,
      shipGroupSeqId: testRoutingInfo.value.currentShipGroupId,
      productStoreId: currentEComStore.value.productStoreId,
      testDriveSessionId: (props.userTestingSession as any)?.userSessionId
    } as any

    if(props.orderRoutingId) {
      payload["orderRoutingId"] = props.orderRoutingId
    }

    if(props.routingRuleId) {
      payload["routingRuleId"] = props.routingRuleId
    }

    let resp = await OrderRoutingService.brokerOrder(payload)

    // If group has attempted the brokering for the order then it means brokering is success, otherwise displaying the error message
    if(!hasError(resp) && resp.data.attemptedItemCount) {
      getOrderBrokeringInfo(true);
    } else {
      throw resp.data;
    }
  } catch(err) {
    await store.dispatch("orderRouting/updateRoutingTestInfo", [
      {
        key: "errorMessage",
        value: props.routingRuleId ? "No inventory was found for this order in this rule." : props.orderRoutingId ? "This order doesn’t qualify to be brokered by this batch. Try adjusting the order filters in this batch." : "This order doesn’t qualify to be brokered by any of the batches in this run. Try adjusting the order filters in the batches."
      }
    ])
    logger.error(err)
  }

  await store.dispatch("orderRouting/updateRoutingTestInfo", [
    { key: "eligibleOrderRoutings", value: [] }
  ])

  emitter.emit("dismissLoader")
}

async function getOrderBrokeringInfo(updateOrderInfo = false) {
  // TODO: add support to pass orderItemSeqId when fetching recent brokering info
  const payload = {
    orderId: testRoutingInfo.value.currentOrderId,
    orderItemSeqId: currentShipGroup.value[0].orderItemSeqId
  }

  try {
    let resp = await OrderRoutingService.getRecentOrderFacilityChangeInfo(payload)

    const orderBrokeringInfo = resp.data?.routingHistoryList?.find((history: any) => history.orderItemSeqId === currentShipGroup.value[0].orderItemSeqId)
    if(!hasError(resp) && orderBrokeringInfo) {
      // TODO: need to update the logic once the broker api returns correct data
      // If the order is brokered by the user then update the order shipGroup info
      if(updateOrderInfo) {
        // Not using solr query to fetch the updated information as solr doc updation is async and thus might take some time to update
        // Adding a new ship group to the order
        testRoutingInfo.value.currentOrder.groups[orderBrokeringInfo.shipGroupSeqId] = testRoutingInfo.value.currentOrder.groups[testRoutingInfo.value.currentShipGroupId].map((item: any) => ({
          ...item,
          fromFacilityId: orderBrokeringInfo.fromFacilityId,
          facilityId: orderBrokeringInfo.facilityId,
          facilityName: facilities.value[orderBrokeringInfo.facilityId]?.facilityName ?? virtualFacilities.value[orderBrokeringInfo.facilityId]?.facilityName,
          shipGroupSeqId: orderBrokeringInfo.shipGroupSeqId
        }))

        // Removing the previous ship group from the order only if the shipGroup is changed
        // As there might be a case where same shipGroup is updated as brokering is not successfull
        if(testRoutingInfo.value.currentShipGroupId !== orderBrokeringInfo.shipGroupSeqId) {
          delete testRoutingInfo.value.currentOrder.groups[testRoutingInfo.value.currentShipGroupId]
        }

        // Updating the value of current ship group with the new ship group
        await store.dispatch("orderRouting/updateRoutingTestInfo", [
          { key: "currentShipGroupId", value: orderBrokeringInfo.shipGroupSeqId },
          { key: "isOrderBrokered", value: true }
        ])
      }

      // TODO: what if the rule brokered the order but after that the rule is updated, this might create confusion
      if(orderBrokeringInfo.routingGroupId === props.routingGroupId) {
        await store.dispatch("orderRouting/updateRoutingTestInfo", [
          { key: "brokeringRoute", value: orderBrokeringInfo.orderRoutingId },
          { key: "brokeringRule", value: orderBrokeringInfo.routingRuleId }
        ])

        if(orderBrokeringInfo.orderRoutingId === props.orderRoutingId || (testRoutingInfo.value.isRuleTestEnabled && orderBrokeringInfo.routingRuleId === props.routingRuleId )) {
          await store.dispatch("orderRouting/updateRoutingTestInfo", [
            { key: "selectedRuleId", value: orderBrokeringInfo.routingRuleId }
          ])
        }
      }

      // If the order is brokered using the selected order routing, then highlight the rule that brokered the order
      // TODO: what if the rule brokered the order but after that the rule is updated, this might create confusion
      // if(orderBrokeringInfo.routingGroupId === props.routingGroupId && orderBrokeringInfo.orderRoutingId === props.orderRoutingId) {
      // }
      store.dispatch("product/fetchStock", testRoutingInfo.value.currentOrder.groups[testRoutingInfo.value.currentShipGroupId])

      await store.dispatch("orderRouting/updateRoutingTestInfo", [
        { key: "brokeringDecisionReason", value: orderBrokeringInfo.comments }
      ])
    } else {
      throw resp.data
    }
  } catch(err) {
    logger.error(err)
    await store.dispatch("orderRouting/updateRoutingTestInfo", [
      { key: "brokeringDecisionReason", value: "No brokering history for this order" }
    ])
  }
}

async function resetOrder() {
  emitter.emit("presentLoader", { message: "Resetting order...", backdropDismiss: false })
  try {
    let resp = await OrderRoutingService.resetOrder({
      orderId: testRoutingInfo.value.currentOrderId,
      notify: false,
      items: currentShipGroup.value.map((item: any) => ({
        facilityId: item.facilityId,
        shipmentMethodTypeId: item.shipmentMethodTypeId,
        quantity: item.quantity,
        orderItemSeqId: item.orderItemSeqId,
        toFacilityId: item.fromFacilityId ?? "_NA_",
        recordVariance: "N",
        rejectReason: "NO_VARIANCE_LOG"
      }))
    })

    // TODO: handle error cases, currently success and error are in the same `messages` property hence having issue in differentiating between the two
    if(!hasError(resp) && resp.data?.rejectedItemsList?.length) {
      await store.dispatch("orderRouting/updateRoutingTestInfo", [
        { key: "brokeringRoute", value: "" },
        { key: "brokeringRule", value: "" },
        { key: "errorMessage", value: "" },
        { key: "selectedRuleId", value: "" },
        { key: "unmatchedOrderFilters", value: [] },
        { key: "isOrderAlreadyBrokered", value: false }
      ])

      await getOrderBrokeringInfo(true);
      await store.dispatch("orderRouting/updateRoutingTestInfo", [
        { key: "isOrderBrokered", value: false }
      ])

      if(props.orderRoutingId) {
        checkOrderBrokeringPossibility();
      } else {
        getEligibleRoutesForBrokering();
      }
    } else {
      throw resp.data;
    }
  } catch(err) {
    showToast(translate("Unable to reset the order"))
    logger.error(err)
  }

  emitter.emit("dismissLoader")
}
</script>

<style scoped>

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
</style>
