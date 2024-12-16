<template>
  <div class="ion-margin">
    <ion-searchbar v-if="!currentOrder.orderId" v-model="queryString" @keyup.enter="queryString = $event.target.value; searchOrders()"/>
    <ion-list v-if="!currentOrder.orderId">
      <ion-item v-for="order in orders" :key="order.groupId">
        <ion-label>
          {{ order.orderId }}
          <p>{{ order.orderName }}</p>
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
        <ion-chip v-for="(shipGroup, shipGroupSeqId, index) in currentOrder.groups" :key="shipGroupSeqId" @click="updateCurrentShipGroupId(shipGroupSeqId, shipGroup)" :outline="currentShipGroupId.value !== shipGroupSeqId">
          {{ index + 1 }}: {{ shipGroup[0].facilityName || shipGroup[0].facilityId }}
        </ion-chip>
      </ion-row>

      <div class="ship-groups">
        <div class="order-group">
          <!-- TODO: Add support to reset order, currently the button is always disabled, will be eneabled once implemented -->
          <ion-button class="ion-margin-horizontal" v-if="isOrderBrokered" :disabled="true && hasUnmatchedFilters">
            <ion-icon :icon="arrowUndoOutline" />
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
                {{ currentShipGroup[0].shipmentMethodTypeId }}
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
let orderCarrierPartyIds = ref([]) as any
let errorMessage = ref("")
let brokeringDecisionReason = ref("")
let isOrderBrokered = ref(false)
let hasUnmatchedFilters = ref(false)

const currentEComStore = computed(() => store.getters["user/getCurrentEComStore"])
const currentShipGroup = computed(() => currentShipGroupId.value ? currentOrder.value.groups[currentShipGroupId.value] : [])
const carriers = computed(() => store.getters["util/getCarriers"])
const facilities = computed(() => store.getters["util/getPhysicalFacilities"])
const getProduct = computed(() => (id: string) => store.getters["product/getProductById"](id)) as any
const getProductStock = computed(() => (productId: string, facilityId: string) => store.getters["product/getProductStock"](productId, facilityId)) as any

async function searchOrders() {
  orders.value = []
  errorMessage.value = ""
  if(!queryString.value.trim()) {
    showToast(translate("Enter valid order attribute for searching"))
    return;
  }

  const payload = {
    "json": {
      "params": {
        "rows": "10",
        "group": true,
        "group.field": "orderId",
        "group.limit": 1000,
        "group.ngroups": true,
        "q.op": "AND",
        "start": 0
      },
      "query":"(*:*)",
      "filter": `docType: ORDER AND orderId: ${queryString.value} AND -orderStatusId: (ORDER_REJECTED OR ORDER_CANCELLED)`
    }
  }

  try {
    const resp = await OrderRoutingService.findOrder(payload) as any;

    if(!hasError(resp) && resp.data.grouped?.orderId?.groups.length) {
      const productIds: Array<string> = [];
      orders.value = resp.data.grouped?.orderId?.groups.map((group: any) => {
        const groups = group.doclist.docs.reduce((shipGroups: any, item: any) => {
          productIds.push(item.productId)
          orderCarrierPartyIds.value.push(item.carrierPartyId)
          shipGroups[item.shipGroupSeqId] ? shipGroups[item.shipGroupSeqId].push(item) : shipGroups[item.shipGroupSeqId] = [item]
          return shipGroups
        }, {})

        return {
          orderId: group.doclist.docs[0].orderId,
          orderName: group.doclist.docs[0].orderName,
          orderStatusDesc: group.doclist.docs[0].orderStatusDesc,
          groups
        }
      })

      store.dispatch("util/fetchCarrierInformation", [...new Set(orderCarrierPartyIds.value)])

      if(productIds.length) {
        store.dispatch("product/fetchProducts", productIds)
      }
    } else {
      throw resp
    }
  } catch(error) {
    logger.error(error)
    errorMessage.value = "Unable to find order"
  }
}

function updateCurrentOrder(order?: any) {
  if(!order?.orderId) {
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

  currentOrder.value = order
}

function updateCurrentShipGroupId(shipGroupId: any, shipGroup: any) {
  if(!shipGroupId) {
    emitter.emit("selectedRule", "")
    emitter.emit("updateUnmatchedFilters", []);
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
    getOrderBrokeringInfo()
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

    // TODO: handle error cases, currently success and error are in the same messages property hence having issue in differentiating between the two
    if(!hasError(resp) && resp.data.messages) {
      getOrderBrokeringInfo();
    } else {
      throw resp.data;
    }
  } catch(err) {
    errorMessage.value = "This order will not be brokered in this routing because of the selected order filters."
    logger.error(err)
  }
}

async function getOrderBrokeringInfo() {
  const payload = {
    inputFields: {
      orderId: currentOrder.value.orderId,
    },
    orderBy: "changeDatetime DESC",
    entityName: "OrderFacilityChange"
  }

  try {
    let resp = await OrderRoutingService.getOrderFacilityChangeInfo(payload)

    if(!hasError(resp) && resp.data.docs?.length) {
      const orderBrokeringInfo = resp.data.docs[0]

      // TODO: need to update the logic once the broker api returns correct data
      // If the order is brokered by the user then update the order shipGroup info
      if(!isOrderBrokered.value) {
        isOrderBrokered.value = true

        // Not using solr query to fetch the updated information as solr doc updation is async and thus might take some time to update
        // Adding a new ship group to the order
        currentOrder.value.groups[orderBrokeringInfo.shipGroupSeqId] = currentOrder.value.groups[currentShipGroupId.value].map((item: any) => ({
          ...item,
          facilityId: orderBrokeringInfo.facilityId,
          facilityName: facilities.value[orderBrokeringInfo.facilityId]?.facilityName,
          shipGroupSeqId: orderBrokeringInfo.shipGroupSeqId
        }))

        // Removing the previous ship group from the order
        delete currentOrder.value.groups[currentShipGroupId.value]

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
