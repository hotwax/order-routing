<template>
  <ion-page>
    <ion-content>
      <div>
        <div class="menu">
          <ion-item lines="none">
            <ion-label>{{ currentRouting.routeName }}</ion-label>
            <ion-chip slot="end" outline @click="router.go(-1)">
              {{ "2/4" }}
              <ion-icon :icon="chevronUpOutline" />
            </ion-chip>
          </ion-item>
          <ion-button expand="block">{{ "Save Changes" }}</ion-button>
          <ion-item-group>
            <ion-item-divider color="medium">
              <ion-label>{{ "Filters" }}</ion-label>
            </ion-item-divider>
            <ion-item>
              <ion-select label="Queue" interface="popover" :value="routingFilters[enums['FILTER']]?.[enums['QUEUE'].code]">
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-select label="Shipping method" :value="routingFilters[enums['FILTER']]?.[enums['SHIPPING_METHOD'].code]">
                <ion-select-option value="Next Day">{{ "Next Day" }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-select label="Order priority" :value="routingFilters[enums['FILTER']]?.[enums['PRIORITY'].code]">
                <ion-select-option value="High">{{ "High" }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label>{{ "Promise date" }}</ion-label>
              <ion-chip>
                {{ routingFilters[enums['FILTER']]?.[enums['PROMISE_DATE'].code] }}
                <ion-icon :icon="closeCircleOutline"/>
              </ion-chip>
            </ion-item>
            <ion-item>
              <ion-select label="Sales Channel" :value="routingFilters[enums['FILTER']]?.[enums['SALES_CHANNEL'].code]">
                <ion-select-option value="Brokering Queue">{{ "Brokering Queue" }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-item-group>
          <ion-item-group>
            <ion-item-divider color="medium">
              <ion-label>{{ "Sort" }}</ion-label>
            </ion-item-divider>
            <ion-reorder-group :disabled="false">
              <ion-item>
                <ion-label>{{ "Ship by" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Ship after" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Order date" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Shipping method" }}</ion-label>
                <ion-reorder />
              </ion-item>
            </ion-reorder-group>
          </ion-item-group>
        </div>
        <div class="menu">
          <ion-list>
            <ion-reorder-group :disabled="false">
              <ion-item v-for="rule in routingRules" :key="rule.routingRuleId" button>
                <ion-label>{{ rule.ruleName }}</ion-label>
                <!-- Don't display reordering option when there is a single rule -->
                <ion-reorder v-show="routingRules.length > 1" />
              </ion-item>
            </ion-reorder-group>
          </ion-list>
          <ion-button fill="outline" @click="addInventoryRule">
            {{ "Add inventory rule" }}
            <ion-icon :icon="addCircleOutline"/>
          </ion-button>
        </div>
        <div>
          <section class="filters">
            <ion-card>
              <ion-item>
                <ion-icon slot="start" :icon="filterOutline"/>
                <ion-label>{{ "Filters" }}</ion-label>
                <ion-button fill="clear" @click="addInventoryFilterOptions()">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
                </ion-button>
              </ion-item>
              <ion-item>
                <ion-select label="Group" value="East coast stores">
                  <ion-select-option value="East coast stores">{{ "East coast stores" }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Proximity" value="Zone 1">
                  <ion-select-option value="Zone 1">{{ "Zone 1" }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label>{{ "Brokering safety stock" }}</ion-label>
                <ion-chip>{{ "3" }}</ion-chip>
              </ion-item>
            </ion-card>
            <ion-card>
              <ion-item>
                <ion-icon slot="start" :icon="swapVerticalOutline"/>
                <ion-label>{{ "Sort" }}</ion-label>
                <ion-button fill="clear" @click="addInventorySortOptions()">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
                </ion-button>
              </ion-item>
              <ion-reorder-group :disabled="false">
                <ion-item>
                  <ion-label>{{ "Proximity" }}</ion-label>
                  <ion-reorder />
                </ion-item>
                <!-- TODO: Does not have support for order limit, but need to add this support in future -->
                <!-- <ion-item>
                  <ion-label>{{ "Order limit" }}</ion-label>
                  <ion-reorder />
                </ion-item> -->
                <ion-item>
                  <ion-label>{{ "Inventory balance" }}</ion-label>
                  <ion-reorder />
                </ion-item>
                <ion-item>
                  <ion-label>{{ "Custom Sequence" }}</ion-label>
                  <ion-reorder />
                </ion-item>
              </ion-reorder-group>
            </ion-card>
          </section>
          <section>
            <h2 class="ion-padding-start">{{ "Actions" }}</h2>
            <div class="actions">
              <ion-card>
                <ion-item lines="none">
                  <ion-label>{{ "Allocated Items" }}</ion-label>
                </ion-item>
                <ion-item lines="none">
                  <ion-toggle>{{ "Clear auto cancel days" }}</ion-toggle>
                </ion-item>
              </ion-card>
              <ion-card>
                <ion-item lines="none">
                  <ion-label>{{ "Partially available" }}</ion-label>
                  <p>{{ "Select if partial allocation should be allowed in this inventory rule" }}</p>
                </ion-item>
                <ion-item lines="none">
                  <ion-toggle>{{ "Allow partial allocation" }}</ion-toggle>
                </ion-item>
              </ion-card>
              <ion-card>
                <ion-item lines="none">
                  <ion-label>{{ "Unavailable items" }}</ion-label>
                </ion-item>
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
                  <ion-chip outline @click="updateAutoCancelDays(autoCancelDays)">{{ autoCancelDays }}{{ ' days' }}</ion-chip>
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
import { IonButton, IonCard, IonChip, IonContent, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonToggle, alertController, modalController, onIonViewWillEnter } from "@ionic/vue";
import { addCircleOutline, checkmarkOutline, chevronUpOutline, closeCircleOutline, filterOutline, golfOutline, optionsOutline, playForwardOutline, swapVerticalOutline } from "ionicons/icons"
import { useRouter } from "vue-router";
import { computed, defineProps, ref } from "vue";
import store from "@/store";
import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";
import AddInventorySortOptionsModal from "@/components/AddInventorySortOptionsModal.vue";
import { showToast } from "@/utils";

const router = useRouter();
const props = defineProps({
  orderRoutingId: {
    type: String,
    required: true
  }
})

const enums = JSON.parse(process.env?.VUE_APP_RULE_ENUMS as string)
const actionEnums = JSON.parse(process.env?.VUE_APP_RULE_ACTION_ENUMS as string)
const autoCancelDays = ref(0)
const ruleActionType = ref('')

const currentRouting = computed(() => store.getters["orderRouting/getCurrentOrderRouting"])
const routingRules = computed(() => store.getters["orderRouting/getRoutingRules"])
const routingFilters = computed(() => store.getters["orderRouting/getCurrentRouteFilters"])
const ruleActions = computed(() => store.getters["orderRouting/getRuleActions"])
const facilities = computed(() => store.getters["util/getFacilities"])

onIonViewWillEnter(async () => {
  await Promise.all([store.dispatch("orderRouting/fetchRoutingRules", props.orderRoutingId), store.dispatch("orderRouting/fetchRoutingFilters", props.orderRoutingId), store.dispatch("util/fetchFacilities")])

  if(routingRules.value.length) {
    await Promise.all([store.dispatch("orderRouting/fetchRuleConditions", routingRules.value[0].routingRuleId), store.dispatch("orderRouting/fetchRuleActions", routingRules.value[0].routingRuleId)])
  }

  autoCancelDays.value = ruleActions.value[actionEnums['AUTO_CANCEL_DAYS'].id]?.actionValue

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(ruleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ''
})

async function addInventoryFilterOptions() {
  const inventoryFilterOptionsModal = await modalController.create({
    component: AddInventoryFilterOptionsModal
  })

  await inventoryFilterOptionsModal.present();
}

async function addInventorySortOptions() {
  const inventorySortOptionsModal = await modalController.create({
    component: AddInventorySortOptionsModal
  })

  await inventorySortOptionsModal.present();
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

  newRuleAlert.onDidDismiss().then((result: any) => {
    if(result.data?.values?.ruleName) {
      console.log('ruleName', result.data?.values?.ruleName)
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
    actionValue: '' // after changing action type, as next_rule action does not need to have a value, so in all cases making intially the value as empty and will update it if required from some other function
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
</style>
