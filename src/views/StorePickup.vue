<template>
  <ion-page>
    <ion-header>
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
      <template v-if="selectedSegment !== 'PICKUP_FACILITY'">
        <div v-if="ruleGroup.ruleGroupId && (rules.length || archivedRules.length)" class="pickup-layout">
          <aside class="pickup-aside">
            <PickupAnalytics />
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
        <template v-else>
          <div class="empty-block">
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
          <PickupAnalytics />
        </template>
      </template>
      <template v-else>
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
        <div v-else-if="facilities.length" class="pickup-layout">
          <aside class="pickup-aside">
            <PickupAnalytics />
          </aside>
          <main class="facility-list-col">
            <div class="facility-controls">
              <ion-searchbar :placeholder="translate('Search')" :value="facilitySearch" :debounce="200" @ionInput="facilitySearch = $event.detail.value || ''" />
              <ion-select v-model="facilitySort" :label="translate('Sort')" label-placement="start" interface="popover">
                <ion-select-option value="volume">{{ translate("Order volume") }}</ion-select-option>
                <ion-select-option value="name">{{ translate("Alphabetical") }}</ion-select-option>
                <ion-select-option value="created">{{ translate("Created date") }}</ion-select-option>
              </ion-select>
            </div>
            <section class="facility-list" v-if="displayedFacilities.length">
              <FacilityItem v-for="facility in displayedFacilities" :facility="facility" :key="facility.facilityId" pickup />
            </section>
            <div v-else class="empty-block">
              <EmptyState
                variant="compact"
                :icon="storefrontOutline"
                :title="translate('No facilities match your search')"
                :message="translate('Adjust your search to find facilities to add.')"
              />
            </div>
          </main>
        </div>
        <div v-else class="empty-block">
          <EmptyState
            variant="compact"
            :icon="storefrontOutline"
            :title="translate('No facilities to assign')"
            :message="translate('This product store has no facilities available to add to your pickup groups. Facilities come from your OMS — once they exist, they will appear here.')"
          />
          <SectionWayfinding :items="sectionTabs" :active="selectedSegment" @select="changeSegment" />
        </div>
      </template>

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
import { IonButton, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonMenuButton, IonPage, IonReorderGroup, IonSearchbar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonTitle, IonToolbar, modalController, onIonViewDidLeave, onIonViewDidEnter } from '@ionic/vue';
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

const facilitySearch = ref("");
const facilitySort = ref("volume");

// All facilities are loaded at once, so search and sort are applied locally.
const displayedFacilities = computed(() => {
  const term = facilitySearch.value.trim().toLowerCase();
  let list = facilities.value;
  if(term) {
    list = list.filter((facility: any) =>
      `${facility.facilityName || ""}`.toLowerCase().includes(term) ||
      `${facility.facilityId || ""}`.toLowerCase().includes(term)
    );
  }

  return [...list].sort((a: any, b: any) => {
    if(facilitySort.value === "name") {
      return `${a.facilityName || a.facilityId}`.localeCompare(`${b.facilityName || b.facilityId}`);
    }
    if(facilitySort.value === "created") {
      return facilityCreatedTime(b) - facilityCreatedTime(a);
    }
    // Order volume (BOPIS orders in the last 30 days), highest first.
    return pickupAnalyticsStore.getFacilityOrderCount(b.facilityId) - pickupAnalyticsStore.getFacilityOrderCount(a.facilityId);
  });
});

// Resolve a creation timestamp from whichever date field the facility record carries.
function facilityCreatedTime(facility: any): number {
  const raw = facility.createdDate || facility.createdStamp || facility.createdTxStamp || facility.lastUpdatedStamp || facility.fromDate;
  if(!raw) return 0;
  const millis = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isNaN(millis) ? 0 : millis;
}

const sectionTabs = computed(() => [
  { value: "RG_PICKUP_FACILITY", label: translate("Product and facility"), intro: translate("Route pickup orders by product and facility"), icon: businessOutline },
  { value: "RG_PICKUP_CHANNEL", label: translate("Product and channel"), intro: translate("Route pickup orders by product and channel"), icon: globeOutline },
  { value: "PICKUP_FACILITY", label: translate("Facility"), intro: translate("Select stores that participate in store pickup"), icon: storefrontOutline },
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
    await Promise.allSettled([fetchFacilities(250), productStore.fetchPickupGroups(), pickupAnalyticsStore.loadFacilityOrderCounts()]) ;
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
    await fetchFacilities(250);
    ruleStore.updateIsReorderActive(false)
    await Promise.allSettled([productStore.fetchPickupGroups(), pickupAnalyticsStore.loadFacilityOrderCounts()])
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

/* Analytics in a left column, the rule/facility list on the right. */
.pickup-layout {
  display: grid;
  grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
  gap: var(--spacer-base);
  align-items: start;
}

.pickup-aside {
  position: sticky;
  top: var(--spacer-base);
}

/* Keep the rule list centered in its column instead of pinned wide-left. */
.pickup-layout .atp-main {
  margin-top: var(--spacer-base);
}

.facility-list-col {
  min-width: 0;
  /* Keep the cards at the base width they had before the two-column layout. */
  max-width: 400px;
  justify-self: center;
  margin-top: var(--spacer-base);
}

.facility-controls {
  display: flex;
  align-items: center;
  gap: var(--spacer-xs);
  padding-inline: var(--spacer-sm);
}

.facility-controls ion-searchbar {
  flex: 1;
  padding: 0;
}

.facility-controls ion-select {
  flex-shrink: 0;
  max-width: 50%;
}

/* Single-column list of facility cards, as before — now with stats per card. */
.facility-list {
  display: flex;
  flex-direction: column;
}

/* Stack the analytics above the list on narrow screens. */
@media (max-width: 991px) {
  .pickup-layout {
    grid-template-columns: 1fr;
  }

  .pickup-aside {
    position: static;
  }
}
</style>