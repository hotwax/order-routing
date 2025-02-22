<template>
  <div class="ion-margin">
    <ion-searchbar v-if="!currentOrder.orderId" v-model="queryString" @keyup.enter="queryString = $event.target.value; searchOrders()"/>
    <ion-list v-if="!currentOrder.orderId">
      <ion-item v-for="order in orders" :key="order.groupId">
        <ion-label>
          {{ order.orderName }}
          <p>{{ order.orderId }}</p>
          <p>{{ order.orderStatusDesc }}</p>
        </ion-label>
        <ion-button slot="end" fill="outline" @click="updateCurrentOrder(order)">{{ translate("Test Order") }}</ion-button>
      </ion-item>
    </ion-list>
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

      <ion-row>
        <ion-chip v-for="(shipGroup, shipGroupSeqId, index) in currentOrder.groups" :key="shipGroupSeqId" @click="updateCurrentShipGroupId(shipGroupSeqId, shipGroup)" :outline="currentShipGroupId !== shipGroupSeqId">
          {{ index + 1 }}: {{ shipGroup[0].facilityName || shipGroup[0].facilityId }}
        </ion-chip>
      </ion-row>

      <div class="ship-groups">
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
                <p v-if="isOrderBrokered">{{ getProductStock(item.productId, item.facilityId).availableToPromiseTotal || "-" }}{{ " | " }}{{ getProductStock(item.productId, item.facilityId).quantityOnHandTotal || "-" }}</p>
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
  </div>
</template>

<script setup lang="ts">
import { IonBadge, IonButton, IonCard, IonChip, IonIcon, IonItem, IonItemDivider, IonLabel, IonList, IonNote, IonRow, IonSearchbar, IonThumbnail } from "@ionic/vue";
import { arrowUndoOutline, compassOutline, searchOutline } from "ionicons/icons"
import { computed, defineProps, ref } from "vue";
import store from "@/store";
import { hasError, showToast } from "@/utils";
import logger from "@/logger";
import { translate } from "@/i18n";
import { OrderRoutingService } from "@/services/RoutingService";
import Image from "@/components/Image.vue"
import emitter from "@/event-bus";

const props = defineProps({
  orderRoutingId: {
    type: String,
    required: true
  },
  routingGroupId: {
    type: String,
    required: true
  },
  isRoutingTestEnabled: {
    type: Boolean,
    required: true,
    default: false
  },
  orderRoutingFilterOptions: {
    required: true
  }
})

let queryString = ref("")
let orders = ref([]) as any
let currentOrder = ref({}) as any
let currentShipGroupId = ref("") as any
let errorMessage = ref("")
let brokeringDecisionReason = ref("")
let isOrderBrokered = ref(false)
let hasUnmatchedFilters = ref(false)
let isOrderAlreadyBrokered = ref(false)

const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])
const currentShipGroup = computed(() => currentShipGroupId.value ? currentOrder.value.groups[currentShipGroupId.value] : [])
const carriers = computed(() => store.getters["util/getCarriers"])
const facilities = computed(() => store.getters["util/getPhysicalFacilities"])
const virtualFacilities = computed(() => store.getters["util/getVirtualFacilities"])
const getProduct = computed(() => (id: string) => store.getters["product/getProductById"](id)) as any
const getProductStock = computed(() => (productId: string, facilityId: string) => store.getters["product/getProductStock"](productId, facilityId)) as any
const shippingMethods = computed(() => store.getters["util/getShippingMethods"])

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

function updateCurrentOrder(order?: any) {
  if(order?.orderId) {
    currentOrder.value = order
    // By default select the first shipGroup
    const orderShipGroup: any = Object.values(order.groups)[0]
    updateCurrentShipGroupId(orderShipGroup[0].shipGroupSeqId, orderShipGroup)
    return;
  }

  queryString.value = ""
  orders.value = []
  currentOrder.value = {}
  currentShipGroupId.value = ""
  isOrderBrokered.value = false
  hasUnmatchedFilters.value = false
  emitter.emit("selectedRule", "")
  emitter.emit("updateUnmatchedFilters", []);
  return;
}

function updateCurrentShipGroupId(shipGroupId: any, shipGroup: any) {
  emitter.emit("selectedRule", "")
  emitter.emit("updateUnmatchedFilters", []);
  currentShipGroupId.value = ""
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
  hasUnmatchedFilters.value = false

  // If order is already brokered then fetch the brokering info for order
  if(isOrderBrokered.value) {
    isOrderAlreadyBrokered.value = true
    getOrderBrokeringInfo(!isOrderBrokered.value)
  } else {
    checkOrderBrokeringPossibility();
  }
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
      hasUnmatchedFilters.value = true
      emitter.emit("updateUnmatchedFilters", filters);
      errorMessage.value = "This order will not be brokered in this routing because of the selected order filters."
    }
  }
}

async function brokerOrder() {
  try {
    let resp = await OrderRoutingService.brokerOrder({
      routingGroupId: props.routingGroupId,
      orderRoutingId: props.orderRoutingId,
      orderId: currentOrder.value.orderId,
      shipGroupSeqId: currentShipGroupId.value,
      productStoreId: currentEComStore.value.productStoreId
    })

    // If group has attempted the brokering for the order then it means brokering is success, otherwise displaying the error message
    if(!hasError(resp) && resp.data.attemptedItemCount) {
      getOrderBrokeringInfo(true);
    } else {
      throw resp.data;
    }
  } catch(err) {
    errorMessage.value = "Failed to broker order using this routing, try with some other routing"
    logger.error(err)
  }
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

        // Removing the previous ship group from the order
        if(currentShipGroupId.value !== orderBrokeringInfo.shipGroupSeqId) {
          delete currentOrder.value.groups[currentShipGroupId.value]
        }

        // Updating the value of current ship group with the new ship group
        currentShipGroupId.value = orderBrokeringInfo.shipGroupSeqId
      }

      // If the order is brokered using the selected order routing, then highlight the rule that brokered the order
      // TODO: what if the rule brokered the order but after that the rule is updated, this might create confusion
      if(orderBrokeringInfo.routingGroupId === props.routingGroupId && orderBrokeringInfo.orderRoutingId === props.orderRoutingId) {
        emitter.emit("selectedRule", orderBrokeringInfo.routingRuleId)
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
      emitter.emit("selectedRule", "")
      emitter.emit("updateUnmatchedFilters", []);
      errorMessage.value = ""
      await getOrderBrokeringInfo(true);
      isOrderBrokered.value = false;
      checkOrderBrokeringPossibility();
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
