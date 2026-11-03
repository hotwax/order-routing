<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title>{{ translate("Safety stock") }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="ruleGroup.ruleGroupId && (rules.length || archivedRules.length)" class="safety-layout">
        <aside class="safety-aside">
          <SafetyStockAnalytics />
        </aside>
        <main class="atp-main">
          <ScheduleRuleItem v-if="rules.length" />
          <ArchivedRuleItem v-if="archivedRules?.length" />

          <section v-if="rules.length">
            <ion-reorder-group :disabled="false" @ionItemReorder="updateReorderingRules($event)">
              <RuleItem v-for="(rule, ruleIndex) in (isReorderActive ? reorderingRules : rules)" :rule="rule" :ruleIndex="ruleIndex" :key="rule.ruleId" />
            </ion-reorder-group>
          </section>
        </main>
      </div>

      <div class="empty-block" v-else>
        <EmptyState
          :icon="pulseOutline"
          :title="translate('No safety stock rules yet')"
          :message="translate('Safety stock reserves a buffer of inventory per facility or group so it is not promised to online orders.')"
        >
          <template #actions>
            <ion-button @click="createRule()">
              {{ translate("Create safety stock rule") }}
              <ion-icon slot="end" :icon="addOutline" />
            </ion-button>
          </template>
        </EmptyState>
      </div>
    </ion-content>

    <ion-fab vertical="bottom" horizontal="end" slot="fixed" class="ion-margin">
      <ion-fab-button :disabled="!rules.length" class="ion-margin-bottom" color="light" @click="isReorderActive ? saveReorder() : activateReordering()">
        <ion-icon :icon="isReorderActive ? saveOutline : balloonOutline" />
      </ion-fab-button>
      <ion-fab-button :disabled="isReorderActive" @click="createRule()">
        <ion-icon :icon="addOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonMenuButton, IonPage, IonReorderGroup, IonTitle, IonToolbar, onIonViewDidLeave, onIonViewDidEnter } from '@ionic/vue';
import { addOutline, saveOutline, balloonOutline, pulseOutline } from 'ionicons/icons';
import RuleItem from '@/components/RuleItem.vue';
import EmptyState from '@/components/EmptyState.vue';
import router from "@/router";
import { computed, ref } from 'vue';
import ScheduleRuleItem from '@/components/ScheduleRuleItem.vue';
import { useRuleStore } from '@/store/rule';
import { useAtpProductStore } from '@/store/atpProductStore';
import { commonUtil, emitter, translate } from '@common';
import { ruleUtil } from '@/utils/ruleUtil';
import ArchivedRuleItem from '@/components/ArchivedRuleItem.vue';
import SafetyStockAnalytics from '@/components/SafetyStockAnalytics.vue';
import { useRoutingDiagnosticsStore } from '@/store/routingDiagnosticsStore';

const ruleStore = useRuleStore();
const productStore = useAtpProductStore();
const diagnostics = useRoutingDiagnosticsStore();

const rules = computed(() => ruleStore.getRules);
const ruleGroup = computed(() => ruleStore.getRuleGroup);
const isReorderActive = computed(() => ruleStore.isReorderActive);
const archivedRules = computed(() => ruleStore.getArchivedRules);
const reorderingRules = ref([]) as any;

onIonViewDidEnter(async() => {
  fetchRules();
  diagnostics.loadSafetyStock();
  emitter.on("productStoreOrConfigChanged", fetchRules);
  emitter.on("productStoreOrConfigChanged", loadAnalytics);
})

onIonViewDidLeave(() => {
  emitter.off("productStoreOrConfigChanged", fetchRules);
  emitter.off("productStoreOrConfigChanged", loadAnalytics);
  ruleStore.updateIsReorderActive(false)
})

async function fetchRules() {
  emitter.emit("presentLoader");
  productStore.updateSelectedSegment("");
  ruleStore.updateIsReorderActive(false)
  await Promise.allSettled([ruleStore.fetchRules({ groupTypeEnumId: 'RG_SAFETY_STOCK', pageSize: 50 }), productStore.fetchConfigFacilities(), productStore.fetchFacilityGroups()]);
  emitter.emit("dismissLoader");
}

// Not awaited by fetchRules, so the rule list never waits on the inventory queries.
function loadAnalytics() {
  diagnostics.loadSafetyStock(true);
}

function activateReordering() {
  ruleStore.updateIsReorderActive(true)
  reorderingRules.value = rules.value;
}

async function saveReorder() {
  const diffRules = reorderingRules.value.filter((reorderRule: any) => rules.value.some((rule: any) => rule.ruleId === reorderRule.ruleId && rule.sequenceNum !== reorderRule.sequenceNum))
  if(!diffRules.length) {
    ruleStore.updateIsReorderActive(false)
    commonUtil.showToast(translate("No sequence has been changed."))
    return;
  }

  emitter.emit("presentLoader", { messgae: "Saving changes.." })
  const responses = await Promise.allSettled(diffRules.map(async (rule: any) => {
    await ruleStore.updateRuleApi(rule, rule.ruleId)
  }))

  const failedResponse: any = responses.find((response: any) => response.status === 'rejected');
  if(failedResponse) {
    const serverError = commonUtil.getErrorMessage(failedResponse.reason);
    commonUtil.showToast(`${translate("Failed to update sequence for some rules.")} ${serverError}`);
  } else {
    commonUtil.showToast(translate("Sequence for rules updated successfully."))
  }
  emitter.emit("dismissLoader");
  await ruleStore.updateRules({ rules: reorderingRules.value })
  ruleStore.updateIsReorderActive(false)
}

function updateReorderingRules(event: any) {
  reorderingRules.value = ruleUtil.doReorder(event, reorderingRules.value)
}

function createRule() {
  router.push({ path: '/create-safety-stock' })
}
</script>

<style scoped>
/* Analytics in a left column, the rule list on the right, as on the Store pickup page. */
.safety-layout {
  display: grid;
  grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
  gap: var(--spacer-base);
  align-items: start;
}

.safety-aside {
  position: sticky;
  top: 0;
  /* Keep the cards off the menu edge; the grid gap already separates them from the rules. */
  padding-inline-start: var(--spacer-base);
}

.safety-layout .atp-main {
  margin-top: var(--spacer-base);
}

/* Stack the analytics above the list until both columns fit: the rule cards need about 375px
   beside the 440px analytics column, which the page has only from Ionic's xl breakpoint. */
@media (max-width: 1199px) {
  .safety-layout {
    grid-template-columns: 1fr;
  }

  .safety-aside {
    position: static;
    /* Line up with the rule cards stacked below, which keep Ionic's card margin. */
    padding-inline: var(--spacer-xs);
  }
}

.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacer-base);
  padding: var(--spacer-base) var(--spacer-base) var(--spacer-2xl);
}
</style>