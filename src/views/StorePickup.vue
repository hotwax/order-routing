<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-menu-button slot="start" />
        <ion-title slot="start">{{ translate("Store pickup") }}</ion-title>

        <ion-segment :value="selectedSegment" @ionChange="updateSegment($event)" slot="end">
          <ion-segment-button value="RG_PICKUP_FACILITY">
            <ion-label>{{ translate("Product and facility") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="RG_PICKUP_CHANNEL">
            <ion-label>{{ translate("Product and channel") }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="PICKUP_FACILITY">
            <ion-label>{{ translate("Facility") }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content ref="contentRef" :scroll-events="true" @ionScroll="enableScrolling()">
      <PickupAnalytics />
      <main class="atp-main" v-if="selectedSegment !== 'PICKUP_FACILITY'">
        <template v-if="ruleGroup.ruleGroupId && (rules.length || archivedRules.length)">
          <ScheduleRuleItem v-if="rules.length" />
          <ArchivedRuleItem v-if="archivedRules?.length" />

          <section v-if="rules.length">
            <ion-reorder-group :disabled="false" @ionItemReorder="updateReorderingRules($event)">
              <RuleItem v-for="(rule, ruleIndex) in (isReorderActive ? reorderingRules : rules)" :rule="rule" :ruleIndex="ruleIndex" :key="rule.ruleId" />
            </ion-reorder-group>
          </section>
        </template>
        <div class="empty-block" v-else>
          <EmptyState
            :icon="storefrontOutline"
            :title="translate('No store pickup rules yet')"
            :message="translate('Store pickup rules decide which facilities can fulfill in-store pickup orders, based on product and facility or product and channel combinations.')"
          >
            <template #actions>
              <ion-button @click="createStorePickup()">
                {{ translate("Create store pickup rule") }}
                <ion-icon slot="end" :icon="addOutline" />
              </ion-button>
            </template>
          </EmptyState>
          <SectionWayfinding :items="sectionTabs" :active="selectedSegment" :heading="translate('Store pickup is set up across three tabs')" @select="changeSegment" />
        </div>
      </main>
      <main class="atp-main" v-else>
        <div v-if="!pickupGroups.length" class="empty-block">
          <EmptyState
            :icon="businessOutline"
            :title="translate('No pickup groups yet')"
            :message="translate('A pickup group is the set of facilities that can fulfill store pickup orders for this product store. Create one, or use a group that already exists.')"
          >
            <template #actions>
              <ion-button @click="createPickupGroup()">
                {{ translate("Create pickup group") }}
                <ion-icon slot="end" :icon="addOutline" />
              </ion-button>
              <ion-button fill="outline" @click="linkExistingPickupGroup()">
                {{ translate("Use an existing group") }}
                <ion-icon slot="end" :icon="linkOutline" />
              </ion-button>
            </template>
          </EmptyState>
          <SectionWayfinding :items="sectionTabs" :active="selectedSegment" :heading="translate('Store pickup is set up across three tabs')" @select="changeSegment" />
        </div>
        <section v-else-if="facilities.length">
          <FacilityItem v-for="facility in facilities" :facility="facility" :key="facility.facilityId" />
        </section>
        <div v-else class="empty-block">
          <EmptyState
            variant="compact"
            :icon="storefrontOutline"
            :title="translate('No facilities to assign')"
            :message="translate('This product store has no facilities available to add to your pickup groups. Facilities come from your OMS — once they exist, they will appear here.')"
          />
          <SectionWayfinding :items="sectionTabs" :active="selectedSegment" @select="changeSegment" />
        </div>
      </main>

      <ion-infinite-scroll
        @ionInfinite="loadMoreFacilities($event)"
        threshold="100px"
        v-show="selectedSegment === 'PICKUP_FACILITY' && isScrollable"
        ref="infiniteScrollRef"
      >
        <ion-infinite-scroll-content
          loading-spinner="crescent"
          :loading-text="translate('Loading')"
        />
      </ion-infinite-scroll>
    </ion-content>

    <ion-fab v-if="selectedSegment !== 'PICKUP_FACILITY'" vertical="bottom" horizontal="end" slot="fixed" class="ion-margin">
      <ion-fab-button :disabled="!rules.length" class="ion-margin-bottom" color="light" @click="isReorderActive ? saveReorder() : activateReordering()">
        <ion-icon :icon="isReorderActive ? saveOutline : balloonOutline" />
      </ion-fab-button>
      <ion-fab-button :disabled="isReorderActive" @click="createStorePickup()">
        <ion-icon :icon="addOutline" />
      </ion-fab-button>
    </ion-fab>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonLabel, IonMenuButton, IonPage, IonReorderGroup, IonSegment, IonSegmentButton, IonTitle, IonToolbar, modalController, onIonViewDidLeave, onIonViewDidEnter } from '@ionic/vue';
import { computed, ref } from 'vue';
import { addOutline, balloonOutline, businessOutline, globeOutline, linkOutline, saveOutline, storefrontOutline } from 'ionicons/icons';
import RuleItem from '@/components/RuleItem.vue'
import FacilityItem from '@/components/FacilityItem.vue'
import EmptyState from '@/components/EmptyState.vue'
import SectionWayfinding from '@/components/SectionWayfinding.vue'
import CreateUpdateFacilityGroupModal from '@/components/CreateUpdateFacilityGroupModal.vue'
import LinkExistingGroupModal from '@/components/LinkExistingGroupModal.vue'
import { commonUtil, emitter, translate } from '@common';
import { ruleUtil } from '@/utils/ruleUtil';
import ArchivedRuleItem from '@/components/ArchivedRuleItem.vue';
import ScheduleRuleItem from '@/components/ScheduleRuleItem.vue';
import PickupAnalytics from '@/components/PickupAnalytics.vue';
import router from '@/router';
import { useRuleStore } from '@/store/rule';
import { useAtpProductStore } from '@/store/atpProductStore';
import { usePickupAnalyticsStore } from '@/store/pickupAnalyticsStore';

const ruleStore = useRuleStore();
const productStore = useAtpProductStore();
const pickupAnalyticsStore = usePickupAnalyticsStore();

const ruleGroup = computed(() => ruleStore.getRuleGroup);
const rules = computed(() => ruleStore.getRules);
const isScrollable = computed(() => productStore.isFacilitiesScrollable);
const facilities = computed(() => productStore.getFacilities);
const selectedSegment = computed(() => productStore.getSelectedSegment);
const isReorderActive = computed(() => ruleStore.isReorderActive);
const pickupGroups = computed(() => productStore.getPickupGroups);
const archivedRules = computed(() => ruleStore.getArchivedRules);

const reorderingRules = ref([]) as any;
const isScrollingEnabled = ref(false);
const contentRef = ref({}) as any;
const infiniteScrollRef = ref({}) as any;

const sectionTabs = computed(() => [
  { value: "RG_PICKUP_FACILITY", label: translate("Product and facility"), intro: translate("Route pickup orders by product and facility"), icon: businessOutline },
  { value: "RG_PICKUP_CHANNEL", label: translate("Product and channel"), intro: translate("Route pickup orders by product and channel"), icon: globeOutline },
  { value: "PICKUP_FACILITY", label: translate("Facility"), intro: translate("Assign facilities to your pickup groups"), icon: storefrontOutline },
]);

onIonViewDidEnter(async() => {
  fetchRules();
  pickupAnalyticsStore.loadAnalytics();
  emitter.on("productStoreOrConfigChanged", fetchRules);
})

onIonViewDidLeave(() => {
  emitter.off("productStoreOrConfigChanged", fetchRules);
  ruleStore.updateIsReorderActive(false)
})

async function fetchRules() {
  emitter.emit("presentLoader");
  ruleStore.updateIsReorderActive(false)
  if(!selectedSegment.value || (selectedSegment.value !== 'RG_PICKUP_FACILITY' && selectedSegment.value !== 'RG_PICKUP_CHANNEL' && selectedSegment.value !== 'PICKUP_FACILITY')) await productStore.updateSelectedSegment("RG_PICKUP_FACILITY");
  if(selectedSegment.value === 'PICKUP_FACILITY') {
    await Promise.allSettled([fetchFacilities(), productStore.fetchPickupGroups()]) ;
  } else {
    await Promise.allSettled([ruleStore.fetchRules({ groupTypeEnumId: selectedSegment.value, pageSize: 50 }), productStore.fetchConfigFacilities(), productStore.fetchFacilityGroups()])
  }
  emitter.emit("dismissLoader");
}

async function fetchFacilities(vSize?: any, vIndex?: any) {
  const pageSize = vSize ? vSize : import.meta.env.VITE_VIEW_SIZE;
  const pageIndex = vIndex ? vIndex : 0;
  const payload = {
    pageSize,
    pageIndex
  };
  await productStore.fetchFacilities(payload)
}

function enableScrolling() {
  const parentElement = contentRef.value.$el
  const scrollEl = parentElement.shadowRoot.querySelector("div[part='scroll']")
  let scrollHeight = scrollEl.scrollHeight, infiniteHeight = infiniteScrollRef.value.$el.offsetHeight, scrollTop = scrollEl.scrollTop, threshold = 100, height = scrollEl.offsetHeight
  const distanceFromInfinite = scrollHeight - infiniteHeight - scrollTop - threshold - height
  if(distanceFromInfinite < 0) {
    isScrollingEnabled.value = false;
  } else {
    isScrollingEnabled.value = true;
  }
}

async function loadMoreFacilities(event: any) {
  // Added this check here as if added on infinite-scroll component the Loading content does not gets displayed
  if(!(isScrollingEnabled.value && isScrollable.value)) {
    await event.target.complete();
  }
  fetchFacilities(
    undefined,
    Math.ceil(
      facilities.value?.length / (import.meta.env.VITE_VIEW_SIZE as any)
    ).toString()
  ).then(async () => {
    await event.target.complete();
  });
}

function updateSegment(event: any) {
  changeSegment(event.detail.value);
}

async function changeSegment(value: string) {
  if(value === selectedSegment.value) return;
  productStore.updateSelectedSegment(value);

  emitter.emit("presentLoader");
  if(value === 'PICKUP_FACILITY') {
    isScrollingEnabled.value = false;
    await fetchFacilities();
    ruleStore.updateIsReorderActive(false)
    await productStore.fetchPickupGroups()
  } else {
    ruleStore.updateIsReorderActive(false)
    reorderingRules.value = []
    await ruleStore.fetchRules({ groupTypeEnumId: value, pageSize: 50 })
  }
  emitter.emit("dismissLoader");
}

async function createPickupGroup() {
  const modal = await modalController.create({
    component: CreateUpdateFacilityGroupModal,
    componentProps: { defaultTypeId: "PICKUP" }
  });
  modal.onDidDismiss().then((res: any) => {
    if(res?.data?.saved) productStore.fetchPickupGroups();
  });
  await modal.present();
}

async function linkExistingPickupGroup() {
  const modal = await modalController.create({
    component: LinkExistingGroupModal,
    componentProps: {
      facilityGroupTypeId: "PICKUP",
      linkedGroupIds: pickupGroups.value.map((group: any) => group.facilityGroupId),
      title: translate("Link existing pickup group")
    }
  });
  modal.onDidDismiss().then((res: any) => {
    if(res?.data?.linked) productStore.fetchPickupGroups();
  });
  await modal.present();
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

  const isFailedToUpdateSomeRule = responses.some((response: any) => response.status === 'rejected')
  if(isFailedToUpdateSomeRule) {
    commonUtil.showToast(translate("Failed to update sequence for some rules."))
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

function createStorePickup() {
  router.push("create-store-pickup")
}
</script>

<style scoped>
.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacer-base);
  padding: var(--spacer-base) var(--spacer-base) var(--spacer-2xl);
}
</style>