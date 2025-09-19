<template>
  <ion-page>
    <RouteDetails menu-id="route-details" side="end" :group="currentRoutingGroup" :routing="currentRoute" :unmatchedRoutingProperties="unmatchedRoutingProperties"/>
    <RuleDetails menu-id="rule-details" side="end" :group="group" :rule="currentRule"/>

    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="'/tabs/brokering/'+routingGroupId+'/routes'" />
        </ion-buttons>
        <ion-title>{{ translate("Test drive") }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content id="main-content">
      <div>
        <main>
          <section class="activate-scroll">
            <ion-card class="info">
              <div>
                <ion-card-header>
                  <ion-card-title>{{ group.groupName || "" }}</ion-card-title>
                  <ion-card-subtitle>{{ group.routingGroupId }}</ion-card-subtitle>
                </ion-card-header>
                <div class="ion-padding">
                  <ion-button fill="outline" size="small" @click="exitTestMode()">
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
            <BrokeringRouteTest :routingGroupId="currentRoutingGroup.routingGroupId" :routingGroup="group" :userTestingSession="userTestingSession"/>
          </section>
          <section class="routings activate-scroll">
            <ion-list v-if="group.routings?.length">
              <ion-card v-for="(routing, index) in group.routings" :key="routing.orderRoutingId" :class="[{ 'selected-rule': testRoutingInfo.eligibleOrderRoutings?.includes(routing.orderRoutingId) || testRoutingInfo.brokeringRoute === routing.orderRoutingId}, 'rule-item']" :id="'route-'+routing.orderRoutingId">
                <ion-item lines="full">
                  <ion-label>
                    <h1>{{ routing.routingName }}</h1>
                  </ion-label>
                  {{ `${index + 1}/${group.routings.length}` }}
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
        <aside class="activate-scroll">
          <ion-list v-if="areRuleExistsForRoutings">
            <template v-for="routing in group.routings" :key="routing.orderRoutingId">
              <ion-item-group v-if="routing.rules?.length" class="ion-margin-vertical">
                <ion-item-divider color="light">{{ routing.routingName }}</ion-item-divider>
                <ion-item v-for="rule in routing.rules" :key="rule.routingRuleId" :class="[{ 'selected-rule': testRoutingInfo.brokeringRule === rule.routingRuleId }, 'rule-item']" button @click.stop="openRuleDetails(rule)" :id="'rule-'+rule.routingRuleId">
                  <ion-label>
                    <h2>{{ rule.ruleName }}</h2>
                    <ion-note :color="rule.statusId === 'RULE_ACTIVE' ? 'success' : 'medium'">{{ getStatusDesc(rule.statusId) }}</ion-note>
                  </ion-label>
                </ion-item>
              </ion-item-group>
            </template>
          </ion-list>
          <p class="ion-text-center" v-else>{{ translate("No rules available") }}</p>
        </aside>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonHeader, IonIcon, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonList, IonNote, IonPage, IonTitle, IonToolbar, onIonViewWillEnter, menuController, onIonViewWillLeave, alertController } from "@ionic/vue";
import { filterOutline, pulseOutline, speedometerOutline, swapVerticalOutline } from "ionicons/icons"
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps, reactive, ref, resolveComponent, watch } from "vue";
import { Group, Route } from "@/types";
import { OrderRoutingService } from "@/services/RoutingService";
import logger from "@/logger";
import { hasError, getDateAndTime, sortSequence } from "@/utils";
import emitter from "@/event-bus";
import { translate } from "@/i18n";
import RouteDetails from "@/components/RouteDetails.vue"
import RuleDetails from "@/components/RuleDetails.vue"
import BrokeringRouteTest from "./BrokeringRouteTest.vue";
import { UtilService } from "@/services/UtilService";
import { DateTime } from "luxon";

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

let group = ref({}) as any
let currentRoute = ref({})
let currentRule = ref({})

// TODO: fetch job information for displaying status
let job = ref({}) as any
let orderRoutings = ref([]) as any
let userTestingSession = ref({}) as any

const currentRoutingGroup: any = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))
const testRoutingInfo = computed(() => store.getters["orderRouting/getTestRoutingInfo"])
const currentShipGroup = computed(() => testRoutingInfo.value.currentShipGroupId ? testRoutingInfo.value.currentOrder.groups[testRoutingInfo.value.currentShipGroupId] : [])
const userProfile = computed(() => store.getters["user/getUserProfile"])
const currentProductStore = computed(() => store.getters["user/getCurrentProductStore"])

let unmatchedRoutingProperties = reactive({}) as Record<string, string>

// Check if any of the routing contains rules or not
const areRuleExistsForRoutings = computed(() => group.value.routings?.some((routing: any) => routing.rules?.length))

// Checks if the testRouting info has been updated and scroll the route and rule into the view
watch(testRoutingInfo.value, (routingInfo) => {
  const routeEle = document.getElementById(`route-${routingInfo.brokeringRoute}`);
  routeEle && (routeEle.scrollIntoView());

  const ruleEle = document.getElementById(`rule-${routingInfo.brokeringRule}`);
  ruleEle && (ruleEle.scrollIntoView());
});

onIonViewWillEnter(async () => {
  await fetchRoutingGroupInformation()
  await fetchRoutingsInformation()

  await Promise.all([store.dispatch("util/fetchFacilities"), store.dispatch("util/fetchFacilityGroups"), store.dispatch("util/fetchStatusInformation"), store.dispatch("util/fetchShippingMethods"), store.dispatch("orderRouting/fetchRoutingHistory", props.routingGroupId)])

  await fetchJobInformation()
  await createUserTestSession();

  orderRoutings.value = currentRoutingGroup.value["routings"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"] : []
})

onIonViewWillLeave(async () => {
  await store.dispatch("orderRouting/clearRoutingTestInfo")
})

onBeforeRouteLeave(async (to: any) => {
  if(to.path === '/login') return;

  if(testRoutingInfo.value.currentOrderId) {
    return exitTestMode(false);
  } else {
    await updateUserTestSession();
  }
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

async function openRouteDetails(routing: any) {
  currentRoute.value = routing
  getEligibleRoutesForBrokering(routing)
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

async function fetchJobInformation() {
  job.value = {}
  try {
    const resp = await OrderRoutingService.fetchRoutingScheduleInformation(props.routingGroupId);

    if(!hasError(resp) && resp.data?.schedule) {
      job.value = resp.data.schedule
    } else {
      throw resp.data
    }
  } catch(err) {
    logger.error(err);
  }
}

// @params isTriggerManually - false, if the exit is triggered from the hook programmatically
async function exitTestMode(isTriggerManually = true) {
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

    alert.present();
    return false; // passing boolean to let the routeLeave hook know to change the route or not
  }

  await store.dispatch("orderRouting/clearRoutingTestInfo")

  if(isTriggerManually) {
    router.go(-1);
  } else {
    await updateUserTestSession();
  }

  return true;
}

function getEligibleRoutesForBrokering(routing: any) {
  unmatchedRoutingProperties = {}

  // If no shipGroup is selected, then do not perform any computation, this is the case when we are on the search section of test drive
  if(!currentShipGroup.value.length) {
    return;
  }

  // Defined excluded filters as we are not directly getting information for these params in order, thus for now excluded these when checking for brokering possibility
  // TODO: add support to honor the below excluded filters
  const excludedFilters = ["priority", "promiseDaysCutoff", "originFacilityGroupId", "productCategoryId"]
  const shipGroup = currentShipGroup.value[0]

  // If the routing if not active, then it won't be used for brokering hence not adding the same in the eligible routings array
  if(routing.statusId !== "ROUTING_ACTIVE") {
    unmatchedRoutingProperties["statusId"] = routing.statusId
  }

  const orderFilters = routing.orderFilters?.filter((orderFilter: any) => orderFilter.conditionTypeEnumId === "ENTCT_FILTER")

  // If the current routing do not have filters applied it means that this routing will pick all the orders
  if(!orderFilters?.length) {
    return
  }

  orderFilters.map((orderFilter: any) => {
    const key = orderFilter.fieldName.includes("_excluded") ? orderFilter.fieldName.substring(0, orderFilter.fieldName.indexOf("_excluded")) : orderFilter.fieldName
    const value = orderFilter.fieldValue

    // If the current filter is in excluded filters list considering those filters to be as matched
    if(excludedFilters.includes(key)) {
      return;
    }

    if(orderFilter.operator === "in") {
      const values = value.split(",")

      !values.includes(shipGroup[key]) && (unmatchedRoutingProperties[key] = values)
    }

    if(orderFilter.operator === "not-in") {
      const values = value.split(",")
      // For now, used filter but we can replace it with find, as we will always have a single value that will match with shipGroup facility
      const matchedValues = values.filter((val: string) => val === shipGroup[key])

      if(matchedValues) {
        unmatchedRoutingProperties[key + '_excluded'] = matchedValues
      }
    }

    if(orderFilter.operator === "equals") {
      shipGroup[key] !== value && (unmatchedRoutingProperties[key] = value)
    }

    if(orderFilter.operator === "not-equals") {
      shipGroup[key] === value && (unmatchedRoutingProperties[key + '_excluded'] = value)
    }
  })
}

async function getUserTestSession() {
  userTestingSession.value = await UtilService.getUserSession({
    customParametersMap: {
      sessionTypeEnumId: "ROUTING_TEST_DRIVE",
      userId: userProfile.value.userId,
      productStoreId: currentProductStore.value.productStoreId
    },
    selectedEntity: "co.hotwax.user.UserSession",
    pageLimit: 100,
    filterByDate: true
  });
}

async function createUserTestSession() {
  await getUserTestSession();

  // If a test session already exists for the user do not create a new one
  if(userTestingSession.value.userSessionId) {
    return;
  }

  userTestingSession.value = await UtilService.createUserSession({
    sessionTypeEnumId: "ROUTING_TEST_DRIVE",
    userId: userProfile.value.userId,
    productStoreId: currentProductStore.value.productStoreId,
    fromDate: DateTime.now().toMillis()
  });
}

async function updateUserTestSession() {
  userTestingSession.value = await UtilService.expireUserSession({
    sessionTypeEnumId: "ROUTING_TEST_DRIVE",
    userId: userProfile.value.userId,
    userSessionId: userTestingSession.value.userSessionId,
    productStoreId: currentProductStore.value.productStoreId,
    thruDate: DateTime.now().toMillis()
  });
}
</script>

<style scoped>
main {
  display: grid;
  grid-template-columns: 2fr 1fr;
  overflow-y: scroll;
}

ion-content > div {
  display: grid;
  grid-template-columns: 1fr minmax(375px, 25%);
  height: 100%;
  overflow-y: hidden;
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

.selected-rule {
  box-shadow: 0px 8px 10px 0px rgba(0, 0, 0, 0.14), 0px 3px 14px 0px rgba(0, 0, 0, 0.12), 0px 4px 5px 0px rgba(0, 0, 0, 0.20);
  scale: 1.03;
  margin-block: var(--spacer-sm);
}

.rule-item {
  transition: scale .5s ease, box-shadow .5s ease;
}

.activate-scroll {
  overflow-y: scroll;
  scrollbar-width: none;  /* To hide the scrollbar from being visible */
  scroll-behavior: smooth;
}

.routings > ion-list {
  padding-inline: var(--spacer-xs);
}
</style>
