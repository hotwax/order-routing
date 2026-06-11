<template>
  <div v-if="store.tree" class="variation-canvas">
    <ion-list-header>
      <ion-label>
        <h2>{{ store.tree.variationName || store.tree.variationGroupId }}</h2>
        <p>{{ translate("Parent group") }}: {{ store.tree.parentRoutingGroupId }}</p>
      </ion-label>
    </ion-list-header>

    <!-- Routings (sorted by sequence). Only ROUTING_ACTIVE routings run. -->
    <ion-reorder-group :disabled="false" @ionItemReorder="onRoutingReorder($event)">
      <ion-card v-for="routing in store.sortedRoutings" :key="routing.orderRoutingId">
        <ion-card-header>
          <div class="row">
            <ion-card-title>{{ routing.routingName }}</ion-card-title>
            <ion-toggle
              :checked="routing.statusId === 'ROUTING_ACTIVE'"
              @ionChange="onRoutingToggle(routing.orderRoutingId, $event.detail.checked)"
            >{{ translate("Active") }}</ion-toggle>
            <ion-spinner v-if="store.saving['routing:' + routing.orderRoutingId] === 'saving'" name="dots" />
            <ion-icon v-else-if="store.saving['routing:' + routing.orderRoutingId] === 'error'" :icon="alertCircleOutline" color="danger" />
            <ion-reorder />
          </div>
        </ion-card-header>
        <ion-card-content>
          <!-- Filters: which orders this routing considers -->
          <h3>{{ translate("Filters") }} <ion-note>{{ translate("which orders") }}</ion-note></h3>
          <variation-condition-rows
            kind="filter"
            :routing-id="routing.orderRoutingId"
            :conditions="routing.filters"
          />

          <!-- Rules: how the routing brokers -->
          <h3>{{ translate("Rules") }} <ion-note>{{ translate("how it brokers") }}</ion-note></h3>
          <div v-for="rule in sortRules(routing.rules)" :key="rule.routingRuleId" class="rule">
            <div class="row">
              <span>{{ rule.ruleName }}</span>
              <ion-toggle
                :checked="rule.statusId === 'RULE_ACTIVE'"
                @ionChange="onRuleToggle(routing.orderRoutingId, rule.routingRuleId, $event.detail.checked)"
              >{{ translate("Active") }}</ion-toggle>
            </div>
            <h4>{{ translate("Inventory conditions") }}</h4>
            <variation-condition-rows
              kind="invcond"
              :routing-id="routing.orderRoutingId"
              :rule-id="rule.routingRuleId"
              :conditions="rule.inventoryConditions"
            />
            <h4>{{ translate("Actions") }}</h4>
            <variation-action-rows
              :routing-id="routing.orderRoutingId"
              :rule-id="rule.routingRuleId"
              :actions="rule.actions"
            />
          </div>
        </ion-card-content>
      </ion-card>
    </ion-reorder-group>
  </div>
</template>

<script setup lang="ts">
import { translate } from "@common";
import { alertCircleOutline } from "ionicons/icons";
import {
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonLabel, IonListHeader,
  IonNote, IonReorder, IonReorderGroup, IonSpinner, IonToggle,
} from "@ionic/vue";
import { variationStore } from "@/store/variationStore";
import { sortBySequence } from "@/util/variationTree";
import VariationConditionRows from "./VariationConditionRows.vue";
import VariationActionRows from "./VariationActionRows.vue";

const store = variationStore();
const sortRules = (rules: any[]) => sortBySequence(rules);

function onRoutingToggle(rid: string, checked: boolean) {
  store.setRoutingStatus(rid, checked ? "ROUTING_ACTIVE" : "ROUTING_DRAFT");
}
function onRuleToggle(rid: string, ruleId: string, checked: boolean) {
  store.setRuleStatus(rid, ruleId, checked ? "RULE_ACTIVE" : "RULE_DRAFT");
}
function onRoutingReorder(ev: CustomEvent) {
  const ids = store.sortedRoutings.map((r) => r.orderRoutingId);
  const moved = (ev.detail as any).complete(ids) as string[];
  store.reorderRoutings(moved);
}
</script>

<style scoped>
.variation-canvas .row { display: flex; align-items: center; gap: var(--spacer-sm); justify-content: space-between; }
.rule { border-left: 2px solid var(--ion-color-light-shade); padding-left: var(--spacer-sm); margin: var(--spacer-sm) 0; }
</style>
