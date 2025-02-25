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
            <BrokeringRouteTest :routingGroupId="currentRoutingGroup.routingGroupId" :routingGroup="group"/>
          </section>
          <section class="route-details">
            <ion-list v-if="group.routings?.length">
              <ion-card v-for="(routing, index) in group.routings" :key="routing.orderRoutingId" :class="{ 'selected-rule': eligibleOrderRoutings.includes(routing.orderRoutingId) || brokeringRoute === routing.orderRoutingId }">
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
        <aside>
          <ion-list>
            <ion-item-group v-for="routing in group.routings" :key="routing.orderRoutingId" class="ion-margin-vertical">
              <ion-item-divider color="light">{{ routing.routingName }}</ion-item-divider>
              <ion-item v-for="rule in routing.rules" :key="rule.routingRuleId" :class="{ 'selected-rule': brokeringRule === rule.routingRuleId }" button @click.stop="openRuleDetails(rule)">
                <ion-label>
                  <h2>{{ rule.ruleName }}</h2>
                  <ion-note :color="rule.statusId === 'RULE_ACTIVE' ? 'success' : 'medium'">{{ getStatusDesc(rule.statusId) }}</ion-note>
                </ion-label>
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
import { IonBackButton, IonBadge, IonButtons, IonButton, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonItem, IonItemGroup, IonItemDivider, IonLabel, IonList, IonNote, IonPage, IonTitle, IonToolbar, onIonViewWillEnter, menuController, onIonViewWillLeave } from "@ionic/vue";
import { filterOutline, pulseOutline, speedometerOutline, swapVerticalOutline } from "ionicons/icons"
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { computed, defineProps, Ref, ref } from "vue";
import { Group } from "@/types";
import { OrderRoutingService } from "@/services/RoutingService";
import logger from "@/logger";
import { hasError, getDateAndTime, sortSequence } from "@/utils";
import emitter from "@/event-bus";
import { translate } from "@/i18n";
import RouteDetails from "@/components/RouteDetails.vue"
import RuleDetails from "@/components/RuleDetails.vue"
import BrokeringRouteTest from "./BrokeringRouteTest.vue";

const router = useRouter();
const store = useStore();
const props = defineProps({
  routingGroupId: {
    type: String,
    required: true
  }
})

let group = ref({}) as any
let eligibleOrderRoutings: Ref<string[]> = ref([])
let brokeringRoute = ref("")
let brokeringRule = ref("")
let currentRoute = ref({})
let currentRule = ref({})

// TODO: fetch job information for displaying status
let job = ref({}) as any
let orderRoutings = ref([]) as any

const currentRoutingGroup: any = computed((): Group => store.getters["orderRouting/getCurrentRoutingGroup"])
const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))

onIonViewWillEnter(async () => {
  await fetchRoutingGroupInformation()
  await fetchRoutingsInformation()

  emitter.on("updateBrokeringInfo", updateBrokeringInfo)
  emitter.on("updateEligibleOrderRoutings", updateEligibleOrderRoutings)

  await Promise.all([store.dispatch("util/fetchFacilities"), store.dispatch("util/fetchFacilityGroups"), store.dispatch("util/fetchStatusInformation"), store.dispatch("util/fetchShippingMethods"), store.dispatch("orderRouting/fetchRoutingHistory", props.routingGroupId)])

  await fetchJobInformation()

  orderRoutings.value = currentRoutingGroup.value["routings"] ? JSON.parse(JSON.stringify(currentRoutingGroup.value))["routings"] : []
})

onIonViewWillLeave(() => {
  emitter.off("updateBrokeringInfo", updateBrokeringInfo)
  emitter.off("updateEligibleOrderRoutings", updateEligibleOrderRoutings)
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

function updateBrokeringInfo(brokeringInfo: any) {
  brokeringRoute.value = brokeringInfo.brokeringRoute
  brokeringRule.value = brokeringInfo.brokeringRule
}

function updateEligibleOrderRoutings(orderRoutings: any) {
  eligibleOrderRoutings.value = orderRoutings
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

.selected-rule {
  box-shadow: 0px 8px 10px 0px rgba(0, 0, 0, 0.14), 0px 3px 14px 0px rgba(0, 0, 0, 0.12), 0px 4px 5px 0px rgba(0, 0, 0, 0.20);
  scale: 1.03;
  margin-block: var(--spacer-sm);
}

.rule-item {
  transition: .5s all ease;
}
</style>
