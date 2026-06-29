<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button @click="closeModal()">
          <ion-icon slot="icon-only" :icon="closeOutline" />
        </ion-button>
      </ion-buttons>
      <ion-title>{{ translate("Change location") }}</ion-title>
    </ion-toolbar>
    <ion-toolbar>
      <ion-searchbar v-model="queryString" :placeholder="translate('Search by facility name or ID')" :debounce="200" />
    </ion-toolbar>
  </ion-header>

  <ion-content>
    <div class="empty-state" v-if="isLoading">
      <ion-item lines="none">
        <ion-spinner name="crescent" slot="start" />
        {{ translate("Fetching facilities") }}
      </ion-item>
    </div>
    <ion-list v-else-if="filteredFacilities.length">
      <ion-item
        v-for="facility in filteredFacilities"
        :key="facility.facilityId"
        button
        lines="full"
        :color="facility.facilityId === currentFacilityId ? 'light' : undefined"
        @click="selectFacility(facility)"
      >
        <ion-label>
          {{ facility.facilityName || facility.facilityId }}
          <p>
            {{ facility.facilityId }}
            <span v-if="facility.facilityId === currentFacilityId"> · {{ translate("Current") }}</span>
          </p>
        </ion-label>
        <div slot="end" class="facility-inv">
          <div class="stat">
            <span class="stat-value">{{ facility.qoh }}</span>
            <span class="stat-label">{{ translate("QOH") }}</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ facility.atp }}</span>
            <span class="stat-label">{{ translate("ATP") }}</span>
          </div>
        </div>
      </ion-item>
    </ion-list>
    <EmptyState
      v-else
      variant="compact"
      :icon="searchOutline"
      :title="translate('No facilities match your search')"
      :message="translate('Try a different facility name or ID.')"
    />
  </ion-content>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  modalController
} from "@ionic/vue";
import { closeOutline, searchOutline } from "ionicons/icons";
import { api, commonUtil, logger, translate } from "@common";
import { computed, onMounted, ref } from "vue";
import EmptyState from "@/components/EmptyState.vue";

const props = defineProps<{
  productId: string;
  currentFacilityId: string;
  facilities: any[];
}>();

const queryString = ref("");
const isLoading = ref(false);
const inventoryByFacility = ref<Record<string, { qoh: any; atp: any }>>({});

// Base list = the product store's facilities (these carry the names); QOH/ATP are joined from
// a single batched inventory lookup so the user sees stock per facility without selecting each one.
const facilitiesWithInventory = computed(() =>
  (props.facilities || []).map((facility: any) => {
    const inv = inventoryByFacility.value[facility.facilityId];
    return { ...facility, qoh: inv?.qoh ?? "-", atp: inv?.atp ?? "-" };
  })
);

const filteredFacilities = computed(() => {
  const q = queryString.value.trim().toLowerCase();
  if (!q) return facilitiesWithInventory.value;
  return facilitiesWithInventory.value.filter((facility: any) =>
    (facility.facilityName || "").toLowerCase().includes(q) || (facility.facilityId || "").toLowerCase().includes(q)
  );
});

function closeModal() {
  modalController.dismiss();
}

function selectFacility(facility: any) {
  modalController.dismiss({ facilityId: facility.facilityId });
}

async function fetchInventoryAcrossFacilities() {
  isLoading.value = true;
  try {
    // The search endpoint requires a facilityId (keyword alone 400s), so fan out one lookup per
    // facility in parallel — mirroring the detail page's own fetch (keyword: productId + facilityId)
    // so each row's QOH/ATP matches exactly what the detail page shows for that facility. Batched
    // up front when the modal opens, so the user never has to select a facility to see its stock.
    const results = await Promise.all(
      (props.facilities || []).map(async (facility: any) => {
        try {
          const resp = await api({
            url: "oms/productFacilities/search",
            method: "GET",
            // Exact productId, NOT keyword: keyword fuzzy-matches a virtual product's variants and
            // would surface a variant's inventory as if it were this product's. A virtual product
            // has no inventory of its own, so exact match correctly yields nothing (shown as "-").
            params: { productId: props.productId, facilityId: facility.facilityId, pageSize: 1 }
          }) as any;
          if (resp && !commonUtil.hasError(resp)) {
            const record = resp.data?.products?.[0];
            return { facilityId: facility.facilityId, qoh: record?.inventoryConfig?.qoh ?? "-", atp: record?.inventoryConfig?.atp ?? "-" };
          }
        } catch (err) {
          logger.error("Failed to fetch inventory for facility", facility.facilityId, err);
        }
        return { facilityId: facility.facilityId, qoh: "-", atp: "-" };
      })
    );
    const map: Record<string, { qoh: any; atp: any }> = {};
    results.forEach((row) => { map[row.facilityId] = { qoh: row.qoh, atp: row.atp }; });
    inventoryByFacility.value = map;
  } catch (err) {
    logger.error("Failed to fetch inventory across facilities", err);
  }
  isLoading.value = false;
}

onMounted(fetchInventoryAcrossFacilities);
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: var(--spacer-base);
  color: var(--ion-color-medium);
}

.facility-inv {
  display: flex;
  gap: var(--spacer-lg);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 40px;
}

.stat-value {
  font-weight: 600;
}

.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ion-color-medium);
}
</style>
